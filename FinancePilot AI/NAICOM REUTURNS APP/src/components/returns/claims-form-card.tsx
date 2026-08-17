"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ClaimsForm } from "./claims-form";
import type { ClaimSource } from "@/lib/returns/types";

export function ClaimsFormCard() {
  const [claims, setClaims] = useState<ClaimSource[]>([]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/claims");
    if (res.ok) setClaims(await res.json());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <Card>
      <CardContent className="pt-6">
        <ClaimsForm claims={claims} onRefresh={refresh} />
      </CardContent>
    </Card>
  );
}
