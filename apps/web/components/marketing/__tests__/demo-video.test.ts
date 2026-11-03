import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TRANSCRIPT, VTT_PATH } from "../demo-video";

/** Parses WebVTT cues into { start (m:ss), text }. */
function cues(vtt: string) {
  return vtt
    .split(/\n\n+/)
    .map((b) => b.trim().split("\n"))
    .filter((lines) => lines[0]?.includes("-->"))
    .map(([timing, ...text]) => {
      const [h, m, s] = timing!.split(" --> ")[0]!.split(":");
      const mins = Number(h) * 60 + Number(m);
      return {
        at: `${mins}:${String(Math.floor(Number(s))).padStart(2, "0")}`,
        text: text.join(" "),
      };
    });
}

describe("demo video transcript", () => {
  it("matches the captions file cue for cue", () => {
    const vtt = readFileSync(join(__dirname, "..", "..", "..", VTT_PATH), "utf8");
    expect(TRANSCRIPT).toEqual(cues(vtt));
  });
});
