// Runs once when the Next.js server starts, so a missing env var fails `next dev` / `next start`
// before the first request rather than on it.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { serverEnv } = await import("./lib/env");
    serverEnv();
  }
}
