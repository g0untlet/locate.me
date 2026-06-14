//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.locator.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class WeatherCodeConverter implements AttributeConverter<WeatherCode, Integer> {

    @Override
    public Integer convertToDatabaseColumn(WeatherCode attribute) {
        if (attribute == null) {
            return null;
        }
        return attribute.code();
    }

    @Override
    public WeatherCode convertToEntityAttribute(Integer dbData) {
        if (dbData == null) {
            return null;
        }
        return WeatherCode.fromCode(dbData);
    }
}
