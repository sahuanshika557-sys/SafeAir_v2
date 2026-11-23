import { describe, expect, it } from 'vitest';
import {
  clampAqi,
  createManualAirQualityReading,
  formatAqiTimestamp,
  getAqiCategory,
  pm25ToUsAqi,
} from '../../src/utils/aqi.js';

describe('AQI category boundaries and helpers', () => {
  it('classifies all US AQI category boundaries accurately', () => {
    expect(getAqiCategory(0).key).toBe('good');
    expect(getAqiCategory(50).key).toBe('good');

    expect(getAqiCategory(51).key).toBe('moderate');
    expect(getAqiCategory(100).key).toBe('moderate');

    expect(getAqiCategory(101).key).toBe('sensitive');
    expect(getAqiCategory(150).key).toBe('sensitive');

    expect(getAqiCategory(151).key).toBe('unhealthy');
    expect(getAqiCategory(200).key).toBe('unhealthy');

    expect(getAqiCategory(201).key).toBe('very_unhealthy');
    expect(getAqiCategory(300).key).toBe('very_unhealthy');

    expect(getAqiCategory(301).key).toBe('hazardous');
    expect(getAqiCategory(500).key).toBe('hazardous');
    expect(getAqiCategory(750).key).toBe('hazardous');
  });

  it('converts PM2.5 concentrations to US EPA AQI accurately', () => {
    expect(pm25ToUsAqi(0)).toBe(0);
    expect(pm25ToUsAqi(12)).toBe(50);
    expect(pm25ToUsAqi(35.4)).toBe(100);
    expect(pm25ToUsAqi(55.4)).toBe(150);
    expect(pm25ToUsAqi(150.4)).toBe(200);
    expect(pm25ToUsAqi(250.4)).toBe(300);
    expect(pm25ToUsAqi(600)).toBe(500);
  });

  it('handles negative and non-finite AQI values safely', () => {
    expect(getAqiCategory(-15).key).toBe('good');
    expect(getAqiCategory(Number.NaN).key).toBe('good');
    expect(clampAqi(-5)).toBe(0);
    expect(clampAqi(999)).toBe(500);
    expect(clampAqi(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampAqi(154.6)).toBe(155);
  });

  it('builds manual AQI readings with null unmeasured pollutants', () => {
    const reading = createManualAirQualityReading(240);
    expect(reading.isManual).toBe(true);
    expect(reading.source).toBe('manual');
    expect(reading.usAqi).toBe(240);
    expect(reading.category.key).toBe('very_unhealthy');
    expect(reading.pm25).toBeNull();
    expect(reading.pm10).toBeNull();
    expect(reading.no2).toBeNull();
    expect(reading.o3).toBeNull();
  });

  it('formats valid and invalid timestamps safely', () => {
    const formatted = formatAqiTimestamp('2026-11-18T10:30:00.000Z', 'en');
    expect(formatted.length).toBeGreaterThan(4);
    expect(formatAqiTimestamp('not-a-date', 'hi')).toBe('not-a-date');
  });
});
