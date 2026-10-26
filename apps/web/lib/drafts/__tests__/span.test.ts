import { describe, expect, it } from "vitest";
import { spanBox, spanTarget } from "../span";

describe("finding spans", () => {
  it("reads text, image, text-in-image and alt-text spans", () => {
    expect(spanTarget({ start: 1, end: 4 })).toBe("text");
    expect(spanBox({ start: 1, end: 4 })).toBeNull();

    const image = { x0: 1, y0: 2, x1: 30, y1: 40 };
    expect(spanTarget(image)).toBe("image");
    expect(spanBox(image)).toEqual(image);

    const ocr = { start: 0, end: 12, x0: 153, y0: 755, x1: 401, y1: 793 };
    expect(spanTarget(ocr)).toBe("text");
    expect(spanBox(ocr)).toEqual({ x0: 153, y0: 755, x1: 401, y1: 793 });

    expect(spanTarget({ target: "alt_text", start: 0, end: 5 })).toBe("alt_text");
    expect(spanTarget(null)).toBe("text");
    expect(spanBox({ x0: "1", y0: 2, x1: 3, y1: 4 })).toBeNull();
  });
});
