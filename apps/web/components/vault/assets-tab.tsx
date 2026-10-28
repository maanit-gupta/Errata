import { createClient } from "@/lib/supabase/server";
import { AssetUpload, PaletteSection } from "./asset-forms";
import { SIGNED_URL_TTL_S } from "@/lib/limits";

type Spec = Record<string, unknown>;

export async function AssetsTab({ orgId }: { orgId: string }) {
  const supabase = await createClient();
  const { data: assets, error } = await supabase
    .from("assets")
    .select("id, kind, name, storage_path, spec")
    .eq("org_id", orgId)
    .order("created_at");
  if (error) throw new Error(`Couldn't load assets: ${error.message}`);
  const images = (assets ?? []).filter((a) => a.kind === "logo" || a.kind === "reference_image");
  const signed = await Promise.all(
    images.map(async (a) =>
      a.storage_path
        ? (await supabase.storage.from("assets").createSignedUrl(a.storage_path, SIGNED_URL_TTL_S))
            .data?.signedUrl
        : null,
    ),
  );
  const paletteRow = (assets ?? []).find((a) => a.kind === "palette");
  const spec = (paletteRow?.spec ?? {}) as Spec;
  const palette = paletteRow
    ? {
        id: paletteRow.id,
        name: paletteRow.name,
        colours: Array.isArray(spec.colours)
          ? (spec.colours as { name: string; hex: string }[])
          : [],
        max_delta_e: typeof spec.max_delta_e === "number" ? spec.max_delta_e : 10,
      }
    : undefined;

  return (
    <div className="space-y-10">
      <section aria-labelledby="palette-h">
        <h2 id="palette-h" className="mono-label text-fg-faint mb-2">
          Palette
        </h2>
        <PaletteSection palette={palette} />
      </section>
      <section aria-labelledby="images-h">
        <h2 id="images-h" className="mono-label text-fg-faint mb-2">
          Logos and reference images
        </h2>
        <ul className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((a, i) => {
            const s = (a.spec ?? {}) as Spec;
            return (
              <li key={a.id} className="border-outline bg-elevated rounded-lg border-2 p-3">
                {signed[i] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL, not optimisable
                  <img
                    src={signed[i]!}
                    alt={`${a.name} (${a.kind === "logo" ? "logo" : "reference image"})`}
                    className="mb-3 h-28 w-full rounded-sm object-contain p-2"
                    style={{
                      background:
                        "repeating-conic-gradient(var(--bg-hover) 0 25%, var(--bg-elevated) 0 50%) 0 0 / 16px 16px",
                    }}
                  />
                ) : null}
                <p className="font-medium">{a.name}</p>
                <p className="mono-id text-fg-muted text-xs">
                  {a.kind === "logo"
                    ? `Logo · clear space ${String(s.min_clear_space_ratio ?? "?")}× height · min ${String(s.min_width_px ?? "?")} px`
                    : "Reference image"}
                </p>
              </li>
            );
          })}
        </ul>
        <div className="border-control rounded-sm border-2 border-dashed p-4">
          <AssetUpload />
        </div>
      </section>
    </div>
  );
}
