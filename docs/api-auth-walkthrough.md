# API Auth Walkthrough (`mvn quarkus:dev`)

Copy-paste walkthrough of the account, JWT and admin API against a local Quarkus
dev server. It is written to be run block by block, in order, in the same shell.

**Prerequisites**

- `curl` and `jq` (`sudo apt install curl jq`).
- The backend running locally in another terminal:

```bash
cd backend
AUTH_RATE_LIMIT_LOGIN_PERMITTED_USES=50 mvn quarkus:dev
```

The dev profile uses an **in-memory H2 database**, so every restart starts with the
fixtures from `%dev.allowed.user.ids` (`validUser`, `noAccuracyUser`, `geoUser`,
`geoFailUser`, `stUser`, `legacyHero`, `adminUser`, `user123`) in their unmigrated
state. If a step returns `409` because it already ran, stop dev mode, start it again
and re-run the walkthrough. The raised login bucket (`50`) is only so the walkthrough's
several logins do not trip the default 5/min limit; the rate-limit section restarts
with the defaults.

`mvn quarkus:dev` needs ~20 s to start and keeps its terminal in the foreground, so
run the curl blocks in a **second terminal** and define the variables there. Wait until
the dev terminal prints `Listening on: http://0.0.0.0:8090`, or use the readiness loop
below (`000` instead of an HTTP status means the server is not reachable).

`GEOAPIFY_API_KEY` is not needed for this walkthrough.

> **Never run this against PROD.** `POST /auth/claim` is irreversible: it gives the
> account a password and ends the legacy `?userId=` access for it. The ids used here
> are dev fixtures.

## Variables

```bash
BASE=http://localhost:8090/api
J='Content-Type: application/json'

# Wait until the dev server answers (first start and after every restart below).
for i in $(seq 1 60); do curl -sf "$BASE/system/info" >/dev/null && break; sleep 1; done
curl -sS "$BASE/system/info" | jq -r .version    # must print 0.5.0
```

Every section that restarts dev mode repeats this wait and re-declares `BASE`/`J`, so
it can be pasted unchanged into a fresh second terminal.

All login/register/claim responses have the shape
`{"token","tokenType","userId","expiresAt"}`; `jq -r .token` extracts the token.

## 0. Service check

```bash
curl -sS "$BASE/system/info" | jq
# { "artifactId": "locator-service", "version": "0.5.0", "startupTime": "…" }
```

## 1. The three identity modes

| Mode | How | Works for | Token |
|---|---|---|---|
| Demo | `?userId=user123`, no token | the shared demo identity only; its data is shared | never |
| Legacy | `?userId=<id>`, no token | imported accounts with `passwordHash == null`, while `AUTH_LEGACY_USERID_AUTH=true` | no |
| JWT | `Authorization: Bearer <token>` | registered/claimed accounts; `sub` is the identity | yes |

A migrated account (claim or registration) can no longer use the legacy mode, even
while the flag is on.

## 2. Demo mode

```bash
curl -sS -o /dev/null -w '%{http_code}\n' "$BASE/positions?userId=user123"
# 200
curl -sS -o /dev/null -w '%{http_code}\n' "$BASE/users/me"
# 401 (the demo user has no account and never gets a token)
```

## 3. Legacy mode before the claim

`legacyHero` is a dev fixture and starts unmigrated on every dev restart.

```bash
curl -sS "$BASE/auth/migration-status/legacyHero" | jq
# { "migrationRequired": true }

curl -sS -o /dev/null -w '%{http_code}\n' "$BASE/positions?userId=legacyHero"
# 200

# Create history that must survive the claim. The body userId is ignored; the
# resolved identity (legacyHero) is forced.
curl -sS -X POST "$BASE/positions?userId=legacyHero" -H "$J" \
  -d '{"userId":"legacyHero","latitude":48.1351,"longitude":11.5820,"accuracy":5.0,"timestamp":"2026-11-24T10:00:00Z"}' \
  | jq '{id, userId, timestamp}'
```

## 4. Register and log in a new account

No `allowed.user.ids` entry is needed for a registered account.

```bash
curl -sS -X POST "$BASE/auth/register" -H "$J" \
  -d '{"userId":"apiuser","name":"API User","password":"correct-horse-1","email":"apiuser@example.test"}' \
  | jq '{userId, tokenType, expiresAt}'
# 201 Created

TOKEN=$(curl -sS -X POST "$BASE/auth/login" -H "$J" \
  -d '{"userId":"apiuser","password":"correct-horse-1"}' | jq -r .token)

curl -sS "$BASE/users/me" -H "Authorization: Bearer $TOKEN" | jq
# userId=apiuser, status=ACTIVE, roles=["USER"], hasPassword=true, email=…
```

Inspect the token claims (`sub`, `iat`, `exp`, `iss`, `aud`, `groups`, `ver`):

```bash
python3 -c 'import base64,json,sys;p=sys.argv[1].split(".")[1];p+="="*(-len(p)%4);print(json.dumps(json.loads(base64.urlsafe_b64decode(p)),indent=2))' "$TOKEN"
```

## 5. Claim the legacy account (one-time migration)

```bash
CLAIM=$(curl -sS -X POST "$BASE/auth/claim" -H "$J" \
  -d '{"userId":"legacyHero","password":"legacy-password-1","email":"legacyhero@example.test"}' | jq -r .token)
# 200 OK, sub = legacyHero

# The history created before the claim still belongs to the same userId:
curl -sS "$BASE/positions" -H "Authorization: Bearer $CLAIM" | jq '.[] | {id, userId}'

# The legacy query parameter is now dead for this account:
curl -sS -o /dev/null -w '%{http_code}\n' "$BASE/positions?userId=legacyHero"
# 401
curl -sS "$BASE/auth/migration-status/legacyHero" | jq
# { "migrationRequired": false }

# A second claim is rejected:
curl -sS -o /dev/null -w '%{http_code}\n' -X POST "$BASE/auth/claim" -H "$J" \
  -d '{"userId":"legacyHero","password":"legacy-password-1","email":"legacyhero@example.test"}'
# 409
```

## 6. Self-service (`/users/me`)

Only `name` may change; `userId`, `email`, `roles` and `status` in the body are ignored.

```bash
curl -sS -X PUT "$BASE/users/me" -H "Authorization: Bearer $TOKEN" -H "$J" \
  -d '{"name":"API User 2","userId":"hacker","roles":["ADMIN"],"status":"DISABLED","email":"x@example.test"}' \
  | jq
# userId=apiuser, roles=["USER"], status=ACTIVE, email unchanged, name="API User 2"
```

Password change (current password required), and its token side effect:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X PUT "$BASE/users/me/password" \
  -H "Authorization: Bearer $TOKEN" -H "$J" \
  -d '{"currentPassword":"wrong","password":"another-horse-2"}'
# 401

curl -sS -o /dev/null -w '%{http_code}\n' -X PUT "$BASE/users/me/password" \
  -H "Authorization: Bearer $TOKEN" -H "$J" \
  -d '{"currentPassword":"correct-horse-1","password":"another-horse-2"}'
# 204

# The credential generation changed, so the token used for the change is dead:
curl -sS -o /dev/null -w '%{http_code}\n' "$BASE/users/me" -H "Authorization: Bearer $TOKEN"
# 401

TOKEN=$(curl -sS -X POST "$BASE/auth/login" -H "$J" \
  -d '{"userId":"apiuser","password":"another-horse-2"}' | jq -r .token)
```

Recovery email (current password required, case-insensitive uniqueness):

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X PUT "$BASE/users/me/recovery-email" \
  -H "Authorization: Bearer $TOKEN" -H "$J" \
  -d '{"currentPassword":"another-horse-2","email":"New-APiUser@Example.test"}'
# 204

curl -sS "$BASE/users/me" -H "Authorization: Bearer $TOKEN" | jq '.email'
# "new-apiuser@example.test"
```

## 7. Admin flow

`adminUser` is a dev fixture with the ADMIN role. Claim it on first use:

```bash
ADMIN=$(curl -sS -X POST "$BASE/auth/claim" -H "$J" \
  -d '{"userId":"adminUser","password":"admin-password-1","email":"admin@example.test"}' | jq -r .token)

curl -sS "$BASE/users/me" -H "Authorization: Bearer $ADMIN" | jq '{userId, roles}'
# userId="adminUser", roles=["ADMIN","USER"]

curl -sS "$BASE/users" -H "Authorization: Bearer $ADMIN" \
  | jq -r '.[] | [.userId, .status, (.hasPassword|tostring), (.roles|join(","))] | @tsv'
# hasPassword=false marks accounts that still need to claim
```

Create, update and reset an account:

```bash
curl -sS -X POST "$BASE/users" -H "Authorization: Bearer $ADMIN" -H "$J" \
  -d '{"userId":"managed1","name":"Managed","password":"managed-pass-1","email":"managed1@example.test","roles":["USER"]}' \
  | jq '{userId, status, roles, hasPassword}'

# Allowed fields: name, email, status, roles. A conflicting userId is rejected.
curl -sS -X PUT "$BASE/users/managed1" -H "Authorization: Bearer $ADMIN" -H "$J" \
  -d '{"name":"Renamed","status":"ACTIVE","email":"managed1@example.test"}' | jq '{userId, name, status}'

curl -sS -o /dev/null -w '%{http_code}\n' -X PUT "$BASE/users/managed1" \
  -H "Authorization: Bearer $ADMIN" -H "$J" -d '{"userId":"other"}'
# 409

MT=$(curl -sS -X POST "$BASE/auth/login" -H "$J" \
  -d '{"userId":"managed1","password":"managed-pass-1"}' | jq -r .token)

curl -sS -o /dev/null -w '%{http_code}\n' -X PUT "$BASE/users/managed1/password" \
  -H "Authorization: Bearer $ADMIN" -H "$J" -d '{"password":"managed-pass-2"}'
# 204

# All earlier tokens of that account are dead; the old password no longer works.
curl -sS -o /dev/null -w '%{http_code}\n' "$BASE/users/me" -H "Authorization: Bearer $MT"
# 401
curl -sS -o /dev/null -w '%{http_code}\n' -X POST "$BASE/auth/login" -H "$J" \
  -d '{"userId":"managed1","password":"managed-pass-1"}'
# 401
curl -sS -o /dev/null -w '%{http_code}\n' -X POST "$BASE/auth/login" -H "$J" \
  -d '{"userId":"managed1","password":"managed-pass-2"}'
# 200
```

Deactivate / reactivate and the last-admin guard:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X DELETE "$BASE/users/managed1" \
  -H "Authorization: Bearer $ADMIN"
# 204

curl -sS "$BASE/users/managed1" -H "Authorization: Bearer $ADMIN" | jq '.status'
# "DISABLED" (the account and its data stay)

curl -sS -o /dev/null -w '%{http_code}\n' -X PUT "$BASE/users/managed1" \
  -H "Authorization: Bearer $ADMIN" -H "$J" -d '{"status":"ACTIVE"}'
# 200

# The last active administrator cannot be deactivated:
curl -sS -o /dev/null -w '%{http_code}\n' -X DELETE "$BASE/users/adminUser" \
  -H "Authorization: Bearer $ADMIN"
# 409

# A normal user token is forbidden on admin endpoints:
curl -sS -o /dev/null -w '%{http_code}\n' "$BASE/users" -H "Authorization: Bearer $TOKEN"
# 403
```

## 8. Claim gate (PROD before the frontend is live)

Stop dev mode, then start it with the claim disabled:

```bash
AUTH_CLAIM_ENABLED=false mvn quarkus:dev
```

In the second terminal, re-declare the variables and wait for readiness:

```bash
BASE=http://localhost:8090/api
J='Content-Type: application/json'
for i in $(seq 1 60); do curl -sf "$BASE/system/info" >/dev/null && break; sleep 1; done
curl -sS "$BASE/system/info" | jq -r .version    # must print 0.5.0
```

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X POST "$BASE/auth/claim" -H "$J" \
  -d '{"userId":"validUser","password":"valid-password-1","email":"valid@example.test"}'
# 503

curl -sS "$BASE/auth/migration-status/validUser" | jq
# { "migrationRequired": true } — the state probe still works

curl -sS -o /dev/null -w '%{http_code}\n' -X POST "$BASE/auth/register" -H "$J" \
  -d '{"userId":"gateuser","name":"Gate","password":"gate-password-1","email":"gate@example.test"}'
# 201 — registration is not gated
```

Restart normally afterwards (`AUTH_RATE_LIMIT_LOGIN_PERMITTED_USES=50 mvn quarkus:dev`).

## 9. Rate limits and the account cooldown

Stop dev mode and start it **without** the raised limit, so the default 5/min bucket
applies (a fresh JVM resets the in-memory buckets):

```bash
mvn quarkus:dev
```

Second terminal, re-declare and wait:

```bash
BASE=http://localhost:8090/api
J='Content-Type: application/json'
for i in $(seq 1 60); do curl -sf "$BASE/system/info" >/dev/null && break; sleep 1; done
```

```bash
for i in 1 2 3 4 5 6; do
  curl -sS -o /dev/null -w '%{http_code} ' -X POST "$BASE/auth/login" -H "$J" \
    -d '{"userId":"nobody","password":"wrong"}'
done; echo
# 401 401 401 401 401 429   (the sixth response also has Retry-After)
```

To see the per-account cooldown without the per-IP bucket hiding it, restart with a
large login bucket:

```bash
AUTH_RATE_LIMIT_LOGIN_PERMITTED_USES=100 mvn quarkus:dev
```

Second terminal, re-declare and wait:

```bash
BASE=http://localhost:8090/api
J='Content-Type: application/json'
for i in $(seq 1 60); do curl -sf "$BASE/system/info" >/dev/null && break; sleep 1; done
```

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X POST "$BASE/auth/register" -H "$J" \
  -d '{"userId":"lockuser","name":"Lock","password":"lock-password-1","email":"lock@example.test"}'
# 201

for i in 1 2 3 4 5; do
  curl -sS -o /dev/null -w '%{http_code} ' -X POST "$BASE/auth/login" -H "$J" \
    -d '{"userId":"lockuser","password":"wrong"}'
done; echo
# 401 401 401 401 401

curl -sS -o /dev/null -w '%{http_code}\n' -X POST "$BASE/auth/login" -H "$J" \
  -d '{"userId":"lockuser","password":"lock-password-1"}'
# 401 — the account is in its 1-minute cooldown even with the correct password
```

## 10. Password reset by email (deferred)

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X POST "$BASE/auth/password-reset/request" \
  -H "$J" -d '{"userId":"apiuser"}'
# 501

curl -sS -o /dev/null -w '%{http_code}\n' -X POST "$BASE/auth/password-reset/confirm" \
  -H "$J" -d '{"resetToken":"x","password":"y"}'
# 501
```

## 11. Status reference

| Status | Meaning |
|---|---|
| 201 | account created (register / admin create) |
| 204 | password, recovery email, deactivation or reset applied |
| 400 | malformed input (userId, email, password policy, confirmation) |
| 401 | no/expired/stale token, wrong credentials, disabled or locked account |
| 403 | missing role (admin endpoint with a user token) or demo/disabled claim |
| 404 | unknown account |
| 409 | duplicate userId/email, body userId ≠ path userId, already claimed, last admin |
| 429 | login/registration/claim/demo rate limit or external API limit (`Retry-After`) |
| 501 | password reset by email (deferred) |
| 503 | claim temporarily disabled (`AUTH_CLAIM_ENABLED=false`) |

`000` is **not** an HTTP status: curl could not reach the server at all. In this
walkthrough it almost always means one of:

- the dev server is still starting (~20 s) or failed to start — check its terminal for
  `Listening on: http://0.0.0.0:8090`, and for a port-in-use or compile error;
- `BASE`/`J` were not defined in the terminal that ran curl (the dev server runs in the
  foreground in the other terminal) — `echo "$BASE"` must print
  `http://localhost:8090/api`;
- curl is hitting the wrong port/host.

Check connectivity with `curl -sS --max-time 3 "$BASE/system/info"` and
`ss -ltnp | grep 8090`. A claim returning `200`/`409` instead of `503` means the server
still has claim enabled (an old process, or the command was started without
`AUTH_CLAIM_ENABLED=false`).

## 12. Reset the walkthrough

Stop dev mode and start it again: the in-memory database is recreated, the
bootstrapped fixtures are unmigrated again, and the claim/register steps can be
repeated from scratch. The deployed DEV is different — it uses the file database, so
claims persist there; never claim a real account from this document.

## 13. What a deployment verification should show

- `GET /system/info` reports the expected version.
- `GET /auth/migration-status/<a-real-id>` → `true`.
- `GET /positions?userId=<a-real-id>` still returns the existing history.
- `GET /users` with an admin token lists the accounts with the expected `hasPassword`
  flags (`false` = still needs to claim).
- `POST /auth/claim` returns `503` while `AUTH_CLAIM_ENABLED=false`.
- The PWA still works against the deployment (Locate, History, Places, delete).
