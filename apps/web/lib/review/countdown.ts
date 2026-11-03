const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** A receipt this close to expiry gets the warning style (Hero 2). */
export const EXPIRY_SOON_MS = 7 * DAY;

export type Countdown = { text: string; soon: boolean; expired: boolean };

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/** Time left until a publish receipt's earliest fact expiry, e.g. "expires in 12 days". */
export function expiryCountdown(untilIso: string, nowMs: number): Countdown | null {
  const until = Date.parse(untilIso);
  if (Number.isNaN(until)) return null;
  const left = until - nowMs;
  if (left <= 0) return { text: "expired", soon: true, expired: true };
  const soon = left <= EXPIRY_SOON_MS;
  if (left < HOUR)
    return { text: `expires in ${plural(Math.ceil(left / MINUTE), "min")}`, soon, expired: false };
  if (left < 2 * DAY) {
    const h = Math.floor(left / HOUR);
    const m = Math.floor((left % HOUR) / MINUTE);
    return { text: `expires in ${h} h${m ? ` ${m} min` : ""}`, soon, expired: false };
  }
  return { text: `expires in ${plural(Math.floor(left / DAY), "day")}`, soon, expired: false };
}
