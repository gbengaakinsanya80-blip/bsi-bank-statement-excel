"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BellRing, CheckCheck, CircleAlert, Info, ShieldCheck, X } from "lucide-react";
import type { AppNotification } from "@/lib/compliance/notifications";
import { markNotificationsReadAction } from "@/lib/compliance/notifications-actions";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format";

function typeIcon(type: AppNotification["type"], className: string) {
  if (type === "DEADLINE") return <CircleAlert className={className} />;
  if (type === "VALIDATION") return <BellRing className={className} />;
  if (type === "WORKFLOW") return <ShieldCheck className={className} />;
  return <Info className={className} />;
}

function typeColor(type: AppNotification["type"]) {
  if (type === "DEADLINE") return "text-destructive";
  if (type === "VALIDATION") return "text-warning";
  if (type === "WORKFLOW") return "text-success";
  return "text-muted-foreground";
}

export function NotificationBell({ notifications }: { notifications: AppNotification[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  async function markAll() {
    setBusy(true);
    setError(null);
    try {
      const res = await markNotificationsReadAction(notifications.map((n) => n.id));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function markRead(id: string) {
    const res = await markNotificationsReadAction([id]);
    if (res.ok) router.refresh();
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-sm font-semibold">Notifications</p>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAll}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-accent disabled:opacity-50"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent"
                aria-label="Close notifications"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {error && <p className="border-b px-3 py-2 text-xs text-destructive">{error}</p>}

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="p-4 text-center text-sm text-muted-foreground">No notifications yet.</p>
            )}
            {notifications.map((n) => (
              <Link
                key={n.id}
                href={n.link}
                onClick={() => {
                  setOpen(false);
                  if (!n.read) markRead(n.id);
                }}
                className={cn(
                  "flex gap-3 border-b px-3 py-2.5 last:border-b-0 hover:bg-accent",
                  !n.read && "bg-primary/5"
                )}
              >
                <span className={cn("mt-0.5 shrink-0", typeColor(n.type))}>
                  {typeIcon(n.type, "h-4 w-4")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{n.title}</span>
                    {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                    {n.body}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground/70">
                    {formatDateTime(n.createdAt)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
