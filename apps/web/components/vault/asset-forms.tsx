"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
          className="border-input bg-card h-8 w-full rounded-md border px-2 text-sm"
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
          className="block text-sm"
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
          <Input
            id={`${id}-de`}
            type="number"
            min={1}
            max={50}
            value={maxDeltaE}
            onChange={(e) => setMaxDeltaE(Number(e.target.value))}
          />
        </div>
      </div>
      <ul className="space-y-2">
        {colours.map((c, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <span
              aria-hidden
              className="border-border size-8 rounded-md border"
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
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setColours((cs) => cs.filter((_, j) => j !== i))}
            >
              Remove <span className="sr-only">colour {c.name}</span>
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setColours((cs) => [...cs, { name: "", hex: "#" }])}
        >
          Add colour
        </Button>
        <Button type="submit" disabled={pending}>
          Save palette
        </Button>
      </div>
    </form>
  );
}
