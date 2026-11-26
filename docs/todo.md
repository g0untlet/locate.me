# Open Todos

Planned work only, grouped by area. When an item is implemented, add its row to
[`changelog.md`](./changelog.md) and delete the item here in the same change.

Suggested order: slice 2 → slice 3 → slice 4 (email reset can also move just
before the cutover if self-recovery is required first).

## Frontend

- [ ] **Slice 2 — account self-service** (no backend change): a Settings account
  panel for the signed-in user — userId/nickname/recovery email, rename
  (`PUT /users/me`), change password (`PUT /users/me/password`, then clear the
  session and show the login panel because the credential generation invalidates
  the token), change recovery email (`PUT /users/me/recovery-email`, 409 on
  duplicates), an explicit **sign out** (login panel for the same id, demo one
  tap away), and make the user-id field read-only while a session exists.
- [ ] **Slice 3 — migration push and cutover**: a persistent "Secure your
  account" prompt for unmigrated users who chose "Not now" (Locate/Settings
  banner → claim); remove the free-text user-id field entirely (identity comes
  from the session, the login/claim panel, or demo); flip
  `AUTH_LEGACY_USERID_AUTH=false` once the users have claimed.
  `LegacyFallbackDisabledIT` already covers the backend side.
- [ ] **DEV acceptance of slice 1 / frontend 0.5.0_rc4** (pending): claim,
  login, register and demo on a real device; 401/expiry; Settings id saved on
  blur/Enter/hide; What's New and the nickname label.

## Backend

- [ ] **Slice 4 — email-based password reset**: `V7__create_password_reset_tokens`,
  hashed single-use tokens with a 30-minute expiry, `quarkus-mailer` SMTP
  delivery, implement `/auth/password-reset/*`, frontend reset page.
- [ ] `backend-st` system tests for register/login/claim against a live backend.
- [ ] Retire `allowed.user.ids` from the start scripts once registration ships
  (existing accounts are unaffected).

## Ops / Cutover

- [ ] PROD deployment: back up `data/locator.mv.db` and the start script,
  provision the PROD JWT key pair, set `JWT_*`, `AUTH_ADMIN_USER_IDS` (claim the
  admin immediately; add a second admin), `AUTH_CLAIM_ENABLED=false`,
  `AUTH_LEGACY_USERID_AUTH=true`; deploy together with the frontend.
- [ ] Cutover: `AUTH_CLAIM_ENABLED=true`, then `AUTH_LEGACY_USERID_AUTH=false`
  after the migration push.
- [ ] Decide Swagger UI exposure in PROD
  (`quarkus.swagger-ui.always-include=true`).
- [ ] Consider Caddy edge rate limiting (TI-002) before public auth traffic.
- [ ] Review the 30-day JWT lifespan after the frontend exists.
