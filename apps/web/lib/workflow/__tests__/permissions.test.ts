import { describe, expect, it } from "vitest";
import {
  access,
  ACTIONS,
  can,
  homeFor,
  navFor,
  ROLES,
  type Access,
  type Action,
  type Role,
} from "../permissions";

// SPEC §2, transcribed cell by cell: ● full, ◐ / footnoted ● limited, ○ none.
// Columns: Agency, Creator, Manager, Specialist, Admin.
const SPEC: Record<Action, [string, string, string, string, string]> = {
  define_vault: ["○", "○", "○", "○", "●"],
  submit_content: ["●", "●", "●", "○", "●"],
  see_full_finding: ["◐", "●", "●", "●", "●"],
  resolve_finding: ["●", "●", "◐", "◐", "●"],
  comment: ["●", "●", "●", "●", "●"],
  approve_or_request_changes: ["○", "○", "●", "●³", "●"],
  sign_off: ["○", "○", "○", "●³", "◐"],
  view_insights: ["○", "○", "◐", "○", "●"],
  view_audit_log: ["○", "○", "●", "●", "●"],
};

const toAccess = (cell: string): Access =>
  cell === "●" ? "full" : cell === "○" ? "none" : "limited";

describe("permissions matrix (SPEC §2)", () => {
  const cells = ACTIONS.flatMap((action) =>
    ROLES.map((role, i) => ({ action, role, expected: toAccess(SPEC[action][i]) })),
  );

  it("covers every cell", () => {
    expect(cells).toHaveLength(ACTIONS.length * ROLES.length);
  });

  it.each(cells)("$role · $action → $expected", ({ role, action, expected }) => {
    expect(access(role, action)).toBe(expected);
    expect(can(role, action)).toBe(expected !== "none");
  });
});

describe("navigation", () => {
  const nav = (role: Role) => navFor(role).map((i) => i.label);

  it("filters items by role", () => {
    expect(nav("brand_admin")).toEqual(["Drafts", "Review queue", "Vault", "Insights", "Settings"]);
    expect(nav("manager")).toEqual(["Drafts", "Review queue", "Insights", "Settings"]);
    expect(nav("creator")).toEqual(["Drafts", "Settings"]);
    expect(nav("agency_creator")).toEqual(["Drafts", "Settings"]);
    expect(nav("specialist")).toEqual(["Review queue", "Settings"]);
  });

  it("sends specialists to the review queue and everyone else to drafts", () => {
    expect(homeFor("specialist")).toBe("/review");
    expect(homeFor("creator")).toBe("/drafts");
  });
});
