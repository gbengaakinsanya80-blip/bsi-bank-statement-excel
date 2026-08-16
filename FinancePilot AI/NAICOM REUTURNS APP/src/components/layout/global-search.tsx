import { Search } from "lucide-react";

export function GlobalSearch({ placeholder = "Search policies, clients, returns…" }: { placeholder?: string }) {
  return (
    <form action="/search" method="get" className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        name="q"
        type="search"
        placeholder={placeholder}
        aria-label="Global search"
        className="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </form>
  );
}
