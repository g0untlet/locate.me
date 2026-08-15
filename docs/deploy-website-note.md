# locate.me – Website: DEV Deployment & Serving

This note explains how to deploy the static marketing/install website (`./website`)
to the DEV server and serve it under `https://locateme-dev.folger.home64.de/website/`.

The website is deployed to a **dedicated folder** (`/home/gauntlet/homelab/locate.me.dev/website/`)
next to the frontend. Nothing of the app (frontend, backend, data) is touched.
A section at the bottom prepares the same setup for PROD (`locate-me.net`).

> **Domains:** The **app** (DEV: `locateme-dev.folger.home64.de`, PROD: `locateme.srv64.de`)
> is a separate thing from the **static website**. Only the static website will be served
> under its own domain in PROD: `https://locate-me.net/`.

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

## Ready for PROD (later)

In PROD the **static website gets its own domain**: `https://locate-me.net/` (served at
the root). The **app** stays at `https://locateme.srv64.de/` – its Caddy block keeps
serving the app only and is not touched for website serving. The old idea of serving the
website under a `/website/` subpath on the app domain is superseded. Nothing below is
active yet – it is a preparation checklist.

1. **Deploy target.** Create `deploy-website-prod.sh` as a copy of `deploy-website-dev.sh`,
   changing `REMOTE_HOST` and `REMOTE_TARGET_DIR` to the PROD site folder, e.g.
   `REMOTE_TARGET_DIR="/home/gauntlet/homelab/locate-me.net/website/"`.
   > **TODO:** confirm the PROD server host and site folder before launch.
   All safety guards, comments and the `SAFETY_DIR_NAME` logic are reusable unchanged.
2. **Mount.** In the Caddy `docker-compose.yml` add:
   ```yaml
         - /home/gauntlet/homelab/locate-me.net/website:/var/www/locate-me.net/website  #locate-me.net static website
   ```
   then `docker compose up -d`.
3. **Caddy route.** Add a dedicated site block for the website serving the folder at the
   **root** – no `/website/` `handle_path` needed:
   ```
   locate-me.net {
       root * /var/www/locate-me.net/website
       file_server
   }
   ```
   The `/website/`-specific notes and troubleshooting rows below do **not** apply here.
4. **Validate/reload/test** exactly as Steps 4–5, with the PROD URLs:
   <https://locate-me.net/> and <https://locate-me.net/index.de.html>.

---

## Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| 404 on `/website/` | Bind mount missing or container not recreated → re-check Step 2. |
| Assets (CSS/JS) 404 under `/website/` | Shipping the `../` form of links; the site must use relative links (it does). Confirm no `<base>` tag was added. |
| `/api*` broken after the change | The new `handle` blocks were placed **above** `handle /api*` in a conflicting position; order is `/api*` → `/website*` → fallback. Give `/website/*` a matcher that cannot match `/api`. |
| Language switch missing | Open `/website/index.de.html` directly; the EN↔DE links are relative and work from any `/website/` page. |