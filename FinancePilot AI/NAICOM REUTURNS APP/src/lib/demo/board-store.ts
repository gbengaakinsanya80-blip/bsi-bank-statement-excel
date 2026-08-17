import { promises as fs } from "fs";
import os from "os";
import path from "path";
import type { BoardMeeting } from "@/lib/board/types";

interface BoardStore {
  meetings: Record<string, BoardMeeting>;
  minutesTemplate: string;
}

const STORE_PATH = process.env.WORLDMARK_BOARD_STORE_PATH
  ? path.resolve(process.env.WORLDMARK_BOARD_STORE_PATH)
  : path.join(os.tmpdir(), "worldmark-demo-board.json");

let writeChain: Promise<unknown> = Promise.resolve();

function emptyStore(): BoardStore {
  return { meetings: {}, minutesTemplate: "" };
}

async function loadStore(): Promise<BoardStore> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return { ...emptyStore(), ...(JSON.parse(raw) as BoardStore) };
  } catch {
    return emptyStore();
  }
}

async function saveStore(store: BoardStore): Promise<void> {
  writeChain = writeChain.then(async () => {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  });
  await writeChain;
}

export async function upsertDemoMeeting(meeting: BoardMeeting): Promise<void> {
  const store = await loadStore();
  store.meetings[meeting.id] = meeting;
  await saveStore(store);
}

export async function deleteDemoMeeting(id: string): Promise<void> {
  const store = await loadStore();
  const meeting = store.meetings[id];
  if (meeting) {
    store.meetings[id] = { ...meeting, deleted_at: new Date().toISOString() };
    await saveStore(store);
  }
}

export async function listDemoMeetings(): Promise<BoardMeeting[]> {
  const store = await loadStore();
  return Object.values(store.meetings)
    .filter((m) => !m.deleted_at)
    .sort((a, b) => (b.meeting_date ?? "").localeCompare(a.meeting_date ?? ""));
}

export async function getDemoMeeting(id: string): Promise<BoardMeeting | null> {
  const store = await loadStore();
  const meeting = store.meetings[id];
  return meeting && !meeting.deleted_at ? meeting : null;
}

export async function getDemoMinutesTemplate(): Promise<string> {
  const store = await loadStore();
  return store.minutesTemplate;
}

export async function saveDemoMinutesTemplate(html: string): Promise<void> {
  const store = await loadStore();
  store.minutesTemplate = html;
  await saveStore(store);
}
