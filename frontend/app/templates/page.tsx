"use client";

import * as React from "react";
import { Landmark, Loader2 } from "lucide-react";
import { getTemplates } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function TemplatesPage() {
  const [banks, setBanks] = React.useState<string[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getTemplates().then(setBanks).catch(() => setError("Could not load supported banks."));
  }, []);

  return (
    <main className="container py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Supported Banks</h1>
        <p className="text-sm text-muted-foreground">
          These statement layouts are recognised out of the box. Unknown layouts fall back to
          automatic layout detection.
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {!banks ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {banks.map((bank) => (
            <Card key={bank}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Landmark className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{bank}</p>
                  <Badge variant="success">Supported</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
