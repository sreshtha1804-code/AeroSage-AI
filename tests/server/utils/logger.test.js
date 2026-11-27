import { describe, expect, it, vi } from 'vitest';
import { createLogger, redact } from '../../../server/logger.js';

// Fake secrets are assembled at runtime so that no key-shaped string is committed to the repository.
const fakeGoogleKey = ['AIza', 'Sy', 'A'.repeat(33)].join('');
const fakeJwt = [`eyJ${'a'.repeat(20)}`, 'b'.repeat(12), 'c'.repeat(12)].join('.');

describe('redact', () => {
  it('removes configured secrets from strings, even inside larger text', () => {
    expect(redact('failed with key abc123SECRET here', ['abc123SECRET'])).toBe(
      'failed with key [REDACTED] here',
    );
  });
  it('removes Google-API-key-like and JWT-like values without being told about them', () => {
    expect(redact(`k=${fakeGoogleKey}`)).toBe('k=[REDACTED]');
    expect(redact(`t=${fakeJwt}`)).toBe('t=[REDACTED]');
  });
  it('redacts values of sensitive keys at any depth', () => {
    expect(
      redact({
        status: 500,
        headers: { Authorization: 'Bearer x', 'x-goog-api-key': 'k' },
        apikey: 'z',
        nested: { password: 'p', ok: 1 },
      }),
    ).toEqual({
      status: 500,
      headers: { Authorization: '[REDACTED]', 'x-goog-api-key': '[REDACTED]' },
      apikey: '[REDACTED]',
      nested: { password: '[REDACTED]', ok: 1 },
    });
  });
  it('reduces errors to name and message (no stack) and bounds depth', () => {
    const out = redact(new Error('boom secret!'), ['secret']);
    expect(out).toEqual({ name: 'Error', message: 'boom [REDACTED]!' });
    expect(out.stack).toBeUndefined();
    const deep = { a: { b: { c: { d: { e: { f: 1 } } } } } };
    expect(JSON.stringify(redact(deep))).toContain('[Truncated]');
  });
  it('handles arrays and primitives', () => {
    expect(redact(['s3cret', 1, null], ['s3cret'])).toEqual(['[REDACTED]', 1, null]);
  });
});

describe('createLogger', () => {
  const sink = () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() });

  it('writes redacted messages and metadata to the matching sink method', () => {
    const s = sink();
    const logger = createLogger({ sink: s, secrets: ['TOPSECRET'] });
    logger.error('call to TOPSECRET failed', { key: 'x', status: 500 });
    logger.warn('plain');
    logger.info('hello');
    expect(s.error).toHaveBeenCalledWith('call to [REDACTED] failed', {
      key: '[REDACTED]',
      status: 500,
    });
    expect(s.warn).toHaveBeenCalledWith('plain');
    expect(s.info).toHaveBeenCalledWith('hello');
  });

  it('respects the level threshold', () => {
    const s = sink();
    const logger = createLogger({ sink: s, level: 'warn' });
    logger.info('hidden');
    logger.debug('hidden');
    logger.warn('shown');
    expect(s.info).not.toHaveBeenCalled();
    expect(s.log).not.toHaveBeenCalled();
    expect(s.warn).toHaveBeenCalledTimes(1);
  });

  it('routes debug output to console.log when enabled', () => {
    const s = sink();
    createLogger({ sink: s, level: 'debug' }).debug('d', { a: 1 });
    expect(s.log).toHaveBeenCalledWith('d', { a: 1 });
  });
});
