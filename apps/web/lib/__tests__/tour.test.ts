import { describe, expect, it } from "vitest";
import {
  AUTO_HEAL,
  TOUR_SCENES,
  TOUR_TOTAL_MS,
  formatClock,
  sceneAt,
  sceneStart,
  segmentFill,
} from "@/lib/marketing/tour";

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("product tour timing", () => {
  it("has eight scenes of about 55 seconds", () => {
    expect(TOUR_SCENES).toHaveLength(8);
    expect(TOUR_TOTAL_MS).toBe(57000);
    expect(new Set(TOUR_SCENES.map((s) => s.id)).size).toBe(8);
  });

  it("maps the clock to scenes", () => {
    expect(sceneAt(0)).toEqual({ index: 0, local: 0, progress: 0 });
    expect(sceneAt(5999).index).toBe(0);
    expect(sceneAt(6000)).toMatchObject({ index: 1, local: 0 });
    expect(sceneAt(sceneStart(4) + 500)).toMatchObject({ index: 4, local: 500 });
  });

  it("holds the last scene fully played at and past the end", () => {
    const last = TOUR_SCENES.length - 1;
    for (const t of [TOUR_TOTAL_MS, TOUR_TOTAL_MS + 10_000, Infinity]) {
      const s = sceneAt(t);
      expect(s.index).toBe(t === Infinity ? 0 : last);
    }
    expect(sceneAt(TOUR_TOTAL_MS)).toEqual({
      index: last,
      local: TOUR_SCENES[last].durationMs,
      progress: 1,
    });
    expect(sceneAt(-50).index).toBe(0);
  });

  it("clamps scene starts and segment fills", () => {
    expect(sceneStart(-1)).toBe(0);
    expect(sceneStart(99)).toBe(TOUR_TOTAL_MS - TOUR_SCENES.at(-1)!.durationMs);
    expect(segmentFill(0, 3000)).toBe(0.5);
    expect(segmentFill(1, 0)).toBe(0);
    expect(segmentFill(0, TOUR_TOTAL_MS)).toBe(1);
  });

  it("formats the clock", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(57_000)).toBe("0:57");
    expect(formatClock(61_500)).toBe("1:01");
  });
});

describe("product tour copy", () => {
  it("gives every scene a full text equivalent", () => {
    for (const s of TOUR_SCENES) expect(s.summary.length).toBeGreaterThan(200);
  });

  it("marks the insights scene illustrative", () => {
    expect(TOUR_SCENES.find((s) => s.id === "insights")?.illustrative).toBe(true);
  });

  it("states the auto-heal contrast ratios correctly", () => {
    expect(ratio(AUTO_HEAL.flagged.hex, AUTO_HEAL.onHex).toFixed(2)).toBe(AUTO_HEAL.flagged.ratio);
    expect(ratio(AUTO_HEAL.palette.hex, AUTO_HEAL.onHex).toFixed(2)).toBe(AUTO_HEAL.palette.ratio);
    expect(Number(AUTO_HEAL.palette.ratio)).toBeGreaterThanOrEqual(4.5);
    expect(Number(AUTO_HEAL.flagged.ratio)).toBeLessThan(4.5);
  });
});
