//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.control;

import java.util.Locale;
import java.util.regex.Pattern;
import net.gauntlet.locate.me.Control;
import net.gauntlet.locate.me.security.AuthErrors;

/**
 * Normalization and validation of recovery email addresses. The email is only
 * ever used for password recovery; it is not a login name.
 *
 * <p>Addresses are stored lower case so the case-insensitive uniqueness rule is
 * enforced by the database constraint as well as the application check.
 */
@Control
public class Emails {

    static final int MAX_LENGTH = 254;

    static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    public String normalize(String raw) {
        if (raw == null || raw.isBlank()) {
            throw AuthErrors.badRequest("email is mandatory");
        }
        String normalized = raw.strip().toLowerCase(Locale.ROOT);
        if (normalized.length() > MAX_LENGTH || !EMAIL.matcher(normalized).matches()) {
            throw AuthErrors.badRequest("email is invalid");
        }
        return normalized;
    }
}
