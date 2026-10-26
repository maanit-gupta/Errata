"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { FLASH_COOKIE } from "@/lib/ui-prefs";

/** Shows a one-shot message set by a server action (e.g. "Now viewing as Legal"), then clears it. */
export function FlashToast({ message }: { message: string | null }) {
  useEffect(() => {
    if (!message) return;
    toast.success(message, { id: "flash" });
    document.cookie = `${FLASH_COOKIE}=; path=/; max-age=0`;
  }, [message]);
  return null;
}
