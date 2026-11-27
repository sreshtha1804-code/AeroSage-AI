import { describe, expect, it } from 'vitest';
import {
  isSupportedUnit,
  microgramsToMilligrams,
  normalizeUnit,
  toMicrogramsPerM3,
} from '../../../server/domain/units.js';

describe('normalizeUnit', () => {
  it.each([
    ['μg/m³', 'ug/m3'],
    ['µg/m³', 'ug/m3'],
    ['ug/m3', 'ug/m3'],
    [' UG / M3 ', 'ug/m3'],
    ['mg/m³', 'mg/m3'],
  ])('%s -> %s', (input, expected) => expect(normalizeUnit(input)).toBe(expected));
  it('returns null for non-strings', () => {
    expect(normalizeUnit(undefined)).toBeNull();
    expect(normalizeUnit(5)).toBeNull();
  });
});

describe('toMicrogramsPerM3', () => {
  it('keeps µg/m³ and converts mg/m³ (x1000)', () => {
    expect(toMicrogramsPerM3(12.5, 'μg/m³')).toBe(12.5);
    expect(toMicrogramsPerM3(1.2, 'mg/m³')).toBeCloseTo(1200);
  });
  it('refuses unsupported units such as ppb rather than guessing', () => {
    expect(toMicrogramsPerM3(50, 'ppb')).toBeNull();
    expect(isSupportedUnit('ppb')).toBe(false);
    expect(isSupportedUnit('μg/m³')).toBe(true);
  });
  it.each([[null], [undefined], ['5'], [NaN], [Infinity]])('rejects value %s', (value) => {
    expect(toMicrogramsPerM3(value, 'ug/m3')).toBeNull();
  });
  it('converts µg/m³ to mg/m³ for CPCB CO', () => {
    expect(microgramsToMilligrams(2000)).toBe(2);
  });
});
