/* ==========================================================================
   Geolocation & Backend Integration Logic
   ========================================================================== */

document.getElementById('track-btn').addEventListener('click', () => {
    const statusText = document.getElementById('status');
    const responseCard = document.getElementById('response-card');
    
    // Reset UI state & trigger loading indicators
    statusText.innerText = "Locating GPS...";
    statusText.className = "status-loading";
    responseCard.classList.add('hidden');

    const geoOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    };

    if (!navigator.geolocation) {
        showError("Geolocation is not supported by your browser.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        // 1. Success Callback: GPS coordinates retrieved successfully
        (position) => {
            statusText.innerText = "Sending to backend...";
            
            // Construct the payload matching the Quarkus DTO structure
            const payload = {
                userId: "user123", // Hardcoded fallback for now
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: new Date().toISOString() // Outputs UTC format e.g., "2026-06-14T13:15:00Z"
            };

            // HTTP POST request using a relative path for seamless Caddy 2 reverse-proxying
            fetch('/positions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server returned status ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Update UI to success state
                statusText.innerText = "Location saved successfully!";
                statusText.className = "status-success";

                // Selectively map backend response fields to the clean UI grid
                document.getElementById('res-id').innerText = `#${data.id}`;
                document.getElementById('res-temp').innerText = `${data.temperature} °C`;
                document.getElementById('res-weather').innerText = `Code ${data.weatherCode} (${getWeatherText(data.weatherCode)})`;
                document.getElementById('res-address').innerText = data.displayName;

                // Make the structured dashboard visible
                responseCard.classList.remove('hidden');
            })
            .catch(err => {
                showError(`Backend Error: ${err.message}`);
            });
        },
        // 2. Error Callback: GPS tracking failed or timed out
        (error) => {
            showError(`GPS Error: ${error.message}`);
        },
        geoOptions
    );
});

/**
 * Updates the UI status label with an error style and message.
 * @param {string} message - The error message to display.
 */
function showError(message) {
    const statusText = document.getElementById('status');
    statusText.innerText = message;
    statusText.className = "status-error";
}

/**
 * Maps standard WMO weather codes provided by Open-Meteo to human-readable strings.
 * @param {number} code - The WMO weather code.
 * @returns {string} Human-readable weather description.
 */
function getWeatherText(code) {
    if (code === 0) return "Clear sky";
    if (code >= 1 && code <= 3) return "Mainly clear / Partly cloudy";
    if (code >= 45 && code <= 48) return "Fog";
    if (code >= 51 && code <= 55) return "Drizzle";
    if (code >= 61 && code <= 65) return "Rain";
    if (code >= 71 && code <= 75) return "Snow";
    if (code >= 80 && code <= 82) return "Rain showers";
    return "Unknown Weather State";
}
