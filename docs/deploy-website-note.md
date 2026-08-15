# locate.me – Website: Deployment & Serving (DEV + PROD)

This note explains how to deploy the static marketing/install website (`./website`).
In DEV it is served under `https://locateme-dev.folger.home64.de/website/`; in PROD it
is served at `https://locateme.srv64.de/website/` and via the DNS alias
`https://locate-me.net/`.

The website is deployed to a **dedicated folder** (`/home/gauntlet/homelab/locate.me.dev/website/`)
next to the frontend. Nothing of the app (frontend, backend, data) is touched.
A section below covers the PROD setup (`locate-me.net` + `locateme.srv64.de/website/`).

> **Domains & hosting:** The **app** (DEV: `locateme-dev.folger.home64.de`, PROD:
> `locateme.srv64.de`) is a separate thing from the **static website**. In PROD the
> website's content is physically hosted at `https://locateme.srv64.de/website/`. The
> `locate-me.net` hoster does **not** allow uploading static content, so `locate-me.net`
> is configured only via DNS (A-record + CNAME) to point at this server; Caddy then
> serves the same folder at the root of `https://locate-me.net/`.

## Prerequisites

- Caddy2 runs as a Docker container (bind mounts are defined in its `docker-compose.yml`).
- `deploy-website-dev.sh` is executable and run from the project root.
- The website folder is currently **not** mounted into the Caddy container – only the
  frontend folders are. This is fixed in Step 2.

## Step 1 – Deploy the website files

From the repository root:

```bash
./deploy-website-dev.sh
```

This rsyncs `./website/` to `gauntlet@192.168.178.88:/home/gauntlet/homelab/locate.me.dev/website/`.

Verify on the server:

```bash
ssh gauntlet@192.168.178.88 'ls -la /home/gauntlet/homelab/locate.me.dev/website/'
```

## Step 2 – Expose the folder to the Caddy container (DEV)

Edit the Caddy service in your `docker-compose.yml` (the directory containing the
Caddy service) and add this volume next to the frontend mounts:

```yaml
      - /home/gauntlet/homelab/locate.me.dev/website:/var/www/locate.me.dev/website  #locate.me dev website
```

Then recreate the container so the new mount becomes active:

```bash
docker compose up -d
```

> **Note:** Bind mounts are fixed at container creation – a plain `caddy reload`
> cannot add a new volume. The container must be recreated (`up -d` handles this).

## Step 3 – Add the Caddy route (DEV block only)

In your `Caddyfile`, edit the `locateme-dev.folger.home64.de` block and insert the
following **between** `handle /api* { ... }` and the fallback `handle { file_server }`:

```
    # Statische Website (Marketing/Installations-Seite) im Unterpfad
    handle_path /website/* {
        root * /var/www/locate.me.dev/website
        file_server
    }

    # Ohne abschließenden Slash direkt auf /website/ weiterleiten
    handle /website {
        redir /website/ permanent
    }
```

Notes:

- `handle_path` strips the `/website` prefix, so `/website/css/style.css` is served
  from `/var/www/locate.me.dev/website/css/style.css`. A plain `handle` without
  prefix-stripping would look in `…/website/website/…` and 404.
- The site uses only relative asset links, so it works under the subpath.
- The block's existing `header Cache-Control "no-store"` also applies to `/website/`.
- Order matters: the new blocks must stay **above** the fallback `handle { file_server }`
  so `/website/*` is matched first. `/api*` and `/website/*` never overlap.

## Step 4 – Validate + (re)load Caddy

Validate the Caddyfile (catches typos before they break the server):

```bash
docker exec caddy caddy validate --config /etc/caddy/Caddyfile
```

If you changed **only** the Caddyfile (no compose change), hot-reload it:

```bash
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
```

If you recreated the container in Step 2, Caddy loads the new config automatically
on start. Confirm the container is healthy:

```bash
docker compose ps
```

## Step 5 – Test

- English: <https://locateme-dev.folger.home64.de/website/>
- German: <https://locateme-dev.folger.home64.de/website/index.de.html>
- Also verify on a smartphone: layout, EN↔DE language switch, dark-mode toggle.

---

## PROD – Website on locateme.srv64.de/website/ + locate-me.net (DNS alias)

In PROD the **static website content is physically hosted on the app server** at
`https://locateme.srv64.de/website/` (a subpath of the PROD app domain). The
`locate-me.net` hoster allows no content upload, so `locate-me.net` is a **DNS alias**
(A-record + CNAME) to this same server, and Caddy serves the **same folder** at the
root of `https://locate-me.net/`. The app itself stays at `https://locateme.srv64.de/`
(root) and is not touched.

### P1 – DNS records (at the locate-me.net hoster)

The hoster only forwards DNS – no files are uploaded there.

- `A` record: `locate-me.net` → public IP of the `locateme.srv64.de` server.
- `CNAME` record: `www.locate-me.net` → `locateme.srv64.de` (so `www` also works).
- Caddy auto-provisions TLS certificates for `locate-me.net` / `www.locate-me.net`
  once the DNS records resolve publicly (ACME via the HTTP-01 or TLS-ALPN challenge).
  Make sure the records are live *before* testing HTTPS.

### P2 – Deploy the website files

From the repository root:

```bash
./deploy-website-prod.sh
```

This rsyncs `./website/` to `gauntlet@192.168.178.88:/home/gauntlet/homelab/locate.me/website/`
(the PROD app lives in `~/homelab/locate.me/`, same server as DEV).

Verify on the server:

```bash
ssh gauntlet@192.168.178.88 'ls -la /home/gauntlet/homelab/locate.me/website/'
```

### P3 – Expose the folder to the Caddy container (PROD)

Edit the Caddy service in your `docker-compose.yml` and add this volume next to the
PROD frontend mount:

```yaml
      - /home/gauntlet/homelab/locate.me/website:/var/www/locate.me/website  #locate.me prod website
```

Then recreate the container so the new mount becomes active:

```bash
docker compose up -d
```

> **Note:** Bind mounts are fixed at container creation – a plain `caddy reload`
> cannot add a new volume. The container must be recreated (`up -d` handles this).

### P4 – Caddy routes (two parts)

**Part A – `locateme.srv64.de` block: serve the website under `/website/`.**
Insert the following **between** `handle /api* { ... }` and the fallback
`handle { file_server }` (identical to DEV Step 3):

```
    # Statische Website (Marketing/Installations-Seite) im Unterpfad
    handle_path /website/* {
        root * /var/www/locate.me/website
        file_server
    }

    # Ohne abschließenden Slash direkt auf /website/ weiterleiten
    handle /website {
        redir /website/ permanent
    }
```

**Part B – new `locate-me.net` host block: serve the same folder at the root.**
Add a dedicated site block (the DNS records from P1 point this host at this server):

```
locate-me.net, www.locate-me.net {
    root * /var/www/locate.me/website
    file_server
    header Cache-Control "no-store"
}
```

**No-conflict guarantee.** The three path namespaces are disjoint and Caddy `handle`
blocks are mutually exclusive (first match wins; the fallback only serves what no
earlier handle matched):

| Path prefix | Served by |
|---|---|
| `/api/*` | Quarkus backend |
| `/website/*` | static website folder |
| everything else (root `/`, `/app.js`, …) | PWA frontend |

Order must stay `/api*` → `/website/*` → `/website` redirect → fallback. The PWA has
no URL routes and never requests `/website`, so requests are consumed by the website
handler and cannot fall through to the app. `locate-me.net` is a separate block and
never touches the app. If the app suddenly serves `/website/…`, a catch-all /
top-level `file_server` was placed above the `/website/*` handle (see Troubleshooting).

### P5 – Validate + (re)load Caddy

Validate the Caddyfile (catches typos before they break the server):

```bash
docker exec caddy caddy validate --config /etc/caddy/Caddyfile
```

If you changed **only** the Caddyfile (no compose change), hot-reload it:

```bash
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
```

If you recreated the container in P3, Caddy loads the new config automatically on
start. Confirm the container is healthy:

```bash
docker compose ps
```

### P6 – Test

- Canonical content: <https://locateme.srv64.de/website/> and
  <https://locateme.srv64.de/website/index.de.html>.
- Custom domain: <https://locate-me.net/> and <https://locate-me.net/index.de.html>
  (also test `https://www.locate-me.net/`).
- The app must be unaffected: <https://locateme.srv64.de/>.
- Also verify on a smartphone: layout, EN↔DE language switch, dark-mode toggle.

---

## Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| 404 on `/website/` | Bind mount missing or container not recreated → re-check Step 2. |
| Assets (CSS/JS) 404 under `/website/` | Shipping the `../` form of links; the site must use relative links (it does). Confirm no `<base>` tag was added. |
| `/api*` broken after the change | The new `handle` blocks were placed **above** `handle /api*` in a conflicting position; order is `/api*` → `/website*` → fallback. Give `/website/*` a matcher that cannot match `/api`. |
| App suddenly serves `/website/…` (PROD `locateme.srv64.de`) | A catch-all / top-level `file_server` (or `try_files` rewrite) was placed **above** the `/website/*` `handle_path`. Enforce the order `/api*` → `/website/*` → `/website` redirect → fallback. |
| `locate-me.net` does not load / TLS error | DNS not live yet or A/CNAME missing (P1); Caddy cannot provision the certificate until the records resolve publicly. |
| Language switch missing | Open `/website/index.de.html` directly; the EN↔DE links are relative and work from any `/website/` page. |