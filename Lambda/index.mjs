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
    try {
        const body = JSON.parse(event.body);
        const { latitude, longitude, accuracy } = body;

        console.log("Received location:", { latitude, longitude, accuracy });

        const address = await reverseGeocode(latitude, longitude);
        console.log("Resolved Address:", address);

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                message: "Location received",
                coords: { latitude, longitude, accuracy },
                address
            })
        };
    } catch (error) {
        console.error("Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Internal Server Error" })
        };
    }
}
