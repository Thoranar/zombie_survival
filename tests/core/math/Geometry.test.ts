import { describe, it, expect } from 'vitest';
import { aabbIntersects } from '../../../src/core/math/Geometry';

describe('Geometry.aabbIntersects', () => {
  it('detects overlap and separation', () => {
    // touching overlaps
    expect(aabbIntersects(0, 0, 1, 1, 2, 0, 1, 1)).toBe(true); // edges touch at x=1
    // separated
    expect(aabbIntersects(0, 0, 1, 1, 3.1, 0, 1, 1)).toBe(false);
    // overlap in both axes
    expect(aabbIntersects(0, 0, 2, 2, 1, 1, 1, 1)).toBe(true);
  });
});

