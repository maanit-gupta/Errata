"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { buttonVariants } from "@/components/ui/button";
import { REPO } from "@/components/marketing/links";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#example", label: "Example" },
  { href: "/#trust", label: "Trust" },
  { href: "/ai-use", label: "AI use" },
];

const linkCls =
  "text-fg inline-flex h-10 items-center px-2 text-[0.9375rem] underline-offset-[6px] decoration-2 hover:underline";

/** Marketing nav (DESIGN.md §7.7): wordmark, text links, Sign in, and the yellow CTA. */
export function MarketingNav({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const app = signedIn ? "/drafts" : "/login";
  return (
    <header className="bg-canvas border-outline sticky top-0 z-40 border-b-2">
      <div className="mx-auto flex h-20 max-w-[1200px] items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="inline-flex items-center" aria-label="Errata home">
          <Wordmark />
        </Link>
        <nav aria-label="Primary" className="ml-auto hidden items-center gap-4 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? "page" : undefined}
              className={cn(linkCls, pathname === l.href && "underline")}
            >
              {l.label}
            </Link>
          ))}
          <a href={REPO} target="_blank" rel="noreferrer" className={linkCls}>
            GitHub<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-3 md:ml-2">
          <Link href={app} className={cn(linkCls, "hidden font-semibold sm:inline-flex")}>
            {signedIn ? "Open app" : "Sign in"}
          </Link>
          <Link href="/login" className={buttonVariants({ variant: "highlight" })}>
            Try the demo
          </Link>
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger
              aria-label="Open menu"
              className="border-outline text-fg hover:bg-hover inline-flex size-10 items-center justify-center rounded-sm border-2 md:hidden"
            >
              <Menu aria-hidden className="size-5" />
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Backdrop className="bg-overlay fixed inset-0 z-40" />
              <Dialog.Popup className="bg-elevated border-outline fixed inset-x-3 top-3 z-50 rounded-lg border-2 p-5 outline-none">
                <div className="mb-4 flex items-center justify-between">
                  <Dialog.Title className="text-lg font-bold">Menu</Dialog.Title>
                  <Dialog.Close
                    aria-label="Close menu"
                    className="border-outline hover:bg-hover inline-flex size-10 items-center justify-center rounded-sm border-2"
                  >
                    <X aria-hidden className="size-5" />
                  </Dialog.Close>
                </div>
                <ul className="space-y-1">
                  {[...LINKS, { href: app, label: signedIn ? "Open app" : "Sign in" }].map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        onClick={() => setOpen(false)}
                        className="hover:bg-hover block rounded-sm px-2 py-2.5 text-base font-semibold"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </header>
  );
}
