import { DEMO_USERS } from "@/lib/auth/demo-users";
import { signInAsDemo } from "@/lib/auth/actions";

/** Demo mode only: sign in as another seeded user. Explicit submit (no change-on-select, WCAG 3.2.2). */
export function DemoRoleSwitcher({ currentEmail }: { currentEmail: string }) {
  return (
    <form action={signInAsDemo} className="flex items-center gap-1.5">
      <label htmlFor="demo-user" className="sr-only">
        Switch demo role
      </label>
      <select
        id="demo-user"
        name="user"
        defaultValue={DEMO_USERS.find((u) => u.email === currentEmail)?.key}
        className="border-input bg-card h-8 rounded-md border px-2 text-sm"
      >
        {DEMO_USERS.map((u) => (
          <option key={u.key} value={u.key}>
            {u.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="border-border bg-card hover:bg-muted h-8 rounded-md border px-2.5 text-sm font-medium"
      >
        Switch
      </button>
    </form>
  );
}
