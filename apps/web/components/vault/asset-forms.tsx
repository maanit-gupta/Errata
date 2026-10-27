"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { EmptyState } from "@/components/brand/empty-state";
import { Button } from "@/components/ui/button";
import { fieldClass, Input } from "@/components/ui/input";
import { savePalette, uploadAsset, type ActionResult } from "@/lib/vault/actions";
import { toastResult, useActionToast } from "./use-action-toast";

export function AssetUpload() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(uploadAsset, null);
  const [kind, setKind] = useState("logo");
  useActionToast(state);
  const id = useId();
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <label htmlFor={`${id}-kind`} className="text-sm font-medium">
          Type
        </label>
        <select
          id={`${id}-kind`}
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className={fieldClass}
        >
          <option value="logo">Logo</option>
          <option value="reference_image">Reference image</option>
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor={`${id}-name`} className="text-sm font-medium">
          Name
        </label>
        <Input id={`${id}-name`} name="name" required />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <label htmlFor={`${id}-file`} className="text-sm font-medium">
          Image (PNG, JPEG, WebP or SVG)
        </label>
        <input
          id={`${id}-file`}
          name="file"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          required
          className="file:border-control file:text-fg block text-sm file:mr-3 file:rounded-md file:border file:bg-transparent file:px-3 file:py-1.5"
        />
      </div>
      {kind === "logo" ? (
        <>
          <div className="space-y-1">
            <label htmlFor={`${id}-clear`} className="text-sm font-medium">
              Minimum clear space (× logo height)
            </label>
            <Input
              id={`${id}-clear`}
              name="min_clear_space_ratio"
              type="number"
              step="0.05"
              min="0"
              max="2"
              defaultValue="0.25"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor={`${id}-minw`} className="text-sm font-medium">
              Minimum width (px)
            </label>
            <Input id={`${id}-minw`} name="min_width_px" type="number" min="1" defaultValue="80" />
          </div>
        </>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Upload asset"}
        </Button>
      </div>
    </form>
  );
}

type Colour = { name: string; hex: string };

/**
 * Palette section (DESIGN.md §6.6, §11): with no palette saved yet it shows the empty state and
 * one primary action, instead of an editor pre-filled with a colour the org never chose.
 */
export function PaletteSection({
  palette,
}: {
  palette?: { id: string; name: string; colours: Colour[]; max_delta_e: number };
}) {
  const [adding, setAdding] = useState(false);
  if (!palette && !adding) {
    return (
      <EmptyState
        glyph="eye"
        title="No palette yet"
        headingLevel={3}
        className="py-10"
        action={<Button onClick={() => setAdding(true)}>Add palette</Button>}
      >
        Image checks compare flat fills against these colours (VS-01). Add the brand colours and the
        largest colour difference you accept.
      </EmptyState>
    );
  }
  return (
    <div className="border-line bg-elevated rounded-md border p-4">
      <PaletteEditor palette={palette} />
    </div>
  );
}

export function PaletteEditor({
  palette,
}: {
  palette?: { id: string; name: string; colours: Colour[]; max_delta_e: number };
}) {
  const id = useId();
  const [name, setName] = useState(palette?.name ?? "Brand palette");
  const [colours, setColours] = useState<Colour[]>(
    // eslint-disable-next-line no-restricted-syntax -- palette data default, not a UI colour
    palette?.colours ?? [{ name: "Ink", hex: "#141414" }],
  );
  const [maxDeltaE, setMaxDeltaE] = useState(palette?.max_delta_e ?? 10);
  const [pending, start] = useTransition();
  const update = (i: number, patch: Partial<Colour>) =>
    setColours((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () =>
          toastResult(
            await savePalette({ id: palette?.id, name, colours, max_delta_e: maxDeltaE }),
          ),
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor={`${id}-pname`} className="text-sm font-medium">
            Palette name
          </label>
          <Input id={`${id}-pname`} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-de`} className="text-sm font-medium">
            Max colour difference (ΔE CIEDE2000)
          </label>
          <div className="flex items-center gap-3">
            <input
              id={`${id}-de`}
              type="range"
              min={1}
              max={50}
              value={maxDeltaE}
              onChange={(e) => setMaxDeltaE(Number(e.target.value))}
              className="h-9 flex-1 accent-(--accent)"
            />
            <output htmlFor={`${id}-de`} className="mono-id w-14 text-right">
              ΔE {maxDeltaE}
            </output>
          </div>
        </div>
      </div>
      <ul className="space-y-2">
        {colours.map((c, i) => {
          const valid = /^#[0-9a-f]{6}$/i.test(c.hex);
          return (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <span
                aria-hidden
                className="border-line-strong size-9 rounded-md border"
                style={{ background: /^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : "transparent" }}
              />
              <label className="sr-only" htmlFor={`${id}-cn-${i}`}>
                Colour {i + 1} name
              </label>
              <Input
                id={`${id}-cn-${i}`}
                className="w-40"
                value={c.name}
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <label className="sr-only" htmlFor={`${id}-ch-${i}`}>
                Colour {i + 1} hex
              </label>
              <Input
                id={`${id}-ch-${i}`}
                className="w-28 font-mono"
                value={c.hex}
                onChange={(e) => update(i, { hex: e.target.value })}
                pattern="#[0-9a-fA-F]{6}"
                aria-invalid={valid ? undefined : true}
                aria-describedby={valid ? undefined : `${id}-ch-${i}-err`}
              />
              {valid ? null : (
                <span id={`${id}-ch-${i}-err`} className="text-danger text-xs">
                  Use #RRGGBB
                </span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setColours((cs) => cs.filter((_, j) => j !== i))}
              >
                Remove <span className="sr-only">colour {c.name}</span>
              </Button>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setColours((cs) => [...cs, { name: "", hex: "#" }])}
        >
          Add colour
        </Button>
        <Button
          type="submit"
          disabled={pending || colours.some((c) => !/^#[0-9a-f]{6}$/i.test(c.hex))}
        >
          Save palette
        </Button>
      </div>
    </form>
  );
}
