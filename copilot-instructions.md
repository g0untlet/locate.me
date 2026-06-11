# GitHub Copilot – Repository Instructions (Quarkus Coding Security)

## Purpose
Provide secure-by-default code generation and guidance for Quarkus-based Java applications.
Prioritize security, maintainability, and minimal attack surface.

## General Security Principles
- NEVER hardcode secrets (API keys, passwords, tokens, certificates).
- Treat all external input as untrusted.
- Prefer secure defaults over permissive configurations.
- Avoid exposing internal implementation details in errors or responses.

## Quarkus Security Guidelines
- Use Quarkus Security framework features instead of custom security solutions.
- Prefer role-based access control using:
  - `@RolesAllowed`
  - `@DenyAll`
  - `@PermitAll`
- Always use explicit authorization checks for endpoints.
- Prefer standard authentication mechanisms (OIDC, mTLS, etc.).

## Input Validation
- Always validate input using Bean Validation (`@Valid` and constraints).
- Validate:
  - null values
  - length constraints
  - formats (email, IDs, etc.)
- Sanitize and normalize file paths to prevent path traversal attacks.

## Data Access
- NEVER build SQL queries using string concatenation with user input.
- Always use parameterized queries.
- Avoid exposing database structure in error messages.

## Logging
- NEVER log:
  - passwords
  - tokens
  - authentication headers
- Ensure logs do not contain personally identifiable or sensitive information.

## Dependencies and Vulnerabilities
- Be aware of known dependency vulnerabilities.
- Prefer secure and up-to-date versions of libraries.
- Suggest dependency scanning where appropriate (e.g. OWASP tools).

## Code Generation Rules
When generating code:
- Produce minimal, reviewable changes.
- Include secure defaults.
- Add validation and error handling.
- Prefer defensive programming patterns.

## Communication Style
When explaining code:
- Explain the security risk first.
- Then describe the mitigation.
- Keep explanations concise and actionable.

## Missing Context
If required information is missing:
- Ask for clarification instead of guessing.
- Do not invent credentials, endpoints, or configurations.
