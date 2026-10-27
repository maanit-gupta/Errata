"use client";

import { Command } from "cmdk";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DIMENSIONS } from "@/components/brand/dimension";
import { PixelGlyph } from "@/components/brand/pixel-glyphs";
import { DEMO_USERS } from "@/lib/auth/demo-users";
import { signInAsDemo } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/browser";
import { applyTheme } from "@/lib/ui-prefs";

type Item = { id: string; label: string; sub?: string; href: string };
type Index = { drafts: Item[]; rules: Item[]; facts: Item[]; campaigns: Item[] };

const EMPTY: Index = { drafts: [], rules: [], facts: [], campaigns: [] };

/** Loads the palette index once per open, RLS-scoped to the viewer. Errors leave a group empty. */
async function loadIndex(canVault: boolean, reviewer: boolean): Promise<Index> {
  const supabase = createClient();
  const [contents, rules, facts, campaigns] = await Promise.all([
    supabase
      .from("contents")
      .select("id, title, state")
      .order("updated_at", { ascending: false })
      .limit(50),
    canVault
      ? supabase.from("rule_cards").select("id, code, title").eq("status", "approved").order("code")
      : Promise.resolve({ data: null }),
    canVault
      ? supabase.from("facts").select("id, code, statement").order("code")
      : Promise.resolve({ data: null }),
    canVault
      ? supabase.from("campaigns").select("id, name, status").order("name")
      : Promise.resolve({ data: null }),
  ]);
  return {
    drafts: (contents.data ?? []).map((c) => ({
      id: c.id,
      label: c.title,
      sub: c.state.replace("_", " "),
      href:
        reviewer && ["in_review", "specialist_review"].includes(c.state)
          ? `/review/${c.id}`
          : `/drafts/${c.id}`,
    })),
    rules: (rules.data ?? []).map((r) => ({
      id: r.id,
      label: r.code,
      sub: r.title,
      href: `/vault?tab=rules&card=${r.id}`,
    })),
    facts: (facts.data ?? []).map((f) => ({
      id: f.id,
      label: f.code,
      sub: f.statement,
      href: `/vault?tab=facts`,
    })),
    campaigns: (campaigns.data ?? []).map((c) => ({
      id: c.id,
      label: c.name,
      sub: c.status,
      href: `/vault?tab=campaigns`,
    })),
  };
}

const itemCls =
  "flex h-9 cursor-pointer items-center gap-3 rounded-md px-2 text-sm text-fg-muted data-[selected=true]:bg-accent data-[selected=true]:text-accent-fg";

/** ⌘K palette (DESIGN.md §6.12): drafts, rules by code, facts, campaigns, actions. */
export function CommandPalette({
  canVault,
  canCreate,
  reviewer,
  demo,
}: {
  canVault: boolean;
  canCreate: boolean;
  reviewer: boolean;
  demo: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState<Index>(EMPTY);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("bl-palette", show);
    return () => window.removeEventListener("bl-palette", show);
  }, []);
  useEffect(() => {
    if (open)
      void loadIndex(canVault, reviewer)
        .then(setIndex)
        .catch(() => setIndex(EMPTY));
  }, [open, canVault, reviewer]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const group = (heading: string, items: Item[]) =>
    items.length ? (
      <Command.Group heading={heading}>
        {items.map((i) => (
          <Command.Item
            key={`${heading}-${i.id}`}
            value={`${heading} ${i.label} ${i.sub ?? ""}`}
            onSelect={() => go(i.href)}
            className={itemCls}
          >
            <span className="mono-id shrink-0">{i.label}</span>
            {i.sub ? <span className="truncate opacity-80">{i.sub}</span> : null}
          </Command.Item>
        ))}
      </Command.Group>
    ) : null;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      overlayClassName="fixed inset-0 z-50 bg-black/50"
      contentClassName="fixed inset-x-0 top-0 z-50 outline-none"
      className="bg-elevated border-line-strong shadow-pop mx-auto w-full border-b"
    >
      <div className="border-line flex h-14 items-center gap-2 border-b px-4">
        <Command.Input
          autoFocus
          placeholder="Search drafts, rule codes, facts, campaigns…"
          className="text-fg placeholder:text-fg-faint h-full flex-1 bg-transparent text-base outline-none"
        />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mono-label border-line-strong text-fg-muted hover:bg-hover inline-flex h-7 items-center gap-1 rounded-sm border px-2"
        >
          <X aria-hidden className="size-3" /> Close · ESC
        </button>
      </div>
      <Command.List className="[&_[cmdk-group-heading]]:mono-label [&_[cmdk-group-heading]]:text-fg-faint mx-auto max-h-[60vh] max-w-3xl overflow-y-auto p-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1">
        <Command.Empty>
          <div className="relative mx-auto flex h-48 w-48 items-center justify-center">
            <PixelGlyph name="lens" size={48} />
            {Object.values(DIMENSIONS).map(({ Icon, label }, i) => {
              const a = (i / 6) * Math.PI * 2;
              return (
                <Icon
                  key={label}
                  aria-hidden
                  className="text-fg absolute size-5 opacity-20"
                  style={{ transform: `translate(${Math.cos(a) * 72}px, ${Math.sin(a) * 72}px)` }}
                />
              );
            })}
          </div>
          <p className="text-fg-muted pb-4 text-center text-sm">
            No matches. Try a rule code like CL-03.
          </p>
        </Command.Empty>
        {group("Drafts", index.drafts)}
        {group("Rules", index.rules)}
        {group("Facts", index.facts)}
        {group("Campaigns", index.campaigns)}
        <Command.Group heading="Actions">
          {canCreate ? (
            <Command.Item
              value="action new draft"
              onSelect={() => go("/drafts/new")}
              className={itemCls}
            >
              New draft
            </Command.Item>
          ) : null}
          <Command.Item
            value="action toggle theme dark light"
            onSelect={() => {
              applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
              setOpen(false);
            }}
            className={itemCls}
          >
            Toggle theme
          </Command.Item>
          {demo
            ? DEMO_USERS.map((u) => (
                <Command.Item
                  key={u.key}
                  value={`action switch demo role ${u.label}`}
                  onSelect={() => {
                    const fd = new FormData();
                    fd.set("user", u.key);
                    setOpen(false);
                    void signInAsDemo(fd);
                  }}
                  className={itemCls}
                >
                  Switch demo role: {u.label}
                </Command.Item>
              ))
            : null}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
