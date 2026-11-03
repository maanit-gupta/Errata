import { describe, expect, it } from "vitest";
import { expiryCountdown } from "@/lib/review/countdown";

const UNTIL = "2027-03-31T18:29:59Z"; // E-19: Mar 31, 23:59:59 IST
const at = (iso: string) => Date.parse(iso);

describe("expiryCountdown (Hero 2 publish receipt)", () => {
  it("counts whole days when more than two days are left", () => {
    expect(expiryCountdown(UNTIL, at("2027-03-01T18:29:59Z"))).toEqual({
      text: "expires in 30 days",
      soon: false,
      expired: false,
    });
  });
  it("is flagged as soon within 7 days", () => {
    expect(expiryCountdown(UNTIL, at("2027-03-25T18:29:59Z"))).toMatchObject({
      text: "expires in 6 days",
      soon: true,
    });
  });
  it("switches to hours and minutes inside two days, then minutes inside an hour", () => {
    expect(expiryCountdown(UNTIL, at("2027-03-30T15:00:00Z"))?.text).toBe("expires in 27 h 29 min");
    expect(expiryCountdown(UNTIL, at("2027-03-31T16:29:59Z"))?.text).toBe("expires in 2 h");
    expect(expiryCountdown(UNTIL, at("2027-03-31T18:00:00Z"))?.text).toBe("expires in 30 mins");
    expect(expiryCountdown(UNTIL, at("2027-03-31T18:29:00Z"))?.text).toBe("expires in 1 min");
  });
  it("says expired at or after the moment, and ignores bad input", () => {
    expect(expiryCountdown(UNTIL, at(UNTIL))).toEqual({
      text: "expired",
      soon: true,
      expired: true,
    });
    expect(expiryCountdown("not a date", 0)).toBeNull();
  });
});
