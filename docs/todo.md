# Open Todos

Planned work only, grouped by area. When an item is implemented, add its row to
[`changelog.md`](./changelog.md) and delete the item here in the same change.

## Frontend

- [ ] Auth slice 2: read-only identity + explicit sign-out in Settings, change-password and recovery-email forms; remove the free-text user-id field at the cutover.
- [ ] Migration push for existing users: keep the claim prompt visible until each account is migrated; keep it optional while `AUTH_LEGACY_USERID_AUTH=true`.
- [ ] Post-cutover cleanup: update the "What's new" release notes for the auth rollout.

## Backend

- [ ] Email-based password reset: `V7__create_password_reset_tokens`, hashed single-use tokens with a 30-minute expiry, `quarkus-mailer` SMTP delivery, implement `/auth/password-reset/*`, frontend reset page.
- [ ] `backend-st` system tests for register/login/claim against a live backend.
- [ ] Retire `allowed.user.ids` from the start scripts once registration ships (existing accounts are unaffected).

## Ops / Cutover

- [ ] PROD deployment: back up `data/locator.mv.db` and the start script, provision the PROD JWT key pair, set `JWT_*`, `AUTH_ADMIN_USER_IDS` (claim the admin immediately; add a second admin), `AUTH_CLAIM_ENABLED=false`, `AUTH_LEGACY_USERID_AUTH=true`; deploy together with the frontend.
- [ ] Cutover: `AUTH_CLAIM_ENABLED=true`, then `AUTH_LEGACY_USERID_AUTH=false` after the migration push.
- [ ] Decide Swagger UI exposure in PROD (`quarkus.swagger-ui.always-include=true`).
- [ ] Consider Caddy edge rate limiting (TI-002) before public auth traffic.
- [ ] Review the 30-day JWT lifespan after the frontend exists.
