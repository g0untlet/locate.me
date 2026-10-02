/* ==========================================================================
   locate.me – Shared Compass Heading Source
   Single point of truth for the device's rotation, extracted verbatim from
   locate.js so the Locate needle and the History direction arrows share one
   sensor handling instead of duplicating the device quirks.

   Emits a SCREEN-FRAME angle in degrees: the rotation that must be applied to
   a north-pointing needle for it to look correct on screen (i.e. north swings
   away as the device turns). Consumers derive their own target from it.

   Sensor handling (verbatim from locate.js, do not "simplify"):
   - Android/Chrome & Brave liefern keinen tilt-kompensierten Compass-Wert wie
     iOS webkitCompassHeading. Deren alpha/beta/gamma folgen der Gegen-Drehung
     (CCW). Die Nadel dreht deshalb um den rohen Yaw (+). Falls ein Gerät die
     Werte gespiegelt meldet (Nord zeigt 180° daneben), hier auf -1 stellen.
   - deviceorientation (nicht absolut) und deviceorientationabsolute (echtes
     Nord-Heading, Chrome/Android wenn erlaubt) werden parallel gehört; sobald
     absolute Events ankommen, werden die relativen verworfen (eine Quelle,
     kein Wackeln).
   - iOS 13+: DeviceOrientationEvent.requestPermission() nur innerhalb einer
     User-Geste aufrufen (requestHeadingPermission()).

   Batterie: die Sensor-Listener werden nur angehängt, solange mindestens ein
   Abnehmer (subscribeHeading) existiert, und beim letzten Abmelden wieder
   entfernt. Ohne Zuhörer laufen keine Orientation-Callbacks.
   ========================================================================== */

const DEG_TO_RAD = Math.PI / 180;
const ANDROID_ROTATION_SIGN = 1;

const NO_SIGNAL_WARN =
    "No orientation sensor data received — compass-dependent indicators stay " +
    "static. If you expected one, allow motion sensors for this site (disable " +
    "Brave Shields fingerprinting protection, or allow sensors in the site " +
    "settings).";

/* Aktueller Screen-Frame-Winkel (null = noch kein echtes Event empfangen) und
   die Abnehmer, die ihn über subscribeHeading() erhalten. */
let heading = null;
const listeners = new Set();

let listenersAttached = false;
let useAbsolute = false;      // absolute Events liefern echtes Nord-Heading
let permissionGranted = false; // iOS-Gate; auf anderen Plattformen nicht nötig
let permissionOutcome = 'unknown'; // 'unknown' | 'granted' | 'denied' | 'prompt'
let permissionPending = false;     // requestPermission() läuft gerade (synchroner Guard)

/* iOS 13+ verlangt requestPermission() in einer User-Geste; dort ist die
   Funktion vorhanden. Ohne sie (Android/Brave/Desktop) gibt es kein Gate. */
function requiresPermission() {
    return typeof (window.DeviceOrientationEvent &&
        window.DeviceOrientationEvent.requestPermission) === 'function';
}

/* Tilt-kompensierter Gier-Winkel (0..360) aus alpha/beta/gamma. Bei flach
   gehaltenem Gerät reduziert sich das Ergebnis auf alpha; im aufrechten
   Halten (z.B. beim Lesen der Liste) wird die Neigung ausgeglichen. */
export function computeYawDeg(alpha, beta, gamma) {
    const a = alpha * DEG_TO_RAD;
    const b = beta  * DEG_TO_RAD;
    const g = gamma * DEG_TO_RAD;
    const yaw = Math.atan2(
        Math.sin(a) * Math.cos(b) + Math.cos(a) * Math.sin(b) * Math.sin(g),
        Math.cos(a) * Math.cos(b) - Math.sin(a) * Math.sin(b) * Math.sin(g)
    );
    return (yaw * 180 / Math.PI + 360) % 360;
}

function emit(rotationDeg) {
    heading = rotationDeg;
    listeners.forEach(cb => cb(rotationDeg));
}

function onDeviceOrientation(e) {
    if (useAbsolute) return;

    if (typeof e.webkitCompassHeading === 'number') {
        // iOS: Nadel-Ende gegen die (CW-)Peilung drehen
        emit(-e.webkitCompassHeading);
        return;
    }
    if (e.alpha === null || e.alpha === undefined ||
        e.beta  === null || e.beta  === undefined ||
        e.gamma === null || e.gamma === undefined) return;
    emit(ANDROID_ROTATION_SIGN * computeYawDeg(e.alpha, e.beta, e.gamma));
}

function onDeviceOrientationAbsolute(e) {
    if (e.alpha === null || e.alpha === undefined ||
        e.beta  === null || e.beta  === undefined ||
        e.gamma === null || e.gamma === undefined) return;
    useAbsolute = true;
    emit(ANDROID_ROTATION_SIGN * computeYawDeg(e.alpha, e.beta, e.gamma));
}

function attachListeners() {
    if (listenersAttached) return;
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;
    window.addEventListener('deviceorientation', onDeviceOrientation);
    window.addEventListener('deviceorientationabsolute', onDeviceOrientationAbsolute);
    listenersAttached = true;
    checkSensorPermissions();
}

function detachListeners() {
    if (!listenersAttached) return;
    window.removeEventListener('deviceorientation', onDeviceOrientation);
    window.removeEventListener('deviceorientationabsolute', onDeviceOrientationAbsolute);
    listenersAttached = false;
}

/* Hängt die Sensor-Listener an, sobald (a) jemand zuhört und (b) eine
   eventuell nötige Permission erteilt ist. */
function attachIfPossible() {
    if (listeners.size === 0) return;
    if (requiresPermission() && !permissionGranted) return;
    attachListeners();
}

/* Prüft die Sensor-Permission – rein diagnostisch, damit ein stilles Blockieren
   (z.B. Brave Shields) nicht unbemerkt bleibt. */
function checkSensorPermissions() {
    if (!navigator.permissions || typeof navigator.permissions.query !== 'function') return;
    ['gyroscope', 'magnetometer', 'accelerometer'].forEach(name => {
        navigator.permissions.query({ name }).then(status => {
            if (status.state === 'denied') {
                console.warn(
                    `Motion sensor "${name}" is blocked for this site — compass-dependent ` +
                    "indicators stay static. Allow sensors for the site (site settings / " +
                    "Brave Shields fingerprinting protection off)."
                );
            }
        }).catch(() => { /* Permission-Name hier nicht unterstützt – ignorieren */ });
    });
}

/* ==========================================================================
   Public API
   ========================================================================== */

/* Abonniert Screen-Frame-Winkel (siehe Kopf). Der Callback wird sofort mit dem
   aktuellen Wert aufgerufen, falls schon ein Event empfangen wurde, damit neue
   Abnehmer nie mit einem leeren Winkel starten. Rückgabe: Abmeldefunktion
   (beim letzten Abmelden werden die Sensor-Listener entfernt). */
export function subscribeHeading(cb) {
    listeners.add(cb);
    attachIfPossible();
    if (heading !== null) cb(heading);
    return () => {
        listeners.delete(cb);
        if (listeners.size === 0) detachListeners();
    };
}

/* Aktueller Screen-Frame-Winkel oder null (noch kein echtes Event). */
export function getHeading() {
    return heading;
}

/* War jemals ein echtes Orientation-Event da? (Für Sichtbarkeits-/Fallback-
   Entscheidungen der Verbraucher.) */
export function hasHeading() {
    return heading !== null;
}

/* Ohne iOS-Gate sofort Sensoren nutzen (Android/Brave/Desktop). */
export function startHeadingSource() {
    attachIfPossible();
}

/* iOS 13+: requestPermission() MUSS synchron in einer User-Geste aufgerufen
   werden – daher direkt aus einem Klick-Handler (ohne vorheriges await)
   aufrufen. Auf Android/Desktop ist das ein No-op.
   Einmal erteilt oder endgültig verweigert wird nicht erneut gefragt; nur bei
   'prompt' (Nutzer hat den Dialog abgebrochen) ist eine spätere Frage erlaubt. */
export function requestHeadingPermission() {
    if (!requiresPermission()) {
        attachIfPossible();
        return;
    }
    if (permissionOutcome === 'granted' || permissionOutcome === 'denied') return;
    if (permissionPending) return; // schon eine Anfrage in derselben Geste offen
    permissionPending = true;
    try {
        window.DeviceOrientationEvent.requestPermission()
            .then(state => {
                permissionOutcome = state;
                if (state === 'granted') {
                    permissionGranted = true;
                    attachIfPossible();
                }
                // denied -> compass-dependent UI bleibt statisch
                // prompt -> Nutzer hat abgebrochen, später erneut fragen
            })
            .catch(() => {})
            .finally(() => { permissionPending = false; });
    } catch {
        permissionPending = false;
        /* Manche Browser erlauben den Aufruf nicht in diesem Kontext */
    }
}

export { NO_SIGNAL_WARN };