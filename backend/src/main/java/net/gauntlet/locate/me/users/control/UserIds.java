//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.control;

import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import net.gauntlet.locate.me.Control;
import net.gauntlet.locate.me.security.AuthErrors;

/**
 * Validation and normalization of user identifiers.
 *
 * <p>New registrations are normalized to lower case and validated against the
 * registration rules. Legacy identifiers imported from {@code allowed.user.ids}
 * are never rewritten: changing their spelling would detach existing business
 * data, so they are only trimmed and preserved as-is.
 */
@Control
public class UserIds {

    static final Pattern NEW_USER_ID = Pattern.compile("[a-z0-9_-]{3,32}");

    static final int MIN_LENGTH = 3;
    static final int MAX_LENGTH = 32;

    static final Set<String> RESERVED = Set.of(
            DemoUserPolicy.DEMO_USER_ID,
            "admin",
            "administrator",
            "root",
            "system",
            "api",
            "null",
            "undefined");

    /**
     * Normalizes and validates an identifier for a new registration.
     * Whitespace around the value is rejected, not trimmed, so a client typo
     * never silently becomes a different account name.
     */
    public String normalizeForRegistration(String raw) {
        if (raw == null || raw.isBlank()) {
            throw AuthErrors.badRequest("userId is mandatory");
        }
        if (!raw.equals(raw.strip())) {
            throw AuthErrors.badRequest("userId must not start or end with whitespace");
        }
        String normalized = raw.toLowerCase(Locale.ROOT);
        if (normalized.length() < MIN_LENGTH || normalized.length() > MAX_LENGTH
                || !NEW_USER_ID.matcher(normalized).matches()) {
            throw AuthErrors.badRequest(
                    "userId must be 3-32 characters of lowercase letters, digits, hyphens or underscores");
        }
        if (isReserved(normalized)) {
            throw AuthErrors.badRequest("userId is reserved");
        }
        return normalized;
    }

    /**
     * Normalizes an identifier for a case-insensitive lookup. Returns null for
     * missing values so callers can produce their own error.
     */
    public String normalizeForLookup(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return raw.strip().toLowerCase(Locale.ROOT);
    }

    public boolean isReserved(String normalizedUserId) {
        return normalizedUserId != null && RESERVED.contains(normalizedUserId);
    }
}
