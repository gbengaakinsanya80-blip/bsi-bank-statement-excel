import { promises as fs } from "fs";
import os from "os";
import path from "path";
import type { CalendarItem } from "@/lib/compliance/calendar";
import type { BoardMeeting } from "@/lib/board/types";

export type NotificationType = "DEADLINE" | "VALIDATION" | "WORKFLOW" | "SYSTEM";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationReturnRef {
  id: string;
  name: string;
  code: string;
  periodLabel: string;
  status: string;
  createdAt: string;
  quality?: { errorCount: number; warningCount: number; hasErrors: boolean } | null;
}

const READ_STORE_PATH = path.join(os.tmpdir(), "worldmark-demo-notifications-read.json");

export function notificationIcon(type: NotificationType): "bell" | "alert" | "check" | "info" {
  switch (type) {
    case "DEADLINE":
      return "alert";
    case "VALIDATION":
      return "bell";
    case "WORKFLOW":
      return "check";
    default:
      return "info";
  }
}

export function deriveDemoNotifications(
  calendarItems: CalendarItem[],
  returns: NotificationReturnRef[]
): AppNotification[] {
  const notifications: AppNotification[] = [];

  notifications.push({
    id: "system:welcome",
    type: "SYSTEM",
    title: "Welcome to the Regulatory Hub",
    body: "Preview mode — generate returns, validate data quality, reconcile and track NAICOM deadlines.",
    link: "/returns",
    read: false,
    createdAt: "2026-01-01T08:00:00.000Z",
  });

  for (const item of calendarItems) {
    if (item.color === "RED") {
      notifications.push({
        id: `deadline:overdue:${item.code}:${item.periodKey}`,
        type: "DEADLINE",
        title: `${item.name} is overdue`,
        body: `${item.periodLabel} was due ${item.dueDate}. Complete and submit it as soon as possible.`,
        link: item.returnId ? `/returns/${item.returnId}` : "/returns/calendar",
        read: false,
        createdAt: new Date().toISOString(),
      });
    } else if (item.color === "ORANGE" || item.color === "YELLOW") {
      notifications.push({
        id: `deadline:due:${item.code}:${item.periodKey}`,
        type: "DEADLINE",
        title: `${item.name} due soon`,
        body: `${item.periodLabel} is due ${item.dueDate} (${item.daysRemaining} days remaining).`,
        link: item.returnId ? `/returns/${item.returnId}` : "/returns/calendar",
        read: false,
        createdAt: new Date().toISOString(),
      });
    } else if (item.requiresConfirmation && item.color !== "GREEN") {
      notifications.push({
        id: `deadline:unconfirmed:${item.code}`,
        type: "SYSTEM",
        title: `${item.name} — deadline requires confirmation`,
        body: "NAICOM has not confirmed this deadline. Review the requirement before submission.",
        link: "/returns/calendar",
        read: false,
        createdAt: new Date().toISOString(),
      });
    }
  }

  for (const r of returns) {
    if (r.quality?.hasErrors) {
      notifications.push({
        id: `validation:${r.code}:${r.id}`,
        type: "VALIDATION",
        title: `${r.name} has validation errors`,
        body: `${r.periodLabel} has ${r.quality.errorCount} outstanding error${r.quality.errorCount === 1 ? "" : "s"}. Fix them before submitting for review.`,
        link: `/returns/${r.id}`,
        read: false,
        createdAt: r.createdAt,
      });
    }
    if (r.status === "READY_FOR_REVIEW") {
      notifications.push({
        id: `workflow:ready:${r.code}:${r.id}`,
        type: "WORKFLOW",
        title: `${r.name} is ready for review`,
        body: `${r.periodLabel} awaits your review.`,
        link: `/returns/${r.id}`,
        read: false,
        createdAt: r.createdAt,
      });
    }
    if (r.status === "APPROVED") {
      notifications.push({
        id: `workflow:approved:${r.code}:${r.id}`,
        type: "WORKFLOW",
        title: `${r.name} approved`,
        body: `${r.periodLabel} is approved — remember to mark it submitted to NAICOM.`,
        link: `/returns/${r.id}`,
        read: false,
        createdAt: r.createdAt,
      });
    }
  }

  return notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Board meeting reminders: upcoming meetings, outstanding minutes, overdue action points. */
export function deriveBoardNotifications(meetings: BoardMeeting[]): AppNotification[] {
  const notifications: AppNotification[] = [];
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const dayMs = 24 * 60 * 60 * 1000;

  for (const m of meetings) {
    const daysToMeeting = Math.round(
      (new Date(`${m.meeting_date}T00:00:00`).getTime() - now.getTime()) / dayMs
    );

    if (daysToMeeting >= 0 && daysToMeeting <= 14) {
      notifications.push({
        id: `board:upcoming:${m.id}`,
        type: "WORKFLOW",
        title: `${m.meeting_number} is upcoming`,
        body: `Scheduled ${m.meeting_date}. Prepare agenda and board papers in good time.`,
        link: `/board/${m.id}`,
        read: false,
        createdAt: now.toISOString(),
      });
    }

    if (daysToMeeting < 0 && (m.status === "DRAFT" || m.status === "REVIEW")) {
      notifications.push({
        id: `board:minutes:${m.id}`,
        type: "WORKFLOW",
        title: `${m.meeting_number} minutes outstanding`,
        body: `Minutes are ${m.status === "REVIEW" ? "awaiting review" : "still in draft"}. Complete the approval workflow.`,
        link: `/board/${m.id}`,
        read: false,
        createdAt: now.toISOString(),
      });
    }

    if (m.status === "APPROVED") {
      notifications.push({
        id: `board:finalize:${m.id}`,
        type: "WORKFLOW",
        title: `${m.meeting_number} awaiting finalization`,
        body: "Approved minutes should be finalized for the permanent record.",
        link: `/board/${m.id}`,
        read: false,
        createdAt: now.toISOString(),
      });
    }

    for (const a of m.action_points) {
      if (a.status === "OPEN" || a.status === "IN_PROGRESS") {
        if (a.due_date && a.due_date < today) {
          notifications.push({
            id: `board:action-overdue:${m.id}:${a.id}`,
            type: "DEADLINE",
            title: "Board action point overdue",
            body: `"${a.action.slice(0, 80)}${a.action.length > 80 ? "…" : ""}" was due ${a.due_date}.`,
            link: `/board/${m.id}`,
            read: false,
            createdAt: now.toISOString(),
          });
        } else if (!a.due_date || a.due_date === today) {
          notifications.push({
            id: `board:action-due:${m.id}:${a.id}`,
            type: "DEADLINE",
            title: "Board action point due",
            body: `"${a.action.slice(0, 80)}${a.action.length > 80 ? "…" : ""}"${a.due_date ? ` is due ${a.due_date}` : " has no due date set"}.`,
            link: `/board/${m.id}`,
            read: false,
            createdAt: now.toISOString(),
          });
        }
      }
    }
  }

  return notifications;
}

export async function getDemoReadNotificationIds(): Promise<string[]> {
  try {
    const raw = await fs.readFile(READ_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as { readIds?: string[] };
    return parsed.readIds ?? [];
  } catch {
    return [];
  }
}

export async function markDemoNotificationsRead(ids: string[]): Promise<void> {
  const current = new Set(await getDemoReadNotificationIds());
  for (const id of ids) current.add(id);
  await fs.mkdir(path.dirname(READ_STORE_PATH), { recursive: true });
  await fs.writeFile(
    READ_STORE_PATH,
    JSON.stringify({ readIds: [...current] }, null, 2),
    "utf8"
  );
}

export async function withReadState(
  notifications: AppNotification[]
): Promise<AppNotification[]> {
  const readIds = new Set(await getDemoReadNotificationIds());
  return notifications.map((n) => ({ ...n, read: readIds.has(n.id) }));
}
