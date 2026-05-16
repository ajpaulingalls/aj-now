import { describe, expect, it } from 'vitest';

import { end, isRTL, start } from '../rtl';

describe('isRTL', () => {
  it('returns false for English', () => {
    expect(isRTL('en')).toBe(false);
  });

  it('returns true for Arabic', () => {
    expect(isRTL('ar')).toBe(true);
  });

  it('matches BCP-47 region subtags by primary subtag', () => {
    expect(isRTL('ar-EG')).toBe(true);
    expect(isRTL('en-US')).toBe(false);
  });

  it('is case-insensitive on the primary subtag', () => {
    expect(isRTL('AR')).toBe(true);
    expect(isRTL('Ar-eg')).toBe(true);
  });

  it('recognizes the canonical RTL set: ar, he, fa, ur', () => {
    expect(isRTL('he')).toBe(true);
    expect(isRTL('fa')).toBe(true);
    expect(isRTL('ur')).toBe(true);
  });
});

describe('start / end resolvers', () => {
  it('maps RTL to right-start, left-end', () => {
    expect(start('ar')).toBe('right');
    expect(end('ar')).toBe('left');
  });

  it('maps LTR to left-start, right-end', () => {
    expect(start('en')).toBe('left');
    expect(end('en')).toBe('right');
  });
});
