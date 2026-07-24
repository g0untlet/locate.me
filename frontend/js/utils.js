/* ==========================================================================
   Date Formatting Utility
   ========================================================================== */
export function formatRelativeDate(timestamp) {
    if (!timestamp) return 'Unknown Date';
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return 'Unknown Date';

    const now = new Date();
    const todayStart     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);

    const timeStr = d.toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' });

    if (d >= todayStart) {
        return `Today, ${timeStr}`;
    } else if (d >= yesterdayStart) {
        return `Yesterday, ${timeStr}`;
    } else {
        return d.toLocaleString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }
}

/* ==========================================================================
   Global Helper: Semantic Address Formatter
   ========================================================================== */
export function formatShortAddress(pos) {
    if (!pos) return "Unknown Location";
    let shortAddress = '';

    if (pos.osmName && pos.osmName.trim() !== '') {
        shortAddress = pos.osmName;
    } else if (pos.road && pos.houseNumber) {
        shortAddress = `${pos.road} ${pos.houseNumber}`;
    } else if (pos.road) {
        shortAddress = pos.road;
    } else {
        return pos.displayName || `Lat: ${pos.latitude.toFixed(4)}, Lon: ${pos.longitude.toFixed(4)}`;
    }

    if (pos.city) shortAddress += `, ${pos.city}`;
    if (pos.country) shortAddress += `, ${pos.country}`;

    return shortAddress;
}

/* ==========================================================================
   Utilities
   ========================================================================== */
export function formatWalkingTime(minutes) {
    const total = Math.round(minutes);
    if (total < 60) return `${total} min`;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function getWeatherText(code) {
    if (code === undefined || code === null) return "Unknown";

    switch (true) {
        case (code === 0): return "Clear sky";
        case (code >= 1 && code <= 3): return "Mainly clear";
        case (code >= 45 && code <= 48): return "Fog";
        case (code >= 51 && code <= 55): return "Drizzle";
        case (code === 56 || code === 57): return "Freezing drizzle";
        case (code >= 61 && code <= 65): return "Rain";
        case (code === 66 || code === 67): return "Freezing rain";
        case (code >= 71 && code <= 75): return "Snow fall";
        case (code === 77): return "Snow grains";
        case (code >= 80 && code <= 82): return "Rain showers";
        case (code === 85 || code === 86): return "Snow showers";
        case (code === 95): return "Thunderstorm";
        case (code === 96 || code === 99): return "Thunderstorm with hail";
        default: return "Unknown";
    }
}

/* ==========================================================================
   Global Helper: Pure, lightweight Inline SVG Weather Icon Renderer
   ========================================================================== */
export function getWeatherIconSvg(code) {
    const svgAttrs = `class="embedded-weather-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
    const fallbackIcon = `<svg ${svgAttrs}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;

    if (code === undefined || code === null) return fallbackIcon;

    switch (true) {
        case (code === 0):
            return `<svg class="embedded-weather-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
        case (code >= 1 && code <= 3):
            return `<svg ${svgAttrs}><path d="M17.5 19A3.5 3.5 0 0 0 21 15.5c0-2.79-2.54-4.5-5-4.5-.42-1.03-1.42-2.5-3.5-2.5a4.5 4.5 0 0 0-4.5 4.5c0 .14 0 .27.02.4A4 4 0 0 0 4 17a3.5 3.5 0 0 0 3.5 3.5h10z"></path></svg>`;
        case (code >= 45 && code <= 48):
            return `<svg ${svgAttrs}><line x1="5" y1="8" x2="19" y2="8"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="6" y1="16" x2="18" y2="16"></line></svg>`;
        case ((code >= 51 && code <= 55) || (code >= 61 && code <= 65) || (code >= 80 && code <= 82)):
            return `<svg ${svgAttrs}><line x1="16" y1="13" x2="16" y2="21"></line><line x1="8" y1="13" x2="8" y2="21"></line><line x1="12" y1="15" x2="12" y2="23"></line><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path></svg>`;
        case ((code >= 71 && code <= 75) || code === 77 || code === 85 || code === 86):
            return `<svg ${svgAttrs}><line x1="12" y1="2" x2="12" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line><line x1="4.93" y1="19.07" x2="19.07" y2="4.93"></line></svg>`;
        case (code === 95 || code === 96 || code === 99):
            return `<svg ${svgAttrs}><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 8.58"></path><polyline points="13 11 9 17 12 17 11 23 15 17 12 17 13 11"></polyline></svg>`;
        default:
            return fallbackIcon;
    }
}

/* ==========================================================================
   Global Helper: Pure, lightweight Inline SVG Location Icon Renderer
   ========================================================================== */
export function getLocationIconSvg(category, type) {
    const svgAttrs = `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"`;
    const defaultIcon = `<svg ${svgAttrs}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;

    if (!category) return defaultIcon;

    switch (category) {
        case 'building':
            return `<svg ${svgAttrs}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;
        case 'highway':
        case 'railway':
            if (['bus_stop', 'platform', 'station'].includes(type)) {
                return `<svg ${svgAttrs}><rect x="6" y="3" width="12" height="16" rx="2"></rect><line x1="9" y1="19" x2="7" y2="22"></line><line x1="15" y1="19" x2="17" y2="22"></line><circle cx="9" cy="15" r="1"></circle><circle cx="15" cy="15" r="1"></circle><path d="M6 9h12"></path></svg>`;
            }
            return `<svg ${svgAttrs}><line x1="18" y1="21" x2="14" y2="3"></line><line x1="6" y1="21" x2="10" y2="3"></line><line x1="12" y1="3" x2="12" y2="21" stroke-dasharray="3,3"></line></svg>`;
        case 'shop':
        case 'craft':
            return `<svg ${svgAttrs}><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>`;
        case 'leisure':
        case 'landuse':
        case 'natural':
            return `<svg ${svgAttrs}><path d="M12 19V5M12 5a4 4 0 0 0-4 4c0 2.5 2.5 5 4 7m0-11a4 4 0 0 1 4 4c0 2.5-2.5 5-4 7m-3 3h6"></path></svg>`;
        case 'amenity':
            if (['restaurant', 'cafe', 'fast_food', 'bar'].includes(type)) {
                return `<svg ${svgAttrs}><path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>`;
            }
            return `<svg ${svgAttrs}><path d="M3 21h18M3 10h18M3 7l9-4 9 4M7 10v7M12 10v7M17 10v7"></path></svg>`;
        case 'tourism':
        case 'historic':
            return `<svg ${svgAttrs}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
        case 'waterway':
            return `<svg ${svgAttrs}><path d="M12 22a7 7 0 0 0 7-7c0-4-7-13-7-13s-7 9-7 13a7 7 0 0 0 7 7z"></path></svg>`;
        default:
            return defaultIcon;
    }
}