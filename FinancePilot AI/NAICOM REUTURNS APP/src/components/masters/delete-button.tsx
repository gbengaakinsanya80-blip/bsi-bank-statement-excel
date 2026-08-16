"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DeleteButton({
  id,
  action,
  confirmMessage = "Delete this record? This cannot be undone.",
}: {
  id: string;
  action: (formData: FormData) => Promise<void>;
  confirmMessage?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" size="sm" aria-label="Delete">
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </form>
  );
}
