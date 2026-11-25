//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.security;

/**
 * Formats request-supplied values for log lines. User identifiers are
 * user-controlled — a login attempt may contain arbitrary characters — so line
 * breaks and tabs are replaced and the value is capped, keeping one request
 * from forging additional log lines or flooding the log.
 */
public final class LogValues {

    static final int MAX_LENGTH = 64;

    private LogValues() {
    }

    public static String safe(String value) {
        if (value == null) {
            return "null";
        }
        String sanitized = value.replace('\r', '?').replace('\n', '?').replace('\t', '?');
        return sanitized.length() <= MAX_LENGTH ? sanitized : sanitized.substring(0, MAX_LENGTH) + "…";
    }
}
