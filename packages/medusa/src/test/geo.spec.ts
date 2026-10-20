import { describe, expect, it } from 'vitest';
import { haversineDistanceKm } from '../utils/geo.js';

describe('haversineDistanceKm', () => {
  it('is zero for identical coordinates', () => {
    expect(haversineDistanceKm(55.6761, 12.5683, 55.6761, 12.5683)).toBe(0);
  });

  it('matches the known Copenhagen-Aarhus distance', () => {
    // Copenhagen (55.6761, 12.5683) to Aarhus (56.1629, 10.2039) is ~157 km
    const distance = haversineDistanceKm(55.6761, 12.5683, 56.1629, 10.2039);

    expect(distance).toBeGreaterThan(150);
    expect(distance).toBeLessThan(165);
  });

  it('is symmetric', () => {
    const there = haversineDistanceKm(55.6761, 12.5683, 56.1629, 10.2039);
    const back = haversineDistanceKm(56.1629, 10.2039, 55.6761, 12.5683);

    expect(there).toBeCloseTo(back, 10);
  });
});
