/* ==========================================================================
   Geolocation & Backend Integration Logic
   ========================================================================== */

document.getElementById('track-btn').addEventListener('click', () => {
    const statusText = document.getElementById('status');
    const responseCard = document.getElementById('response-card');
    
    // UI-Zustand zurücksetzen & Lade-Indikator triggern
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
        // 1. Success Callback: GPS-Koordinaten erfolgreich ermittelt
        (position) => {
            statusText.innerText = "Sending to backend...";
            
            // Payload-Struktur passend zum Quarkus DTO
            const payload = {
                userId: "user123",
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: new Date().toISOString()
            };

            // HTTP POST an den relativen Pfad (wird von Caddy an Quarkus weitergeleitet)
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
                // UI auf Erfolg setzen
                statusText.innerText = "Location saved successfully!";
                statusText.className = "status-success";

                // ID in den Kachel-Header injizieren
                document.getElementById('res-id-span').innerText = `for #${data.id}`;
                
                // Temperatur auf genau eine Nachkommastelle runden
                if (data.temperature !== undefined && data.temperature !== null) {
                    const formattedTemp = parseFloat(data.temperature).toFixed(1);
                    document.getElementById('res-temp').innerText = `${formattedTemp} °C`;
                } else {
                    document.getElementById('res-temp').innerText = "-";
                }
                
                // Wetter-Code auflösen und Adresse setzen
                document.getElementById('res-weather').innerText = `Code ${data.weatherCode} (${getWeatherText(data.weatherCode)})`;
                document.getElementById('res-address').innerText = data.displayName;

                // Dashboard-Kachel einblenden
                responseCard.classList.remove('hidden');
            })
            .catch(err => {
                showError(`Backend Error: ${err.message}`);
            });
        },
        // 2. Error Callback
        (error) => {
            showError(`GPS Error: ${error.message}`);
        },
        geoOptions
    );
});

/* ==========================================================================
   Fetch & Render History Table
   ========================================================================== */
document.getElementById('toggle-history-btn').addEventListener('click', (e) => {
    e.preventDefault();
    const historyContainer = document.getElementById('history-container');
    const linkBtn = document.getElementById('toggle-history-btn');

    // Wenn die Sektion sichtbar ist, einfach wieder zuklappen
    if (!historyContainer.classList.contains('hidden')) {
        historyContainer.classList.add('hidden');
        linkBtn.innerText = "Show Position History";
        return;
    }

    // Verlauf vom Backend laden
    fetch('/positions')
        .then(response => {
            if (!response.ok) throw new Error("Could not fetch history");
            return response.json();
        })
        .then(data => {
            const tbody = document.getElementById('history-tbody');
            tbody.innerHTML = ""; // Alten Inhalt leeren

            data.forEach(pos => {
                const tr = document.createElement('tr');

                // 1. Temperatur formatieren
                const tempFormatted = (pos.temperature !== undefined && pos.temperature !== null) 
                    ? `${parseFloat(pos.temperature).toFixed(1)}°C` 
                    : '-';

                // 2. Adresse restriktiv nach 10 Zeichen abschneiden (Ellipsis)
                let shortAddress = "-";
                if (pos.displayName) {
                    shortAddress = pos.displayName.length > 10 
                        ? pos.displayName.substring(0, 10) + "..." 
                        : pos.displayName;
                }

                // 3. Zeitstempel lesbar nach deutschen Standards formatieren (Lokalzeit)
                let dateFormatted = "-";
                if (pos.timestamp) {
                    const dateObj = new Date(pos.timestamp);
                    dateFormatted = dateObj.toLocaleString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }

                // Zeile zusammensetzen und einhängen
                tr.innerHTML = `
                    <td><strong>#${pos.id}</strong></td>
                    <td style="white-space: nowrap;">${dateFormatted}</td>
                    <td>${pos.userId || 'unknown'}</td>
                    <td>${tempFormatted}</td>
                    <td title="${pos.displayName || ''}">${shortAddress}</td>
                `;
                tbody.appendChild(tr);
            });

            // Tabelle einblenden und Link-Text anpassen
            historyContainer.classList.remove('hidden');
            linkBtn.innerText = "Hide Position History";
        })
        .catch(err => {
            alert(`History Error: ${err.message}`);
        });
});

/**
 * Updates the UI status label with an error style and message.
 */
function showError(message) {
    const statusText = document.getElementById('status');
    statusText.innerText = message;
    statusText.className = "status-error";
}

/**
 * Maps standard WMO weather codes provided by Open-Meteo to human-readable strings.
 */
function getWeatherText(code) {
    if (code === 0) return "Clear sky";
    if (code >= 1 && code <= 3) return "Mainly clear";
    if (code >= 45 && code <= 48) return "Fog";
    if (code >= 51 && code <= 55) return "Drizzle";
    if (code >= 61 && code <= 65) return "Rain";
    if (code >= 71 && code <= 75) return "Snow";
    if (code >= 80 && code <= 82) return "Rain showers";
    return "Unknown";
}