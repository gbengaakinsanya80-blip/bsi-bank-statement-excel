import { NextRequest, NextResponse } from "next/server";
import { addClaim, listAllClaims } from "@/lib/returns/claims-store";

export async function GET() {
  const claims = await listAllClaims();
  return NextResponse.json(claims);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const claim = await addClaim({
    date_notified_by_insured: body.date_notified_by_insured ?? null,
    date_notified_to_insurer: body.date_notified_to_insurer ?? null,
    insurer_name: body.insurer_name ?? null,
    claim_no: body.claim_no ?? null,
    claim_amount: body.claim_amount ?? null,
    date_discharge_voucher: body.date_discharge_voucher ?? null,
    insured_beneficiary: body.insured_beneficiary ?? null,
    date_payment: body.date_payment ?? null,
    remarks: body.remarks ?? null,
  });
  return NextResponse.json(claim, { status: 201 });
}
