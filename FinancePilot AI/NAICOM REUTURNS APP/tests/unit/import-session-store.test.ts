import { describe, expect, it } from "vitest";
import {
  createImportSession,
  getImportSession,
  updateImportSession,
} from "@/lib/import/session-store";

describe("import session store", () => {
  it("creates, reads and updates sessions with auto-mapping", async () => {
    const session = await createImportSession({
      fileName: "CRR Q1 2026.xlsx",
      sheetName: "Sheet1",
      headers: ["POLICY NO", "NAME OF CLIENT", "GROSS PREMIUM"],
      rows: [
        ["WMK/1", "Zenith Bank Plc", 1000],
        ["WMK/2", "Dangote", 2000],
      ],
    });

    expect(session.id).toMatch(/^imp-\d+$/);
    expect(session.mapping.map((m) => m.targetKey)).toEqual([
      "policy_number",
      "client_name",
      "gross_premium",
    ]);

    const loaded = await getImportSession(session.id);
    expect(loaded?.headers).toEqual(["POLICY NO", "NAME OF CLIENT", "GROSS PREMIUM"]);
    expect(loaded?.rows).toHaveLength(2);

    const updated = await updateImportSession(session.id, {
      mapping: [{ index: 0, sourceHeader: "POLICY NO", targetKey: null }],
    });
    expect(updated?.mapping[0].targetKey).toBeNull();
    expect((await getImportSession(session.id))?.mapping[0].targetKey).toBeNull();

    expect(await getImportSession("imp-missing")).toBeNull();
  });
});
