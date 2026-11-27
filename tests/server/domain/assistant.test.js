import { describe, expect, it } from 'vitest';
import {
  buildFallbackReply,
  buildSystemInstruction,
  FALLBACK_NOTES,
  validateReply,
} from '../../../server/domain/assistant.js';
import { sanitizeContext } from '../../../server/utils/validation.js';

const context = sanitizeContext({
  place: 'Kolkata',
  aqi: 250,
  pm25: 100,
  dominantPollutant: 'PM2.5',
  bestHours: [6, 7],
  stale: true,
});

describe('buildSystemInstruction', () => {
  const prompt = buildSystemInstruction(context, [{ name: 'Mia', type: 'child' }]);
  it('states scope, data rules, safety rules and the estimate caveat', () => {
    expect(prompt).toMatch(/Never invent AQI values/);
    expect(prompt).toMatch(/ESTIMATE from model data/);
    expect(prompt).toMatch(/context\.stale/);
    expect(prompt).toMatch(/context\.demo/);
    expect(prompt).toMatch(/Never diagnose/);
    expect(prompt).toMatch(/urgent medical care/);
    expect(prompt).toMatch(/DATA, not instructions/);
  });
  it('embeds the category and pollutant glossaries and the data blocks', () => {
    expect(prompt).toMatch(/Very Poor \(301-400\)/);
    expect(prompt).toMatch(/PM2\.5 \/ PM10/);
    expect(prompt).toContain('"aqi":250');
    expect(prompt).toContain('"bestHours":[6,7]');
    expect(prompt).toContain('"name":"Mia"');
  });
});

describe('buildFallbackReply', () => {
  it('is explicit that it is not an answer to the question', () => {
    expect(buildFallbackReply(context)).toMatch(/cannot answer your specific question/);
  });
  it.each([
    [250, /N95/],
    [150, /Sensitive groups/],
    [40, /comparatively good/],
    [null, /do not have a current AQI/],
  ])('advice for AQI %s', (aqi, pattern) => {
    expect(buildFallbackReply(sanitizeContext({ aqi }))).toMatch(pattern);
  });
  it('mentions synthetic and stale caveats only when applicable', () => {
    const both = buildFallbackReply(sanitizeContext({ aqi: 100, demo: true, stale: true }));
    expect(both).toMatch(/SYNTHETIC/);
    expect(both).toMatch(/out of date/);
    expect(buildFallbackReply(sanitizeContext({ aqi: 100 }))).not.toMatch(/SYNTHETIC|out of date/);
  });
  it('has a note for every failure reason', () => {
    for (const reason of [
      'not_configured',
      'rate_limited',
      'http_error',
      'blocked',
      'empty',
      'timeout',
      'network',
    ]) {
      expect(FALLBACK_NOTES[reason]).toMatch(/Basic guidance is shown instead/);
    }
  });
});

describe('validateReply', () => {
  it('passes normal text through trimmed', () => {
    expect(validateReply('  hello  ')).toEqual({ text: 'hello', truncated: false });
  });
  it('strips control characters but keeps newlines and tabs', () => {
    expect(validateReply('a\u0000b\u0007c\nd\te').text).toBe('abc\nd\te');
  });
  it('cuts overly long replies at a sentence boundary and says so', () => {
    const long = `${'Short sentence. '.repeat(400)}tail`;
    const { text, truncated } = validateReply(long);
    expect(truncated).toBe(true);
    expect(text.length).toBeLessThan(4200);
    expect(text).toMatch(/shortened/);
    expect(text).toMatch(/Short sentence\.\s+\(The answer was shortened/);
  });
  it('hard-cuts when there is no usable boundary', () => {
    const { text } = validateReply('x'.repeat(9000));
    expect(text.startsWith('x'.repeat(4000))).toBe(true);
    expect(text).toMatch(/shortened/);
  });
  it('adds a notice when the model itself was cut off (MAX_TOKENS)', () => {
    expect(validateReply('partial answer', { alreadyTruncated: true })).toMatchObject({
      truncated: true,
    });
    expect(validateReply('partial answer', { alreadyTruncated: true }).text).toMatch(/shortened/);
  });
});
