/* ==========================================================================
   SPA Navigation Framework (Tab Controller)
   ========================================================================== */
document.querySelectorAll('.nav-item').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        const targetPageId = button.getAttribute('data-target');
        document.querySelectorAll('.app-page').forEach(page => page.classList.add('hidden'));
        document.getElementById(targetPageId).classList.remove('hidden');

        if (targetPageId === 'page-history') {
            fetchAndRenderHistory();
        }
    });
});

/* ==========================================================================
   Global Helper: Dynamically extract active User ID from LocalStorage
   ========================================================================== */
function getActiveUserId() {
    const savedId = localStorage.getItem('userId');
    return (savedId && savedId.trim() !== "") ? savedId.trim() : "user123";
}

/* ==========================================================================
   Global Helper: Pure, lightweight Inline SVG Weather Icon Renderer
   ========================================================================== */
function getWeatherIconSvg(code) {
    if (code === undefined || code === null) {
        return `<svg class="embedded-weather-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }
    if (code === 0) {
        return `<svg class="embedded-weather-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
    }
    if (code >= 1 && code <= 3) {
        return `<svg class="embedded-weather-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19A3.5 3.5 0 0 0 21 15.5c0-2.79-2.54-4.5-5-4.5-.42-1.03-1.42-2.5-3.5-2.5a4.5 4.5 0 0 0-4.5 4.5c0 .14 0 .27.02.4A4 4 0 0 0 4 17a3.5 3.5 0 0 0 3.5 3.5h10z"></path></svg>`;
    }
    if (code >= 45 && code <= 48) {
        return `<svg class="embedded-weather-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="8" x2="19" y2="8"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="6" y1="16" x2="18" y2="16"></line></svg>`;
    }
    if ((code >= 51 && code <= 55) || (code >= 61 && code <= 65) || (code >= 80 && code <= 82)) {
        return `<svg class="embedded-weather-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16" y1="13" x2="16" y2="21"></line><line x1="8" y1="13" x2="8" y2="21"></line><line x1="12" y1="15" x2="12" y2="23"></line><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path></svg>`;
    }
    if (code >= 71 && code <= 75) {
        return `<svg class="embedded-weather-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line><line x1="4.93" y1="19.07" x2="19.07" y2="4.93"></line></svg>`;
    }
    return `<svg class="embedded-weather-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
}

/* ==========================================================================
   Page 1: Geolocation Tracking (Locate Engine)
   ========================================================================== */
document.getElementById('track-btn').addEventListener('click', () => {
    const statusText = document.getElementById('status');
    const responseCard = document.getElementById('response-card');
    
    statusText.innerText = "Locating GPS...";
    statusText.className = "status-loading";
    responseCard.classList.add('hidden');

    const geoOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

    if (!navigator.geolocation) {
        showError("Geolocation is not supported by your browser.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            statusText.innerText = "Sending to backend...";
            
            const clientTimestamp = new Date();
            const isoStringTimestamp = clientTimestamp.toISOString();
            
            const payload = {
                userId: getActiveUserId(),
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: isoStringTimestamp
            };

            fetch('/positions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(response => {
                if (!response.ok) throw new Error(`Server returned status ${response.status}`);
                return response.json();
            })
            .then(data => {
                statusText.innerText = "Location saved successfully!";
                statusText.className = "status-success";

                const localTimeFormatted = clientTimestamp.toLocaleString('de-DE', {
                    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                document.getElementById('res-time-span').innerText = `at ${localTimeFormatted}`;
                
                if (data.temperature !== undefined && data.temperature !== null) {
                    document.getElementById('res-temp').innerText = `${parseFloat(data.temperature).toFixed(1)} °C`;
                } else {
                    document.getElementById('res-temp').innerText = "-";
                }
                
                const iconContainer = document.getElementById('res-weather-icon-container');
                iconContainer.innerHTML = getWeatherIconSvg(data.weatherCode);
                const mainIconSvg = iconContainer.querySelector('svg');
                if (mainIconSvg) mainIconSvg.style.stroke = "#1a5f8c";

                document.getElementById('res-weather').innerText = `Code ${data.weatherCode} (${getWeatherText(data.weatherCode)})`;
                document.getElementById('res-address').innerText = data.displayName || "Unknown Location";
                responseCard.classList.remove('hidden');
            })
            .catch(err => showError(`Backend Error: ${err.message}`));
        },
        (error) => showError(`GPS Error: ${error.message}`),
        geoOptions
    );
});

/* ==========================================================================
   Page 2: History Engine (Bulletproof Accordion Drawer Implementation)
   ========================================================================== */
function fetchAndRenderHistory() {
    const listContainer = document.getElementById('history-list');
    listContainer.innerHTML = `<div style="text-align:center; width:100%; color:var(--text-muted); font-size:0.9rem; padding:20px 0;">Loading historical logs...</div>`;

    const activeUserId = getActiveUserId();

    fetch(`/positions?userId=${encodeURIComponent(activeUserId)}`)
        .then(response => {
            if (!response.ok) throw new Error("Could not fetch history");
            return response.json();
        })
        .then(data => {
            listContainer.innerHTML = "";

            if (!data || !Array.isArray(data) || data.length === 0) {
                listContainer.innerHTML = `<div style="text-align:center; width:100%; color:var(--text-muted); font-size:0.9rem; padding:20px 0;">No locations logged yet for user "${activeUserId}".</div>`;
                return;
            }

            data.forEach(pos => {
                // Try-catch blocks prevent a single broken backend item from destroying the entire list layout
                try {
                    if (!pos || pos.id === undefined) return;

                    const card = document.createElement('div');
                    card.className = 'log-card';
                    card.id = `log-card-${pos.id}`;

                    let tempClass = "temp-none";
                    let tempFormatted = "-";
                    let weatherIconSvg = getWeatherIconSvg(null);

                    if (pos.temperature !== undefined && pos.temperature !== null && !isNaN(parseFloat(pos.temperature))) {
                        const tempVal = parseFloat(pos.temperature);
                        tempFormatted = `${tempVal.toFixed(1)}°C`;
                        
                        if (tempVal <= 0) tempClass = "temp-blue";
                        else if (tempVal <= 10) tempClass = "temp-lightblue";
                        else if (tempVal < 25) tempClass = "temp-orange";
                        else tempClass = "temp-red";
                        
                        const wCode = (pos.weatherCode !== undefined && pos.weatherCode !== null) ? parseInt(pos.weatherCode, 10) : null;
                        weatherIconSvg = getWeatherIconSvg(wCode);
                    }

                    let dateFormatted = "Unknown Date";
                    if (pos.timestamp) {
                        const dateObj = new Date(pos.timestamp);
                        if (!isNaN(dateObj.getTime())) {
                            dateFormatted = dateObj.toLocaleString('de-DE', {
                                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                            });
                        }
                    }

                    const fullAddress = pos.displayName || `Coordinates: ${pos.latitude || '?'}, ${pos.longitude || '?'}`;

                    card.innerHTML = `
                        <div class="log-card-clickable-area">
                            <div class="log-card-header">
                                <div>
                                    <span class="log-card-id">#${pos.id}</span>
                                    <span style="margin-left: 6px;">${dateFormatted}</span>
                                </div>
                                <span class="log-card-user">${pos.userId || 'unknown'}</span>
                            </div>
                            <div class="log-card-body">
                                <div class="log-card-address">${fullAddress}</div>
                                <div class="log-card-temp ${tempClass}">
                                    ${weatherIconSvg}
                                    <span>${tempFormatted}</span>
                                </div>
                            </div>
                        </div>
                        <div class="log-card-action-tray">
                            <button class="tray-action-btn btn-action-delete" data-id="${pos.id}">
                                <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                                Delete
                            </button>
                        </div>
                    `;

                    // Accordion trigger engine handler logic
                    const clickableArea = card.querySelector('.log-card-clickable-area');
                    clickableArea.addEventListener('click', () => {
                        const isExpanded = card.classList.contains('expanded');
                        
                        // Close any other open logs to keep the UI clean
                        document.querySelectorAll('.log-card.expanded').forEach(c => {
                            if (c !== card) c.classList.remove('expanded');
                        });
                        
                        card.classList.toggle('expanded', !isExpanded);
                    });

                    // REST Deletion API fetch loop handler rules
                    const deleteBtn = card.querySelector('.btn-action-delete');
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation(); // Avoid firing expansion triggers
                        
                        const targetId = deleteBtn.getAttribute('data-id');
                        if (!targetId) return;
                        
                        fetch(`/positions/${targetId}`, { method: 'DELETE' })
                        .then(response => {
                            if (!response.ok) throw new Error("Could not process record removal");
                            
                            // Trigger smooth sliding CSS transition layout animation routines
                            card.classList.add('card-leave-animate');
                            card.addEventListener('animationend', () => {
                                card.remove();
                                if (listContainer.children.length === 0) {
                                    listContainer.innerHTML = `<div style="text-align:center; width:100%; color:var(--text-muted); font-size:0.9rem; padding:20px 0;">No locations logged yet for user "${activeUserId}".</div>`;
                                }
                            });
                        })
                        .catch(err => alert(`Error removing entry: ${err.message}`));
                    });

                    listContainer.appendChild(card);

                } catch (itemError) {
                    console.error("Skipped rendering corrupted log item:", pos, itemError);
                }
            });
        })
        .catch(err => {
            listContainer.innerHTML = `<div style="text-align:center; width:100%; color:var(--text-error); font-size:0.9rem; padding:20px 0;">Error: ${err.message}</div>`;
        });
}

/* ==========================================================================
   Page 3: LocalStorage Settings Engine
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    const savedId = localStorage.getItem('userId');
    if (savedId) {
        document.getElementById('username-input').value = savedId;
    }
});

document.getElementById('save-settings-btn').addEventListener('click', () => {
    const inputVal = document.getElementById('username-input').value.trim();
    const statusDiv = document.getElementById('settings-status');

    localStorage.setItem('userId', inputVal);

    statusDiv.style.color = "#16a34a";
    statusDiv.innerText = "Settings saved successfully!";

    setTimeout(() => {
        statusDiv.innerText = "";
    }, 3000);
});

/* ==========================================================================
   Utilities
   ========================================================================== */
function showError(message) {
    const statusText = document.getElementById('status');
    statusText.innerText = message;
    statusText.className = "status-error";
}

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
