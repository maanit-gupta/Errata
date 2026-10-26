import { Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * Finding highlights as ProseMirror *decorations* (not marks): they never change the saved text,
 * and they map through edits so other highlights stay put when a fix is applied.
 */

export type HighlightRange = { id: string; from: number; to: number; severity: string };
type Meta = { ranges?: HighlightRange[]; active?: string | null };

type FindingsState = { set: DecorationSet; active: string | null; ranges: HighlightRange[] };

export const findingsKey = new PluginKey<FindingsState>("findings");

function build(
  doc: Parameters<typeof DecorationSet.create>[0],
  ranges: HighlightRange[],
  active: string | null,
) {
  return DecorationSet.create(
    doc,
    ranges
      .filter((r) => r.to > r.from)
      .map((r) =>
        Decoration.inline(r.from, r.to, {
          class: `finding-hl finding-${r.severity}${r.id === active ? " finding-active" : ""}`,
          "data-finding-id": r.id,
        }),
      ),
  );
}

export const FindingHighlights = Extension.create({
  name: "findingHighlights",
  addProseMirrorPlugins() {
    return [
      new Plugin<FindingsState>({
        key: findingsKey,
        state: {
          init: (): FindingsState => ({ set: DecorationSet.empty, active: null, ranges: [] }),
          apply(tr, prev, _old, newState): FindingsState {
            const meta = tr.getMeta(findingsKey) as Meta | undefined;
            if (meta) {
              const ranges = meta.ranges ?? prev.ranges;
              const active = meta.active === undefined ? prev.active : meta.active;
              return { set: build(newState.doc, ranges, active), active, ranges };
            }
            if (!tr.docChanged) return prev;
            // Keep highlights attached to their text as the user edits.
            const ranges = prev.ranges
              .map((r) => ({ ...r, from: tr.mapping.map(r.from, 1), to: tr.mapping.map(r.to, -1) }))
              .filter((r) => r.to > r.from);
            return { set: build(newState.doc, ranges, prev.active), active: prev.active, ranges };
          },
        },
        props: {
          decorations(state) {
            return findingsKey.getState(state)?.set;
          },
        },
      }),
    ];
  },
});

/** Current (mapped) range of a finding, if it still exists. */
export function currentRange(state: Parameters<typeof findingsKey.getState>[0], id: string) {
  return findingsKey.getState(state)?.ranges.find((r) => r.id === id) ?? null;
}
