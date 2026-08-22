//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.aroundme.control;

import jakarta.json.JsonObject;
import jakarta.json.JsonValue;

/**
 * Resolves a display name for a place from the raw Geoapify feature properties.
 * Guarantees a non-blank value via a fallback cascade so anonymous POIs still
 * get a meaningful name.
 */
public interface PlaceNames {

    String UNKNOWN_PLACE = "Unknown Place";

    /**
     * Resolves the display name with the following priority:
     * 1. properties.name (trimmed, non-blank)
     * 2. a synthetic name from the secondary (or primary) category plus the
     *    street (or city) context
     * 3. properties.address_line1
     * 4. properties.formatted
     * 5. {@link #UNKNOWN_PLACE}
     *
     * @param primaryCategory   the top-level category (may be null)
     * @param secondaryCategory the sub-category of the primary (may be null)
     */
    static String resolve(JsonObject properties, String primaryCategory, String secondaryCategory) {
        String name = string(properties, "name");
        if (isNotBlank(name)) {
            return name.trim();
        }
        String label = categoryLabel(primaryCategory, secondaryCategory);
        if (label != null) {
            String location = string(properties, "street");
            if (isBlank(location)) {
                location = string(properties, "city");
            }
            return isNotBlank(location) ? label + " (" + location + ")" : label;
        }
        String addressLine1 = string(properties, "address_line1");
        if (isNotBlank(addressLine1)) {
            return addressLine1.trim();
        }
        String formatted = string(properties, "formatted");
        if (isNotBlank(formatted)) {
            return formatted.trim();
        }
        return UNKNOWN_PLACE;
    }

    private static String categoryLabel(String primaryCategory, String secondaryCategory) {
        if (isBlank(primaryCategory)) {
            return null;
        }
        String label = isNotBlank(secondaryCategory) ? secondaryCategory : primaryCategory;
        return titleCase(label.replace('_', ' '));
    }

    private static String titleCase(String text) {
        StringBuilder result = new StringBuilder();
        for (String word : text.split("\\s+")) {
            if (word.isEmpty()) {
                continue;
            }
            if (result.length() > 0) {
                result.append(' ');
            }
            result.append(Character.toUpperCase(word.charAt(0)));
            result.append(word.substring(1));
        }
        return result.toString();
    }

    private static String string(JsonObject object, String name) {
        if (object.containsKey(name) && !object.isNull(name)) {
            JsonValue value = object.get(name);
            if (value.getValueType() == JsonValue.ValueType.STRING) {
                return object.getString(name);
            }
        }
        return null;
    }

    private static boolean isNotBlank(String value) {
        return value != null && !value.isBlank();
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
