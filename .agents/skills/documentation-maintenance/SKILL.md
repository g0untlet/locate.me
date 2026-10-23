---
name: documentation-maintenance
description: 
  Skill for maintaining the documentation of the locate.me Vanilla JS PWA frontend (progessive web app) 
  with the Quarkus backend using BCE architecture.
metadata:
  authors:
    - g0untlet
  version: "0.0.2"
  tags:
    - documentation
    - functional-scope
    - technical-landscape
---

# Scope Maintenance

When implementing a feature:
1. Consult the relevant section(s) of `docs/functional-scope.md` and `docs/technical-landscape.md` — use the heading outline and grep; read only what the change touches.
2. Read a whole document only when the change spans the whole subsystem.


# Functional Scope Maintenance

After implementation:
1. Update all affected sections.
2. Add new features to "Functional Areas".
3. Add new screens to "User Interface".
4. Add new REST endpoints to "Backend Services".
5. Add new entities to "Business Objects".
6. Update "BCE Classification".
7. Update the relevant section of `docs/changelog.md` (Technical or Functional) — the file is large, read only the section you update.
8. Report all modified sections in the final summary.

Never introduce undocumented functionality.


# Technical Documentation Maintenance

After implementation:

1. Update docs/technical-landscape.md only when 
- a REST endpoint changes
- a database table changes
- an entity changes
- an BCE component changes
- an external interface changes
- a new module is introduced
2. Keep BCE classification up-to-date.
3. Report modified sections in the implementation summary.
4. Never introduce architectural elements that are not documented.

Never break the BCE architecture. 
