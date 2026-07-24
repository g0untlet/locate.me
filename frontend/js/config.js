/* ==========================================================================
   Global Configuration: Dynamic API Environment Detection (DEV vs PROD)
   ========================================================================== */
export const API_BASE_URL = window.location.port === '8080'
    ? 'http://localhost:8080'  // Local Quarkus Backend for local Live Server testing
    : '';                      // Production/Caddy-Proxy Environment (relative proxy paths)

export const API_PATH = '/api';
