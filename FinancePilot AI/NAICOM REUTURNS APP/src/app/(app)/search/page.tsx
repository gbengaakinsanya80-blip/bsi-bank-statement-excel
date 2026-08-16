import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabase } from "@/lib/supabase/server";
import { resultGroups, searchAll } from "@/lib/services/search-service";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim() ?? "";

  const supabase = await createServerSupabase();
  const results = q.length >= 2 ? await searchAll(supabase, q) : null;
  const groups = results ? resultGroups() : [];
  const total = results
    ? groups.reduce((sum, g) => sum + results[g.key].length, 0)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Search className="h-6 w-6" />
          Search
        </h1>
        <p className="text-sm text-muted-foreground">
          {q ? (
            <>
              Results for <span className="font-medium text-foreground">“{q}”</span> — {total} found
            </>
          ) : (
            "Search policies, clients, insurers, staff and returns."
          )}
        </p>
      </div>

      {!results && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Type at least two characters in the search box above to find records.
            </p>
          </CardContent>
        </Card>
      )}

      {results && total === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              No matches for “{q}”. Try a policy number, client name, insurer, staff member or return.
            </p>
          </CardContent>
        </Card>
      )}

      {results &&
        groups.map(({ key, label }) => {
          const items = results[key];
          if (items.length === 0) return null;
          return (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="text-base">
                  {label} ({items.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {items.map((item) => (
                    <li key={`${key}-${item.id}`}>
                      <Link
                        href={item.href}
                        className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{item.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
    </div>
  );
}
