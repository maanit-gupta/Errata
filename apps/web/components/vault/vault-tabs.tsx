export const VAULT_TABS = [
  { key: "rules", label: "Rule cards" },
  { key: "facts", label: "Facts" },
  { key: "glossary", label: "Glossary" },
  { key: "campaigns", label: "Campaigns" },
  { key: "assets", label: "Assets" },
  { key: "guides", label: "Guides" },
] as const;
export type VaultTab = (typeof VAULT_TABS)[number]["key"];
