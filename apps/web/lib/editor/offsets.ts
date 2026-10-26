import type { JSONContent } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * Plain-text offsets ↔ ProseMirror positions (CLAUDE.md "TipTap offsets"). The ONLY place positions
 * are computed; components never do this ad hoc.
 *
 * The draft's plain text is its textblocks joined by "\n" (hard breaks are "\n" too). Findings from
 * the worker carry Python offsets, i.e. Unicode **code points**; JS strings and ProseMirror count
 * UTF-16 code units, so emoji and other astral characters need converting.
 */

export const BLOCK_SEPARATOR = "\n";
const LEAF_TEXT = "\n"; // hard breaks (the only inline leaf in our schema)

type Block = { contentStart: number; textStart: number; text: string };

function blocks(doc: PMNode): Block[] {
  const out: Block[] = [];
  let textPos = 0;
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    if (out.length) textPos += BLOCK_SEPARATOR.length;
    const text = node.textBetween(0, node.content.size, undefined, LEAF_TEXT);
    out.push({ contentStart: pos + 1, textStart: textPos, text });
    textPos += text.length;
    return false;
  });
  return out;
}

/** The document's plain text (what is saved as the version body). */
export function docToText(doc: PMNode): string {
  return blocks(doc)
    .map((b) => b.text)
    .join(BLOCK_SEPARATOR);
}

/** Paragraph-per-line TipTap JSON for a plain-text body (inverse of `docToText`). */
export function textToDocJSON(text: string): JSONContent {
  return {
    type: "doc",
    content: text
      .split("\n")
      .map((line) =>
        line
          ? { type: "paragraph", content: [{ type: "text", text: line }] }
          : { type: "paragraph" },
      ),
  };
}

/** UTF-16 text offset → ProseMirror position. Offsets on a separator map to the end of the block. */
export function textOffsetToPos(doc: PMNode, offset: number): number {
  const bs = blocks(doc);
  if (!bs.length) return 1;
  for (const b of bs) {
    if (offset <= b.textStart + b.text.length) {
      return b.contentStart + Math.max(0, offset - b.textStart);
    }
  }
  const last = bs[bs.length - 1];
  return last.contentStart + last.text.length;
}

/** ProseMirror position → UTF-16 text offset. */
export function posToTextOffset(doc: PMNode, pos: number): number {
  const bs = blocks(doc);
  let result = 0;
  for (const b of bs) {
    if (pos < b.contentStart) return result;
    result = b.textStart + Math.min(pos - b.contentStart, b.text.length);
  }
  return result;
}

/** Code-point index (Python) → UTF-16 index (JS) within `text`. */
export function cpToUtf16(text: string, cp: number): number {
  let units = 0;
  let count = 0;
  for (const ch of text) {
    if (count === cp) return units;
    units += ch.length;
    count += 1;
  }
  return units;
}

/** UTF-16 index (JS) → code-point index (Python) within `text`. */
export function utf16ToCp(text: string, units: number): number {
  return Array.from(text.slice(0, units)).length;
}

/** A worker span (code points over `text`) → a ProseMirror range in `doc`. */
export function spanToRange(doc: PMNode, text: string, span: { start: number; end: number }) {
  return {
    from: textOffsetToPos(doc, cpToUtf16(text, span.start)),
    to: textOffsetToPos(doc, cpToUtf16(text, span.end)),
  };
}
