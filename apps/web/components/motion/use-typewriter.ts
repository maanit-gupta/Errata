"use client";

import { useEffect, useState } from "react";

const GLYPHS = "[]{}<>/\\|_";
const TYPE_MS = 55;
const DELETE_MS = 30;
const HOLD_MS = 1800;
const REDUCED_SWAP_MS = 3000;

/**
 * Typewriter with a glyph scramble (DESIGN.md §4.1): each new char shows a random glyph for one
 * frame before it settles; hold 1.8s; backspace at 30ms. Reduced motion swaps words every 3s.
 * Returns the visible text and the index of the current word.
 */
export function useTypewriter(words: readonly string[], reduced: boolean) {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState(words[0]);
  const [phase, setPhase] = useState<"hold" | "delete" | "type">("hold");
  const [scramble, setScramble] = useState<string | null>(null);

  useEffect(() => {
    if (reduced) {
      const t = setInterval(() => {
        setIndex((i) => {
          const n = (i + 1) % words.length;
          setText(words[n]);
          return n;
        });
      }, REDUCED_SWAP_MS);
      return () => clearInterval(t);
    }
    let t: ReturnType<typeof setTimeout>;
    const word = words[index];
    if (phase === "hold") {
      t = setTimeout(() => setPhase("delete"), HOLD_MS);
    } else if (phase === "delete") {
      t = setTimeout(() => {
        if (text.length === 0) {
          setIndex((index + 1) % words.length);
          setPhase("type");
        } else setText(text.slice(0, -1));
      }, DELETE_MS);
    } else if (text.length >= word.length) {
      t = setTimeout(() => setPhase("hold"), 0);
    } else if (scramble === null) {
      t = setTimeout(() => setScramble(GLYPHS[Math.floor(Math.random() * GLYPHS.length)]), TYPE_MS);
    } else {
      t = setTimeout(() => {
        setScramble(null);
        setText(word.slice(0, text.length + 1));
      }, TYPE_MS / 2);
    }
    return () => clearTimeout(t);
  }, [words, index, text, phase, scramble, reduced]);

  return { text: scramble ? text + scramble : text, index, typing: phase !== "hold" };
}
