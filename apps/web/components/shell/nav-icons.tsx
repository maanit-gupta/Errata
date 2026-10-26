import {
  BookA,
  ChartColumn,
  Database,
  FileText,
  FileUp,
  History,
  Image,
  Inbox,
  Megaphone,
  ScrollText,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { NavIcon } from "@/lib/workflow/permissions";

export const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  drafts: FileText,
  review: Inbox,
  rules: ScrollText,
  facts: Database,
  glossary: BookA,
  campaigns: Megaphone,
  assets: Image,
  guides: FileUp,
  insights: ChartColumn,
  audit: History,
  settings: Settings,
  "ai-use": ShieldCheck,
};
