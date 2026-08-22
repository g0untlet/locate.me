//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.aroundme.control;

/**
 * Resolves the client's primary language from the HTTP Accept-Language header
 * into a lowercased 2-letter ISO 639-1 code used as the Geoapify lang parameter.
 */
public interface ClientLanguage {

    String DEFAULT_LANG = "en";

    /**
     * Returns the highest-weighted 2-letter language code from the given
     * Accept-Language header. Regional sub-tags are stripped and the result is
     * lowercased. Falls back to {@link #DEFAULT_LANG} when the header is
     * missing, empty, or contains no parseable language range.
     */
    static String fromAcceptLanguage(String acceptLanguageHeader) {
        if (acceptLanguageHeader == null || acceptLanguageHeader.isBlank()) {
            return DEFAULT_LANG;
        }
        String[] parts = acceptLanguageHeader.split(",");
        double bestQ = -1.0;
        int bestOrder = Integer.MAX_VALUE;
        String best = DEFAULT_LANG;
        for (int i = 0; i < parts.length; i++) {
            String part = parts[i].trim();
            if (part.isEmpty()) {
                continue;
            }
            String langTag = part;
            double q = 1.0;
            int semicolon = part.indexOf(';');
            if (semicolon >= 0) {
                langTag = part.substring(0, semicolon).trim();
                for (String param : part.substring(semicolon + 1).split(";")) {
                    String trimmed = param.trim();
                    if (trimmed.startsWith("q=")) {
                        try {
                            q = Double.parseDouble(trimmed.substring(2));
                        } catch (NumberFormatException e) {
                            q = -1.0;
                        }
                    }
                }
            }
            if (q < 0) {
                continue;
            }
            String code = langTag.split("-")[0].trim().toLowerCase();
            if (!code.matches("[a-z]{2}")) {
                continue;
            }
            if (q > bestQ || (q == bestQ && i < bestOrder)) {
                bestQ = q;
                bestOrder = i;
                best = code;
            }
        }
        return best;
    }
}
