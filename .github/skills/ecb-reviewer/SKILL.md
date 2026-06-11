---
name: ecb-reviewer
description: Review ECB Quarkus applications for architecture and code quality compliance. Use when asked to review, audit, or check a BCE codebase against ECB conventions. Triggers on "review ECB", "check architecture", "audit code", "BCE compliance", or requests to validate code against BCE patterns.
metadata:
  authors:
    - g0untlet
  version: "1.0.1"
  tags:
    - java
    - quarkus
    - BCE architecture
    - code review
    - architecture review
    - code audit
    - architecture audit
    - code quality
    - architecture compliance
---

# ECB Reviewer

Review ECB applications against ECB architecture and coding conventions.

## Reference

Load rules from `.github/copilot-instructions.md` (relative to repo root) before reviewing.

## Review Checklist

### Architecture (BCE Pattern)

- [ ] Package structure: `com.bmw.[application].[subsystem].[component].[boundary|control|entity]`
- [ ] BCE packages only in business components, not root package
- [ ] Boundary: thin, delegates to control, no business logic
- [ ] Control: stateless, procedural logic, `@Control` or `@Dependent`
- [ ] Entity: domain concepts, records with `toJSON()`/`fromJSON()`
- [ ] `@Transactional` only in boundary layer (documented if elsewhere)
- [ ] Virtual threads for blocking I/O, not reactive APIs
- [ ] Interfaces only for multiple implementations (no single-impl interfaces)

### Business Component Quality

- [ ] Named after domain responsibilities (no "common", "util", "foundation", "base", "core")
- [ ] 1–10 entities per BC, usually one Business Facade
- [ ] High cohesion: classes within a BC communicate heavily internally
- [ ] Low coupling: minimal imports/dependencies between BCs
- [ ] BC contains at least a boundary, control, or entity sub-package

### Naming Conventions

- [ ] Classes named after responsibilities (no `*Impl`, `*Service`, `*Manager`, `*Factory`, `*Control`, `*Creator`)
- [ ] Resources in plural (`GreetingsResource`)
- [ ] REST clients end with `Client` suffix in `-st` module
- [ ] No getters starting with "get" (use record convention)

### Dependency Injection

- [ ] Never use constructor injection
- [ ] `@Boundary` or `@ApplicationScoped` for boundary classes
- [ ] `@Control` or `@Dependent` for control classes

### Code Style

- [ ] Package-private visibility by default
- [ ] No `final` on fields or parameters
- [ ] `java.lang.System.Logger` (injection if available, otherwise declared)
- [ ] `this` for instance fields
- [ ] Method references over multiline lambdas
- [ ] Stream API over loops, no `forEach`
- [ ] `Stream.of` over `Arrays.stream`
- [ ] Try-with-resources over explicit closing
- [ ] JSON-P over JSON-B for semi-structured data

### JAX-RS

- [ ] `@Consumes`/`@Produces` on class level
- [ ] Returns `Response` not `JsonObject`
- [ ] Exceptions extend `WebApplicationException`

### Testing

- [ ] Test methods: package-private, no "test"/"should" prefix
- [ ] AssertJ assertions
- [ ] System tests in `[subsystem]-st` module
- [ ] REST client interfaces end with `Client` suffix (`GreetingsResourceClient`, not `GreetingsResource`)
- [ ] REST client interfaces return `Response`
- [ ] REST clients use `@RegisterRestClient(configKey = "service_uri")` — reuse existing config keys

### Maven Dependencies

- [ ] Prefer `quarkus-smallrye-*` for MicroProfile/Jakarta EE APIs
- [ ] Prefer Java SE → MicroProfile → Jakarta EE over external libraries
- [ ] No unnecessary dependencies (check if functionality exists in platform)
- [ ] No prohibited libraries (check against BCE standards)

### Documentation

- [ ] g0untlet copyright header present
- [ ] `package-info.java` for business components (domain focus, not BCE)

## Output Format

```markdown
## BCE Review: [component]

### Summary

[1-2 sentence overview]

### Findings

#### Architecture

- [findings or "Compliant"]

#### Business Component Quality

- [findings or "Compliant"]

#### Naming

- [findings or "Compliant"]

#### Dependency Injection

- [findings or "Compliant"]

#### Code Style

- [findings or "Compliant"]

#### JAX-RS

- [findings or "Compliant"]

#### Testing

- [findings or "Compliant"]

#### Maven Dependencies

- [findings or "Compliant"]

### Recommendations

[prioritized list of fixes, if any]
```
