import { Lock } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export function NoAccess({ what }: { what: string }) {
  return (
    <EmptyState icon={Lock} title="You don't have access to this page">
      Your role can&apos;t view {what}. Ask a brand admin if you think that&apos;s wrong.
    </EmptyState>
  );
}
