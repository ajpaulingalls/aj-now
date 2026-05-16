import { describe, expect, it } from 'vitest';

import * as api from '../index';

describe('@aj-now/api-contract package surface', () => {
  it('barrel module resolves with no exports yet', () => {
    expect(Object.keys(api)).toEqual([]);
  });
});
