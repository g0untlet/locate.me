# Production Upgrade: 0.2.0 -> 0.3.0 (H2 constraint fix)

Applies to any environment that already has a `locator.mv.db` database file from 0.2.0.
The current 0.3.0 backend code is fine as-is. The **DEV server was already upgraded** on
2026-08-03; this document now targets the **production** environment (currently 0.2.0).

## Why this step is necessary

Since 0.3.0, saving a location can fail with **HTTP 500**:

```
Check constraint invalid: "CONSTRAINT_B: "
Caused by: org.h2.jdbc.JdbcSQLNonTransientConnectionException: The database has been closed [90098-240]
  at org.h2.expression.condition.ConditionInConstantSet.getValue(...)
```

Root cause: **H2 2.4.240 regression** (H2 issues #4302 / #4308, fix unreleased). Hibernate
generates `CHECK (... IN (...))` constraints for the enum columns `weather_code` and `tag`.
When the connection that first evaluates such a constraint is closed by the connection pool
(typically after ~5 minutes of idle), the next insert from a new connection crashes with
`90098`. The failure is timing-dependent: saves work right after a restart, then start
failing once the pool has recycled an idle connection.

The 0.3.0 code no longer adds a `tag` CHECK during schema migration, so the only remaining
source of the problem is the CHECK constraint(s) already present in the existing database
file. They must be removed **once per existing database**.

## Before you start

- Backend stopped (the H2 file is locked while the backend runs).
- A `locator-service-0.3.0-runner.jar` build available on the target machine. The JAR is also
  used as the H2 Shell host in steps 3-5 and 7, so it must be copied to the machine before those steps.
- The production backend is currently 0.2.0 on port **8080**; the DEV backend is 0.3.0 on
  port **8090**. All `curl` examples below are port-agnostic unless noted.
- A backup of the database file (see step 2).

## Steps

### 1. Stop the backend

```bash
# on the target machine, in the terminal where the backend runs: Ctrl+C
# or, using the management scripts (currently hardcoded to the running version):
/home/gauntlet/homelab/stop-locateme-backend.sh prod
# or manually:
pgrep -f locator-service
kill <PID>
```

### 2. Back up the database

```bash
cd <backend-install-dir>          # the directory containing ./data/locator.mv.db
cp data/locator.mv.db data/locator.mv.db.bak-0.2.0
```

### 3. Find the CHECK constraints on the `positions` table

H2's `org.h2.tools.Shell` is bundled in the runner JAR, so no separate H2 download is needed:

```bash
java -cp locator-service-0.3.0-runner.jar org.h2.tools.Shell \
  -url "jdbc:h2:file:./data/locator" -user sa -password sa \
  -sql "SELECT cc.CONSTRAINT_NAME, cc.CHECK_CLAUSE
        FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
        JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
          ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
         AND cc.CONSTRAINT_NAME   = tc.CONSTRAINT_NAME
        WHERE tc.TABLE_NAME = 'POSITIONS' AND tc.CONSTRAINT_TYPE = 'CHECK'"
```

Expected output (constraint names may differ from run to run):

```
CONSTRAINT_B   | "WEATHER_CODE" IN(...)
CONSTRAINT_BD8 | "TAG" IN(...)          <- only if the DB was migrated by an earlier 0.3.0 build
```

### 4. Drop each CHECK constraint

Run one `ALTER` per constraint found in step 3, **one Shell invocation per statement**
(Shell only shows the last result when multiple `-sql` arguments are given):

```bash
java -cp locator-service-0.3.0-runner.jar org.h2.tools.Shell \
  -url "jdbc:h2:file:./data/locator" -user sa -password sa \
  -sql "ALTER TABLE positions DROP CONSTRAINT CONSTRAINT_B"
```

```bash
java -cp locator-service-0.3.0-runner.jar org.h2.tools.Shell \
  -url "jdbc:h2:file:./data/locator" -user sa -password sa \
  -sql "ALTER TABLE positions DROP CONSTRAINT CONSTRAINT_BD8"
```

### 5. Verify no CHECK constraints remain on `positions`

```bash
java -cp locator-service-0.3.0-runner.jar org.h2.tools.Shell \
  -url "jdbc:h2:file:./data/locator" -user sa -password sa \
  -sql "SELECT COUNT(*) FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
        JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
          ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
         AND cc.CONSTRAINT_NAME   = tc.CONSTRAINT_NAME
        WHERE tc.TABLE_NAME = 'POSITIONS' AND tc.CONSTRAINT_TYPE = 'CHECK'"
```

Expected: `0`. Also confirm the data is intact:

```bash
java -cp locator-service-0.3.0-runner.jar org.h2.tools.Shell \
  -url "jdbc:h2:file:./data/locator" -user sa -password sa \
  -sql "SELECT COUNT(*) FROM POSITIONS"
```

### 6. Deploy and start 0.3.0

The management scripts hardcode the JAR filename per environment (`start-locateme-backend.sh`
currently expects `locator-service-0.2.0-runner.jar` for prod, `locator-service-0.3.0-runner.jar`
for dev). To avoid silently starting the old 0.2.0 backend again:

1. Update `start-locateme-backend.sh` and `stop-locateme-backend.sh` so the prod paths use
   `locator-service-0.3.0-runner.jar` (the DEV entries are already on 0.3.0).
2. Remove the old JAR so it cannot be picked up:
   ```bash
   cd /home/gauntlet/homelab/locate.me/backend
   rm locator-service-0.2.0-runner.jar
   ```
3. Copy `locator-service-0.3.0-runner.jar` into the backend directory (it was already needed
   for the Shell steps above).
4. Start the backend with the management script:
   ```bash
   /home/gauntlet/homelab/start-locateme-backend.sh prod
   ```

On startup, Hibernate adds the new 0.3.0 columns (`tag`, `comment`, `elevation`, `uv_index`)
to the existing table. It does **not** re-add the dropped CHECK constraints (verified against
the production-style database).

Note: Hibernate creates the `tag` column as an H2 **native `ENUM`** whose allowed values are
fixed when the column is created. It accepts the current 0.3.0 tag vocabulary, but any future
change to `PositionTag` would make saves fail with HTTP 500 unless the column is converted to
`VARCHAR` — that is done in step 7.

### 7. Convert the `tag` column from native `ENUM` to `VARCHAR`

The `tag` column created in step 6 is an H2 native `ENUM`. Converting it to a plain `VARCHAR`
makes the column independent of the enum's value list, so future tag additions, renames or
removals in `PositionTag` never require another schema change. This is a **one-time**
conversion per database file.

Stop the backend (the H2 file is locked while the backend runs), then alter the column:

```bash
/home/gauntlet/homelab/stop-locateme-backend.sh prod

cd /home/gauntlet/homelab/locate.me/backend
java -cp locator-service-0.3.0-runner.jar org.h2.tools.Shell \
  -url "jdbc:h2:file:./data/locator" -user sa -password sa \
  -sql "ALTER TABLE positions ALTER COLUMN tag SET DATA TYPE VARCHAR(32) USING (CAST(tag AS VARCHAR));"
```

Verify the column type is now `CHARACTER VARYING` (if it already is, the ALTER was not needed
and can be skipped):

```bash
java -cp locator-service-0.3.0-runner.jar org.h2.tools.Shell \
  -url "jdbc:h2:file:./data/locator" -user sa -password sa \
  -sql "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'POSITIONS' AND COLUMN_NAME = 'TAG'"
```

Restart the backend:

```bash
/home/gauntlet/homelab/start-locateme-backend.sh prod
```

### 8. Verify the fix

```bash
curl -s http://localhost:8080/q/health/ready
```

Expect `"status": "UP"`. Then save a location with a tag (this previously produced the 500):

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST 'http://localhost:8080/api/positions?userId=user123' \
  -H 'Content-Type: application/json' \
  -d '{"userId":"user123","latitude":48.1351,"longitude":11.5820,"tag":"WORK","timestamp":"2026-08-03T00:00:00Z"}'
```

Expect `201`. For full confidence, save a second location after more than 5 minutes of
idle — that was the exact failure window.

Finally, verify a tag that did **not** exist in the pre-0.3.0 vocabulary saves cleanly
(`HOME` was added in the 2026-08-11 revision) — this proves the `VARCHAR` conversion works:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST 'http://localhost:8080/api/positions?userId=user123' \
  -H 'Content-Type: application/json' \
  -d '{"userId":"user123","latitude":52.52,"longitude":13.405,"tag":"HOME","timestamp":"2026-08-11T00:00:00Z"}'
```

Expect `201`.

## Important notes

- The constraint drop is **one-time per database file**. Hibernate's `database.generation=update`
  never re-adds constraints to an existing table.
- A **brand-new** database (fresh file, first start of 0.3.0) will contain the enum CHECK
  constraints again and must be cleaned with steps 3-5 once. Its `tag` column will again be
  created as a native `ENUM`, so the step 7 conversion is also needed once if the tag
  vocabulary may change later.
- The **DEV server** was cleaned on 2026-08-03 (both constraints dropped, 0.3.0 deployed,
  save after >10 min idle verified) and additionally had its `tag` column converted to
  `VARCHAR` on 2026-08-11 (step 7). No further action needed there.
- If you ever revert to H2 < 2.4.240 the bug is absent, but this document assumes the
  standard 2.4.240 that ships with Quarkus 3.33.x.
