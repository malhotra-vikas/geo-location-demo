const SERP_API_KEY = process.env.SERP_API_KEY; // Store this in Lambda env variables

const fetchRestaurants = async (restaurantName, postalCode) => {
    const url = `https://serpapi.com/search.json?q=${restaurantName}+near+${encodeURIComponent(postalCode)}&api_key=${SERP_API_KEY}&hl=en&gl=us`;
    const res = await fetch(url);

    console.log("✅ SerpAPI API being called :", url);

    if (!res.ok) {
        throw new Error(`Failed to fetch SerpAPI: ${res.status}`);
    }

    const json = await res.json();
    console.log("✅ SerpAPI raw response:", JSON.stringify(json, null, 2));

    const rawResults = json.local_results?.places || json.local_results || [];

    if (!Array.isArray(rawResults)) {
        console.warn("⚠️ Unexpected SerpAPI format:", rawResults);
        return [];
    }

    return rawResults.map(r => ({
        name: r.title || r.name,
        address: r.address,
        rating: r.rating,
        reviews: r.reviews,
        gps: r.gps_coordinates,
        thumbnail: r.thumbnail
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
        const { latitude, longitude, accuracy, restaurantName } = body;

        console.log("Received location:", { latitude, longitude, accuracy, restaurantName });

        const address = await reverseGeocode(latitude, longitude);
        console.log("Resolved Address:", address);

        const postalCode = address.postcode || "";
        console.log("Resolved postalCode:", postalCode);
        let restaurants = [];

        if (postalCode) {
            restaurants = await fetchRestaurants(restaurantName, postalCode);
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
                address,
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
