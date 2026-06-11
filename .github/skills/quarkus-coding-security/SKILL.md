---
name: quarkus-coding-security
description: Provides security-focused code review, threat analysis, and remediation guidance for Quarkus-based Java applications. Use for vulnerability detection, secure coding, authentication, authorization, and dependency security.
metadata:
  authors:
    - g0untlet
  version: "0.0.1"
  tags:
    - java
    - quarkus
    - security
    - BCE architecture
---

# Quarkus Coding Security Skill

## Mission
Analyze, detect, and remediate security issues in Quarkus-based applications.
Provide actionable, minimal, and safe fixes.

## When to Use
Activate this skill when:
- Reviewing Java or Quarkus code
- Generating secure APIs or services
- Investigating vulnerabilities (authentication, authorization, injection)
- Hardening application security

## Workflow

### 1. Context Assessment
If missing, ask for:
- Endpoint or service context
- Authentication mechanism (e.g. OIDC, JWT)
- Authorization model (roles/permissions)
- Sensitive data involved

### 2. Threat Analysis
Inspect:
- REST endpoints (inputs, headers, query params)
- Authorization annotations (`@RolesAllowed`, etc.)
- Configuration (CORS, TLS, cookies)
- Serialization/deserialization and file handling

### 3. Identify Vulnerabilities
Classify findings:

- **Critical**
  - Injection vulnerabilities
  - Authentication bypass
  - Secret leakage

- **High**
  - Missing authorization checks
  - Insecure configuration
  - Data exposure risks

- **Medium / Low**
  - Missing validation
  - Weak defaults
  - Improvement opportunities

Each finding must include:
- Location
- Risk description
- Suggested fix

### 4. Apply Fixes
- Provide minimal, focused code changes
- Use secure Quarkus patterns
- Do not introduce breaking changes unnecessarily

### 5. Add Validation
- Suggest or generate tests (unit or integration)
- Validate:
  - authentication enforcement
  - authorization rules
  - input validation

### 6. Dependency Security
If applicable:
- Highlight outdated or vulnerable dependencies
- Suggest secure alternatives or updates

## Output Format

1. **Summary**
2. **Findings (grouped by severity)**
3. **Proposed fixes**
4. **Test recommendations**
5. **Residual risks**

## Rules (MUST / MUST NOT)

### MUST
- Use least privilege principle
- Prefer built-in Quarkus security mechanisms
- Provide clear and explainable fixes

### MUST NOT
- Generate or expose secrets
- Disable security mechanisms without justification
- Use insecure patterns (e.g. raw queries, hardcoded credentials)

## Example Fix Pattern

### Problem
User input used directly in SQL

### Fix
Use parameterized queries:

```java
// BAD
String query = "SELECT * FROM users WHERE name = '" + name + "'";

// GOOD
PreparedStatement stmt = connection.prepareStatement(
    "SELECT * FROM users WHERE name = ?"
);
stmt.setString(1, name);
