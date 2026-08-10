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
1. Read docs/functional-scope.md before making changes.
2. Read docs/technical-landscape.md before making changes.


# Functional Scope Maintenance

After implementation:
1. Update all affected sections.
2. Add new features to "Functional Areas".
3. Add new screens to "User Interface".
4. Add new REST endpoints to "Backend Services".
5. Add new entities to "Business Objects".
6. Update "BCE Classification".
7. Update the Change Log.
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
