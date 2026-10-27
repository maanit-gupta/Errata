import { describe, expect, it } from "vitest";
import { parseSwatches } from "../swatches";

describe("parseSwatches", () => {
  it("reads the contrast pair the worker measured", () => {
    expect(
      parseSwatches(
        "Contrast is 2.31 : 1 (#9A9A9A on #FFFFFF); normal text needs at least 4.5 : 1.",
      ),
    ).toEqual({ kind: "contrast", ratio: 2.31, fg: "#9A9A9A", bg: "#FFFFFF" });
  });

  it("reads the fill and nearest palette colour", () => {
    expect(
      parseSwatches(
        "#3A7BD5 is ΔE 18.4 from the nearest palette colour (Ocean blue #2F6FD0); the limit is 10.",
      ),
    ).toEqual({
      kind: "delta_e",
      found: "#3A7BD5",
      deltaE: 18.4,
      nearestName: "Ocean blue",
      nearest: "#2F6FD0",
    });
  });

  it("returns null for anything else", () => {
    expect(parseSwatches("This image has no alt text.")).toBeNull();
    expect(parseSwatches("Contrast is low (#fff on #000).")).toBeNull();
  });
});
