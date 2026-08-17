"use client";

import { useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { generateMinutesAction } from "@/lib/board/board-actions";
import {
  DEFAULT_AGENDA,
  buildMinutesFormHtml,
  parseMinutesFormValues,
  type MinutesAgendaRow,
} from "@/lib/board/template";
import type { BoardAttendee, BoardMeeting } from "@/lib/board/types";

function namesFor(attendees: BoardAttendee[], presence: BoardAttendee["presence"]): string[] {
  return attendees.filter((a) => a.presence === presence).map((a) => a.name);
}

function NameList({
  label,
  names,
  onChange,
  placeholder,
}: {
  label: string;
  names: string[];
  onChange: (names: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const trimmed = draft.trim();
    if (!trimmed || names.includes(trimmed)) {
      setDraft("");
      return;
    }
    onChange([...names, trimmed]);
    setDraft("");
  }

  function remove(index: number) {
    onChange(names.filter((_, i) => i !== index));
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  }

  return (
    <Field label={label} hint="Type a name and press Enter or click Add">
      <div className="flex flex-wrap gap-1.5">
        {names.map((name, i) => (
          <span
            key={`${name}-${i}`}
            className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2.5 py-0.5 text-sm"
          >
            {name}
            <button
              type="button"
              onClick={() => remove(i)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20"
              aria-label={`Remove ${name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {names.length === 0 && (
          <span className="text-sm text-muted-foreground italic">No names added yet</span>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder ?? "Enter name"}
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>
    </Field>
  );
}

export function MinutesForm({
  meeting,
  initialHtml,
}: {
  meeting: BoardMeeting;
  initialHtml: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const parsed = parseMinutesFormValues(initialHtml);
  const agendaTitles = meeting.agenda.length ? meeting.agenda.map((a) => a.title) : DEFAULT_AGENDA;

  const [openingPrayer, setOpeningPrayer] = useState(parsed?.openingPrayer ?? "");
  const [present, setPresent] = useState<string[]>(
    parsed ? parsed.present : namesFor(meeting.attendees, "PRESENT")
  );
  const [apologies, setApologies] = useState<string[]>(
    parsed ? parsed.apologies : namesFor(meeting.attendees, "APOLOGY")
  );
  const [absent, setAbsent] = useState<string[]>(
    parsed ? parsed.absent : namesFor(meeting.attendees, "ABSENT")
  );
  const [inAttendance, setInAttendance] = useState<string[]>(
    parsed ? parsed.inAttendance : namesFor(meeting.attendees, "IN_ATTENDANCE")
  );
  const [agendaRows, setAgendaRows] = useState<MinutesAgendaRow[]>(() =>
    parsed && parsed.agenda.length
      ? parsed.agenda
      : agendaTitles.map((title) => ({ title, deliberation: "" }))
  );
  const [adjournment, setAdjournment] = useState(parsed?.adjournment ?? "");

  const html = buildMinutesFormHtml(meeting, {
    openingPrayer,
    present,
    apologies,
    absent,
    inAttendance,
    agenda: agendaRows,
    adjournment,
  });

  function updateAgenda(index: number, patch: Partial<MinutesAgendaRow>) {
    setAgendaRows((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeAgenda(index: number) {
    setAgendaRows((rows) => rows.filter((_, i) => i !== index));
  }

  function addAgenda() {
    setAgendaRows((rows) => [...rows, { title: "", deliberation: "" }]);
  }

  function generate() {
    const form = new FormData();
    form.set("id", meeting.id);
    form.set("opening_prayer", openingPrayer);
    form.set("present", present.join("\n"));
    form.set("apologies", apologies.join("\n"));
    form.set("absent", absent.join("\n"));
    form.set("in_attendance", inAttendance.join("\n"));
    form.set("agenda", JSON.stringify(agendaRows));
    form.set("adjournment", adjournment);
    setMessage(null);
    startTransition(() => {
      generateMinutesAction(form).then(() => {
        setPreview(html);
        setMessage("Minutes generated and saved. You can keep editing and generate again.");
        router.refresh();
      });
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Fill in the form below — opening prayer, attendance and what was discussed under each
        agenda item — then click <strong>Generate minutes</strong>.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Opening prayer said by">
          <Input
            value={openingPrayer}
            onChange={(e) => setOpeningPrayer(e.target.value)}
            placeholder="e.g. Mr. Sola"
          />
        </Field>
        <Field label="Adjournment / closing remarks">
          <Input
            value={adjournment}
            onChange={(e) => setAdjournment(e.target.value)}
            placeholder="e.g. There being no further business, the meeting was adjourned at 12:30pm."
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NameList
          label="Present members"
          names={present}
          onChange={setPresent}
          placeholder="e.g. Chairman"
        />
        <NameList
          label="Apologies"
          names={apologies}
          onChange={setApologies}
          placeholder="e.g. Director Name"
        />
        <NameList
          label="Absent"
          names={absent}
          onChange={setAbsent}
          placeholder="e.g. Director Name"
        />
        <NameList
          label="In attendance"
          names={inAttendance}
          onChange={setInAttendance}
          placeholder="e.g. Company Secretary"
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Agenda and deliberations</h3>
        {agendaRows.map((row, i) => (
          <div key={i} className="space-y-2 rounded-md border bg-muted/20 p-3">
            <div className="flex items-start gap-2">
              <span className="mt-2 text-sm font-semibold text-muted-foreground">{i + 1}.</span>
              <div className="flex-1 space-y-2">
                <Input
                  value={row.title}
                  onChange={(e) => updateAgenda(i, { title: e.target.value })}
                  placeholder="Agenda item title"
                />
                <Textarea
                  rows={3}
                  value={row.deliberation}
                  onChange={(e) => updateAgenda(i, { deliberation: e.target.value })}
                  placeholder="What was discussed / decided under this item"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-0.5"
                onClick={() => removeAgenda(i)}
                aria-label={`Remove agenda item ${i + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addAgenda}>
          <Plus className="h-4 w-4" />
          Add agenda item
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={generate} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Generate minutes
        </Button>
        {message && <p className="text-xs text-muted-foreground">{message}</p>}
      </div>

      {preview && (
        <div className="rounded-md border bg-muted/20 px-4 py-3">
          <h3 className="mb-2 text-sm font-semibold">Generated minutes</h3>
          <div
            className="min-h-[200px] rounded-md border bg-background px-4 py-3 text-sm leading-relaxed [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        </div>
      )}
    </div>
  );
}
