import { Spinner } from "@/components/brand/spinner";

/** Route loading state (DESIGN.md §11): spinner + label, no skeletons. */
export default function Loading() {
  return <Spinner centered label="Loading…" />;
}
