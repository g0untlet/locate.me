document.getElementById('track-btn').addEventListener('click', () => {
    const statusText = document.getElementById('status');
    statusText.innerText = "Ortung läuft...";

    if (!navigator.geolocation) {
        statusText.innerText = "Geolocation wird von Ihrem Browser nicht unterstützt.";
        return;
    }

    navigator.geolocation.getCurrentPosition(
        // Erfolg
        (position) => {
            const payload = {
                userId: "user_static_1", // Später dynamisch
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: new Date(position.timestamp).toISOString() // Konvertierung in ISO-String
            };

            statusText.innerText = "Sende Daten an Backend...";

            // HINWEIS: Die URL passen wir später an, wenn Caddy als Reverse Proxy davorsteht
            fetch('http://localhost:8080/api/geo', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(response => {
                if (response.ok) {
                    statusText.innerText = "Standort erfolgreich gespeichert!";
                } else {
                    statusText.innerText = "Fehler beim Speichern im Backend.";
                }
            })
            .catch(error => {
                console.error("Fetch-Fehler:", error);
                statusText.innerText = "Verbindungsfehler zum Backend.";
            });
        },
        // Fehler
        (error) => {
            statusText.innerText = `Fehler bei der Ortung: ${error.message}`;
        },
        // Optionen
        {
            enableHighAccuracy: true, // Erzwingt GPS falls verfügbar
            timeout: 10000,           // 10 Sekunden Timeout
            maximumAge: 0             // Kein Cache, frische Daten
        }
    );
});
