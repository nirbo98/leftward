import { driftX } from './PatientStage';

describe('leftward drift (physical coordinates)', () => {
  it('moves toward the physical left over time', () => {
    expect(driftX(80, 0, 20)).toBe(80);
    expect(driftX(80, 2000, 20)).toBeCloseTo(70);
    expect(driftX(80, 4000, 20)).toBeLessThan(driftX(80, 2000, 20));
  });
  it('wraps from beyond the left edge back to beyond the right edge', () => {
    const x = driftX(0, 3500, 20); // 17.5% travelled → past the -15 boundary
    expect(x).toBeGreaterThan(100);
    expect(x).toBeLessThanOrEqual(115);
  });
  it('speed scales with crossSeconds', () => {
    expect(80 - driftX(80, 3000, 30)).toBeCloseTo(10);
  });
});
