const SERP_API_KEY = process.env.SERP_API_KEY; // Store this in Lambda env variables

const fetchRestaurants = async (restaurantName, postalCode, city, state, accuracy, restaurantSearchCriteria) => {

    let url
    if (restaurantSearchCriteria === "latLong") {
        url = `https://serpapi.com/search.json?q=${restaurantName} within ${accuracy} miles of ${postalCode}&api_key=${SERP_API_KEY}&hl=en&gl=us`;
    }
    if (restaurantSearchCriteria === "zipCode") {
        url = `https://serpapi.com/search.json?q=${restaurantName} within ${accuracy} miles of ${postalCode}&api_key=${SERP_API_KEY}&hl=en&gl=us`;
    }

    console.log("URL being SERPED ", url)
    const res = await fetch(url);

    console.log("✅ SerpAPI API being called :", url);

    if (!res.ok) {
        throw new Error(`Failed to fetch SerpAPI: ${res.status}`);
    }

    const json = await res.json();
    console.log("🔎 Google Search URL:", json.search_metadata?.google_url);

    console.log("✅ SerpAPI raw response:", JSON.stringify(json, null, 2));

    // Try local_results
    let rawResults = json.local_results?.places || json.local_results;

    // Fallback to organic_results if local_results are missing or empty
    if (!rawResults || rawResults.length === 0) {
        console.warn("⚠️ Falling back to organic_results");
        rawResults = json.organic_results || [];
    }

    if (!Array.isArray(rawResults)) {
        console.warn("⚠️ Unexpected SerpAPI format:", rawResults);
        return [];
    }

    // Map both types safely
    return rawResults.map(r => ({
        name: r.title || r.name || "",
        address: r.address || r.displayed_link || "",
        rating: r.rating || null,
        reviews: r.reviews || null,
        gps: r.gps_coordinates || null,
        thumbnail: r.thumbnail || null,
        link: r.link || r.redirect_link || null
    }));

};

const reverseGeocode = async (lat, lng) => {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
        headers: {
            "User-Agent": "MyGeoApp/1.0 (vikas@mydomain.com)"
        }
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Reverse geocoding failed: ${res.status} ${errorText}`);
    }

    const json = await res.json();
    return json.address;
};


export async function handler(event) {
    if (event.requestContext?.http?.method === "OPTIONS") {
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            },
            body: ""
        };
    }

    try {
        const body = JSON.parse(event.body);
        const { latitude, longitude, accuracy, restaurantName, zipcode } = body;

        console.log("Received location payload from UI:", { latitude, longitude, accuracy, restaurantName, zipcode });

        let computetedAddressForUser, computedPostalCodeForUser, computetedCityForUser, computetedStateForUser
        let restaurants = [];

        let restaurantSearchCriteria

        if (latitude && longitude) {
            console.log("Running location with:", { latitude, longitude, accuracy, restaurantName });

            restaurantSearchCriteria = "latLong"
            computetedAddressForUser = await reverseGeocode(latitude, longitude);
            console.log("Resolved Address:", computetedAddressForUser);

            computedPostalCodeForUser = computetedAddressForUser.postcode || "";
            console.log("Resolved postalCode:", computedPostalCodeForUser);

            computetedCityForUser = computetedAddressForUser.city
            console.log("Resolved City:", computetedCityForUser);

            computetedStateForUser = computetedAddressForUser.state
            console.log("Resolved State:", computetedStateForUser);

            restaurants = await fetchRestaurants(
                restaurantName,
                computedPostalCodeForUser, computetedCityForUser,
                computetedStateForUser, accuracy,
                restaurantSearchCriteria);
            console.log("🍽️ Found restaurants:", restaurants.length);
        } else if (zipcode) {
            restaurantSearchCriteria = "zipCode"
            console.log("Running location with:", { zipcode, restaurantName });

            restaurants = await fetchRestaurants(
                restaurantName,
                zipcode, "",
                "", accuracy,
                restaurantSearchCriteria);
            console.log("🍽️ Found restaurants:", restaurants.length);
        }

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                coords: { latitude, longitude, accuracy },
                computetedAddressForUser,
                restaurants
            })
        };
    } catch (error) {
        console.error("Error:", error);
        return {
            statusCode: 500,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({ message: "Internal Server Error", error: error.message })
        };
    }
}
