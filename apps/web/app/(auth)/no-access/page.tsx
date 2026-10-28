import { EmptyState } from "@/components/brand/empty-state";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";

export const metadata = { title: "No organisation" };

export default function NoAccessPage() {
  return (
    <main
      id="main"
      className="blueprint-grid flex min-h-dvh flex-1 items-center justify-center px-6"
    >
      <EmptyState
        glyph="shield"
        className="w-full max-w-xl"
        title="You're not in an organisation yet"
        action={
          <form action={signOut}>
            <Button type="submit" variant="secondary">
              Sign out
            </Button>
          </form>
        }
      >
        Ask your brand admin to add you to their Errata organisation, then sign in again.
      </EmptyState>
    </main>
  );
}
