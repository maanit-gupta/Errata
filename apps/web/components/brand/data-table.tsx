"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Sortable when given. */
  sortValue?: (row: T) => string | number | null;
  align?: "left" | "right";
  className?: string;
  /** Row header cell (the row's main link). */
  rowHeader?: boolean;
};

/**
 * DataTable (DESIGN.md §5): mono uppercase headers with `aria-sort`, 44px rows, `--bg-hover`
 * row hover, sticky header, "Load more" instead of scroll-jacking.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  caption,
  initialSort,
  pageSize = 50,
  empty,
  rowClassName,
  className,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Screen-reader caption naming the table. */
  caption: string;
  initialSort?: { key: string; dir: "asc" | "desc" };
  pageSize?: number;
  empty?: ReactNode;
  rowClassName?: (row: T) => string | undefined;
  className?: string;
}) {
  const [sort, setSort] = useState(initialSort);
  const [shown, setShown] = useState(pageSize);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key);
    if (!col?.sortValue || !sort) return rows;
    const get = col.sortValue;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  }, [rows, columns, sort]);

  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className={cn("border-line overflow-x-auto rounded-md border", className)}>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-elevated sticky top-0 z-10">
          <tr className="border-line border-b">
            {columns.map((c) => {
              const active = sort?.key === c.key;
              const ariaSort = active
                ? sort.dir === "asc"
                  ? "ascending"
                  : "descending"
                : undefined;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={c.sortValue ? (ariaSort ?? "none") : undefined}
                  className={cn(
                    "mono-label text-fg-faint h-10 px-3 font-medium whitespace-nowrap",
                    c.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSort({
                          key: c.key,
                          dir: active && sort.dir === "desc" ? "asc" : "desc",
                        })
                      }
                      className="hover:text-fg inline-flex h-7 items-center gap-1 uppercase"
                    >
                      {c.header}
                      {active ? (
                        sort.dir === "asc" ? (
                          <ArrowUp aria-hidden className="size-3" />
                        ) : (
                          <ArrowDown aria-hidden className="size-3" />
                        )
                      ) : (
                        <ArrowUpDown aria-hidden className="size-3 opacity-50" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, shown).map((row) => (
            <tr
              key={rowKey(row)}
              className={cn(
                "border-line hover:bg-hover h-11 border-b last:border-b-0",
                rowClassName?.(row),
              )}
            >
              {columns.map((c) => {
                const Cell = c.rowHeader ? "th" : "td";
                return (
                  <Cell
                    key={c.key}
                    scope={c.rowHeader ? "row" : undefined}
                    className={cn(
                      "px-3 py-2 align-middle font-normal",
                      c.align === "right" ? "text-right" : "text-left",
                      c.className,
                    )}
                  >
                    {c.cell(row)}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length > shown ? (
        <div className="border-line border-t p-2 text-center">
          <button
            type="button"
            onClick={() => setShown((n) => n + pageSize)}
            className="text-accent-soft h-8 px-3 text-sm underline-offset-4 hover:underline"
          >
            Load more ({sorted.length - shown} more)
          </button>
        </div>
      ) : null}
    </div>
  );
}
