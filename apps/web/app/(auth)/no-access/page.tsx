import { EmptyState } from "@/components/brand/empty-state";
import { signOut } from "@/lib/auth/actions";

export const metadata = { title: "No organisation" };

export default function NoAccessPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 items-center px-6">
      <EmptyState
        title="You're not in an organisation yet"
        action={
          <form action={signOut}>
            <button type="submit" className="text-sm font-medium underline underline-offset-4">
              Sign out
            </button>
          </form>
        }
      >
        Ask your brand admin to add you to their BrandLens organisation, then sign in again.
      </EmptyState>
    </main>
  );
}
