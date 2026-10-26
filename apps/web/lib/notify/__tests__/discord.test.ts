import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ clientEnv: {}, serverEnv: () => ({}) }));
const { discordPayload } = await import("../discord");

describe("discordPayload", () => {
  it("needs-review embed carries route, risk and link, never body text", () => {
    const p = discordPayload(
      { type: "needs_review", contentId: "c1", title: "Diwali caption", routeTo: "legal", risk: 9 },
      "https://brandlens.example/",
    );
    expect(p.embeds[0]).toMatchObject({
      title: "📝 Diwali caption needs review",
      url: "https://brandlens.example/review/c1",
    });
    expect(p.embeds[0].description).toContain("legal");
    expect(JSON.stringify(p)).not.toContain("assured");
  });

  it("publish-ready links to the audit trail", () => {
    const p = discordPayload(
      { type: "publish_ready", contentId: "c1", title: "T" },
      "https://x.test",
    );
    expect(p.embeds[0].url).toBe("https://x.test/review/c1#audit");
  });

  it("changes-requested uses the vermilion accent and truncates the reason", () => {
    const p = discordPayload(
      { type: "changes_requested", contentId: "c", title: "T", reason: "r".repeat(500) },
      "https://x",
    );
    expect(p.embeds[0].color).toBe(0xd63a24);
    expect(p.embeds[0].description).toHaveLength(300);
  });
});
