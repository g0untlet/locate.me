---
name: bce-architecture
description: BCE architecture patterns, BCE (Boundary-Control-Entity) structure, code conventions, and development guidelines for BMW Quarkus microservices. Use when creating, scaffolding, generating, or writing code in a CA.micro project, when asking about BCE patterns, business component structure, package layout, CA.micro conventions, Quarkus microservice architecture, or when needing guidance on Java style, JAX-RS resources, testing strategy, JSON processing, or dependency injection in a BMW CA.micro context. Triggers on "CA.micro", "BCE pattern", "business component", "boundary control entity", "CA.micro conventions", "Quarkus microservice structure", "create resource", "create entity", "create boundary", "add component", or requests to follow BMW architecture patterns.
metadata:
  authors:
    - g0untlet
  version: "0.0.1"
  tags:
    - java
    - quarkus
    - BCE architecture
    - microservice architecture
    - boundary control entity
    - business component
    - code conventions
    - JAX-RS resources
    - testing strategy
---

# BCE Architecture

Quarkus-based microservice architecture following BCE patterns with Boundary-Control-Entity (BCE).

## Module Structure

- `[subsystem]/` - Main application module
- `[subsystem]-st/` - System test module with REST client interfaces and integration tests

## Package Structure

`com.bmw.[application].[subsystem].[component].[boundary|control|entity]`

- Application comprises one or more subsystems. If only one subsystem, `[subsystem]` is optional
- Top-level package (`com.g0untlet.[application].[subsystem]`) represents the application
- Business Components (BC) are Java packages representing key domain concepts
  - Named after domain responsibilities - never "common", "util", "foundation", "base", "core"
  - Maximal Cohesion, Minimal Coupling: classes communicate heavily within BC, minimize cross-BC communication
  - A minimalistic CRUD BC: 1-10 entities, usually one Business Facade
  - Each BC contains BCE sub-packages (boundary, control, entity)
  - BCE packages only in business components, not in root application package
- A CA.micro application contains at least one BC

## BCE Pattern

### Boundary (`boundary/`)

Business Facades (BF): perimeter between external calls and internal logic.

- JAX-RS resources, coarse-grained APIs using `@Boundary` or `@RequestScoped`
- Thin layer that delegates to control - no complex logic
- Health checks placed here
- Named after responsibilities (not starting with "Service")
- `@Transactional` only here (if elsewhere, document why in JavaDoc)

### Control (`control/`)

Business Activities (BA): product of refactoring complex BFs.

- Procedural logic with finer-grained methods, stateless
- `@Control` or `@Dependent`, or interface with only static methods
- Can integrate external systems (e.g., inject MicroProfile REST client)
- Includes supporting classes like enums or exceptions

### Entity (`entity/`)

Business Entities (BE): key domain concepts with persistent state and behavior.

- Optional persistence (usually persistent), state + domain logic
- Recommended over map-like structures for type-safety
- Can be Java records serializing state into `JsonObject`
- DTOs only when structure significantly differs from entities
- Model value objects as enums
- Records provide `toJSON()` returning `JsonObject` and static `fromJSON(JsonObject)` factory

Not every component needs a boundary - control can be accessed directly by other components.

## Java Style (Java 21)

- Use `var`, pattern matching, text blocks, records
- Logger: `java.lang.System.Logger` (never `java.util.logging.Logger`) - inject if available, otherwise:
  `static final System.Logger LOG = System.getLogger(ClassName.class.getName());`
- `List.of()`, Stream API, `toList()` over loops; `Stream.of` over `Arrays.stream`; avoid `forEach`
- No `final` on fields or parameters
- Package-private by default (avoid private unless necessary, never in tests)
- Method references over multiline lambdas - extract to well-named helper if lambda needs braces
- Import statements over fully qualified names
- DRY: extract repeated calculations into helper methods
- Unchecked over checked exceptions; don't re-throw without adding value
- Use `this` for instance fields
- Try-with-resources over explicit closing

## Class Design

- Name after responsibilities, not patterns (no `*Impl`, `*Service`, `*Manager`, `*Factory`)
- No `*Control`, `*Creator` (use plural instead); `*Builder` only for method chaining
- Interfaces only for multiple implementations (strategy pattern)
- Records for immutable data with factory methods instead of null parameters
- No getters starting with "get" - use record convention (`message()` not `getMessage()`)

## Dependency Injection

- Never use constructor injection
- `@Boundary` or `@ApplicationScoped` for boundary classes
- `@Control` or `@Dependent` for control classes
- `@Boundary` and `@Control` stereotypes live in root package `com.bmw.[application].[subsystem]`
  - `Boundary.java` applies `@RequestScoped` stereotype for facades
  - `Control.java` applies `@Dependent` stereotype for business logic

## JAX-RS Resources

- Named in plural: `GreetingsResource`
- Thin - delegate to control layer
- `@Consumes` and `@Produces` on class level
- Return `Response` over `JsonObject`
- Exceptions inherit from `WebApplicationException`; use `BadRequestException` for BAD_REQUEST
- `@Metered(absolute = true)` on endpoints for torture test metrics

## Testing

### Types

- Unit tests: `*Test.java` - Surefire
- Integration tests: `*IT.java` in main module - `@QuarkusTest`, Failsafe
- System tests: `*IT.java` in `-st` module - test running service via REST client

### Conventions

- Method names: no "test" or "should" prefix, package-private
- AssertJ assertions, not JUnit
- Skip tests for trivial code (getters, records, enums)
- Up to 3 tests per feature: happy path, error case, edge case

### System Test Module

- REST client interfaces in `src/main/java` (reusable)
- All interfaces MUST end with `Client` suffix: `GreetingsResourceClient` not `GreetingsResource`
- `@RegisterRestClient(configKey = "service_uri")` - reuse existing configKeys
- `application.properties`: `service_uri/mp-rest/url=http://localhost:8080`
- REST client methods return `Response`

### Commands

```bash
cd [subsystem] && mvn compile quarkus:dev                              # Dev mode
cd [subsystem] && mvn package && java -jar target/quarkus-app/quarkus-run.jar  # Build & run
cd [subsystem] && mvn test                                             # Unit tests
cd [subsystem] && mvn failsafe:integration-test                        # Integration tests
cd [subsystem]-st && mvn compile failsafe:integration-test             # System tests
cd [subsystem]-st && mvn compile -Dverify.results=true failsafe:integration-test  # With stress
```

## JSON Processing (JSON-P)

- Prefer JSON-P (`jakarta.json`) over JSON-B for semi-structured data and API evolution
- `JsonPointer` (RFC 6901) to extract data from large JSON structures
- Map JSON-P to entities in boundary layer before passing to control

## Configuration

- Properties in `application.properties` - inject with `@ConfigProperty`
- Swagger UI enabled in production: `quarkus.swagger-ui.always-include=true`

## Key Dependencies

- Quarkus 3.{LATEST}, Java 21, MicroProfile (metrics, health, config, fault-tolerance, OpenAPI)
- `quarkus-rest-jsonb` for REST with JSON-B, `quarkus-smallrye-openapi`, `quarkus-smallrye-health`, `quarkus-smallrye-metrics`, `quarkus-smallrye-fault-tolerance`
- Prefer `quarkus-smallrye-*` for MicroProfile/Jakarta EE APIs
- Prefer Java SE > MicroProfile > Jakarta EE built-in features over external libraries
- AssertJ for assertions, Maven Failsafe for integration/system tests
- Virtual threads for blocking I/O, not reactive APIs
- Edit `pom.xml` only with explicit approval

## Documentation

- g0untlet copyright header on all files:

```java
//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
```

- `package-info.java` for BCs: document domain responsibilities, not BCE pattern
- Don't create `package-info.java` for trivial components with obvious meaning
- JavaDoc explains "why", never rephrases code
