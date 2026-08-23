---
name: website-maintenance
description: 
  Skill for maintaining the locate.me static marketing/install website (./website).
  Use this skill for ANY change to the website – HTML, CSS or JavaScript, page content,
  or release notes. Covers the trilingual EN/DE/ES pages, smartphone-first responsive
  design, the established language style and the release-notes workflow.
metadata:
  authors:
    - g0untlet
  version: "0.0.2"
  tags:
    - website
    - static-site
    - bilingual
    - HTML
    - CSS
    - release-notes
---

# locate.me Website Skill

## Golden Rules

1. **Always English, German AND Spanish.** Every change ships in all three versions:
   - EN: `index.html`, `release-notes.html`
   - DE: `index.de.html`, `release-notes.de.html`
   - ES: `index.es.html`, `release-notes.es.html`
   Keep `lang`, `<title>`, `meta name="description"`, `hreflang` links and `alt` texts in sync.
2. **Keep it compact, use the existing tone.** Short sentences, friendly direct address
   ("you" / "du" / "tú"), em dashes (`&mdash;`), German soft hyphens (`&shy;`) and `z.&nbsp;B.`.
   Mirror the copy style already on the pages – no marketing fluff.
3. **Smartphone first, desktop second.** Mobile is the primary look & feel, desktop
   secondary. Use the existing breakpoints (max-width: 860px, max-width: 640px) and
   `clamp()` typography. One-column grids on small screens, 2–3 columns on larger ones.
4. **Record the software releases.** Every app release gets an entry in
   `release-notes.html`, `release-notes.de.html` and `release-notes.es.html`,
   newest at the top.
5. **Deployment note (technical).** The website is physically hosted at
   `https://locateme.srv64.de/website/`. `www.locate-me.net` points there via a CNAME
   (`www.locate-me.net` → `locateme.srv64.de`); the hoster forwards the apex
   `locate-me.net` → `www`. The app itself is served at `https://app.locate-me.net/`
   (a CNAME → `locateme.srv64.de`).

---

## Site Structure

```
website/
├── index.html            ← Home, English
├── index.de.html         ← Home, German
├── index.es.html         ← Home, Spanish
├── release-notes.html    ← Release Notes, English
├── release-notes.de.html ← Release Notes, German
├── release-notes.es.html ← Release Notes, Spanish
├── css/style.css         ← single shared stylesheet (own design tokens)
├── js/main.js            ← theme toggle, language dropdown, email-link obfuscation, status dot
└── assets/               ← favicon.svg, mockup-map.svg, mockup-history.svg
```

---

## Page Conventions

- **Shared header:** logo (inline SVG), site-nav (Home / Release Notes), lang-menu
  (globe button + dropdown with EN/DE/ES links), theme-toggle. The active page gets
  `is-active` + `aria-current="page"`; the active language gets `is-active` +
  `aria-current="true"` on its `lang-option`.
- **Language dropdown:** a `.lang-toggle` button (globe + current lang code) toggles the
  `.lang-dropdown` panel (`hidden` attribute). `js/main.js` wires open/close + outside
  click + Escape. Never revert to the inline pill – three languages no longer fit.
- **FOUC-prevention script** in `<head>` before the CSS link (reads `localStorage.theme`,
  sets `data-theme` on `<html>`).
- **`hreflang` alternates:** each page links all three counterparts
  (`en`, `de`, `es`); reverse links included.
- **Relative links only** – no `<base>` tag (the site is served under `/website/` and at
  the root of `www.locate-me.net`).
- **Footer:** brand + status dot, attribution (OpenStreetMap, Leaflet, Open-Meteo),
  open-source GitHub link, footer note, and a `Website last update:` date line
  (`Website zuletzt aktualisiert:` in DE, `Última actualización del sitio web:` in ES).
  **This date refers to the website content, not the app release – bump it to today on
  every website content change.** The status dot polls `/api/system/info` (6 s timeout)
  and shows Online/Offline – `js/main.js` handles it.
- **Contact links:** use `class="email-link"`; the real mailto is built in `js/main.js`
  (obfuscated `info@locate-me.net`). Never hardcode the address in HTML.
- **App URL** referenced on the install pages: `https://app.locate-me.net/`.

---

## Design System

Website CSS tokens (`css/style.css`) – never hardcode colors, always use the variables:

```css
:root {              /* Light (default) */
    --bg-page, --bg-outer, --bg-hero, --card-bg, --surface-subtle
    --primary-color, --primary-hover, --primary-dark, --primary-tint
    --text-color, --text-strong, --text-muted, --border-color
    --radius-lg: 24px, --radius-md: 16px, --radius-sm: 8px
    --shadow, --shadow-card, --transition
}
[data-theme="dark"] { /* Dark mode overrides the same tokens */
```

- Key components: `.feature-card`, `.install-card`, `.steps`/`.step`, `.release-card`,
  `.showcase-grid`, `.btn`, `.install-notice`, `.status-dot`, `.trust-grid`/`.trust-card`.
- Responsive: `@media (max-width: 860px)` collapses `.feature-grid` to 2 cols;
  `@media (max-width: 640px)` collapses grids to 1 col and wraps the header.

---

## Language & Style Guide

| | English | German | Spanish |
|--|---------|--------|---------|
| Date | `August 17, 2026` | `17. August 2026` (long form) | `17 de agosto de 2026` |
| Entities | `&mdash;`, `&ldquo;`/`&rdquo;` | `&uuml;`, `&ouml;`, `&auml;`, `&szlig;`, `&ndash;`, `&shy;`, `z.&nbsp;B.` | `&aacute;`, `&eacute;`, `&iacute;`, `&oacute;`, `&uacute;`, `&ntilde;`, `&uuml;`, `&iquest;`, `&ndash;`, `&mdash;` |
| Nav | Home / Release Notes | Start / Versionshinweis | Inicio / Notas de la versión |
| Page titles | Release Notes | Versionshinweise | Notas de la versión |
| Footer date | Website last update: | Website zuletzt aktualisiert: | Última actualización del sitio web: |
| "what's new" lead | `<strong>Feature</strong> &mdash; description` | same, `&mdash;` | same, `&mdash;` |

All three versions are direct and informal ("you" / "du" / "tú"). Keep headline + tagline
short, and describe each feature in one or two sentences, starting with a `<strong>` lead-in.

---

## Release Notes Workflow

`release-notes.html` / `release-notes.de.html` / `release-notes.es.html` list releases
newest first. When a new app version ships:

1. Add an `<article class="release-card">` at the **top** of `.release-list`.
2. Structure:
   - `.release-head` → `<span class="release-version">vX.Y.Z</span>` +
     `<span class="release-date">` (date format per language, see table above)
   - `.release-tagline` → one-line summary
   - `.release-items` → `<ul>` with one `<li>` per change, each starting with a
     `<strong>` lead-in followed by `&mdash;` and a compact description.
3. Mirror the identical content in all three language files; only dates and language differ.
4. Always keep the version number in sync with the app/backend version and the git tag.

---

## Verification Checklist

- [ ] EN, DE and ES versions of every touched page are updated and identical in content.
- [ ] `lang`, `<title>`, meta description, `hreflang` links (all three) and `alt` texts match.
- [ ] Active nav/language links carry `is-active` + `aria-current`.
- [ ] Language dropdown present on all six pages (globe button + EN/DE/ES options).
- [ ] Layout is correct at smartphone width first, then desktop (860px / 640px breakpoints).
- [ ] No hardcoded colors; design tokens only.
- [ ] App URL and status-dot fetch unchanged unless intended.
- [ ] Footer "Website last update" date bumped to today on all 6 pages.
- [ ] Release notes: newest version on top, consistent `vX.Y.Z`, dates in correct format.