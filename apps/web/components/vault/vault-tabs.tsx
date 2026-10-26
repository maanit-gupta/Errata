import Link from "next/link";
import { cn } from "@/lib/utils";

export const VAULT_TABS = [
  { key: "rules", label: "Rule cards" },
  { key: "facts", label: "Facts" },
  { key: "glossary", label: "Glossary" },
  { key: "campaigns", label: "Campaigns" },
  { key: "assets", label: "Assets" },
  { key: "guides", label: "Guides" },
] as const;
export type VaultTab = (typeof VAULT_TABS)[number]["key"];

export function VaultTabs({ active }: { active: VaultTab }) {
  return (
    <nav aria-label="Vault sections" className="border-rule mb-8 overflow-x-auto border-b">
      <ul className="flex gap-1">
        {VAULT_TABS.map((t) => (
          <li key={t.key}>
            <Link
              href={`/vault?tab=${t.key}`}
              aria-current={t.key === active ? "page" : undefined}
              className={cn(
                "-mb-px inline-block border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap",
                t.key === active
                  ? "border-vermilion text-foreground"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
