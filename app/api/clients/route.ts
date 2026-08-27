import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import {
  getSql,
  parseClient,
  type CaseType,
  type ClientRow,
  type ReminderChannel,
} from "@/lib/db";
import { getCurrentOwnerId } from "@/lib/auth";
import { BANK_OPTIONS, CASE_TYPES } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseOptionalNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseCaseFields(body: Record<string, unknown>) {
  const caseTypeRaw = body.caseType ? String(body.caseType) : null;
  const caseType =
    caseTypeRaw && (CASE_TYPES as string[]).includes(caseTypeRaw)
      ? (caseTypeRaw as CaseType)
      : null;
  const bankRaw = body.bank ? String(body.bank).trim() : null;
  const bank =
    bankRaw && (BANK_OPTIONS as readonly string[]).includes(bankRaw)
      ? bankRaw
      : bankRaw || null;
  const requiredAmount = parseOptionalNumber(body.requiredAmount);
  const propertyValue = parseOptionalNumber(body.propertyValue);
  const existingMortgage = parseOptionalNumber(body.existingMortgage);
  const propertyAddress = body.propertyAddress
    ? String(body.propertyAddress).trim() || null
    : null;
  const driveFolderUrl = body.driveFolderUrl
    ? String(body.driveFolderUrl).trim() || null
    : null;
  const driveFolderId = body.driveFolderId
    ? String(body.driveFolderId).trim() || null
    : null;
  const spouseName = body.spouseName
    ? String(body.spouseName).trim() || null
    : null;
  const spouseEmail = body.spouseEmail
    ? String(body.spouseEmail).trim() || null
    : null;
  const spousePhone = body.spousePhone
    ? String(body.spousePhone).trim() || null
    : null;
  const nationalId = body.nationalId
    ? String(body.nationalId).trim().replace(/\D/g, "") || null
    : null;
  return {
    caseType,
    bank,
    requiredAmount,
    propertyValue,
    existingMortgage,
    propertyAddress,
    driveFolderUrl,
    driveFolderId,
    spouseName,
    spouseEmail,
    spousePhone,
    nationalId,
  };
}

export async function GET() {
  try {
    const ownerId = await getCurrentOwnerId();
    const sql = getSql();
    const rows = await sql`
      SELECT * FROM clients WHERE owner_id = ${ownerId} ORDER BY created_at DESC
    `;
    return NextResponse.json((rows as ClientRow[]).map(parseClient));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ownerId = await getCurrentOwnerId();
    const body = await req.json();
    const name = String(body.name || "").trim();
    const emails = (Array.isArray(body.emails) ? body.emails : [])
      .map((x: unknown) => String(x || "").trim())
      .filter(Boolean);
    const phones = (Array.isArray(body.phones) ? body.phones : [])
      .map((x: unknown) => String(x || "").trim())
      .filter(Boolean);
    const channel = (body.reminderChannel || "email") as ReminderChannel;
    const caseFields = parseCaseFields(body);

    if (!name) {
      return NextResponse.json({ error: "שם הלקוח חובה" }, { status: 400 });
    }
    if (!["email", "phone", "both"].includes(channel)) {
      return NextResponse.json({ error: "ערוץ תזכורת לא תקין" }, { status: 400 });
    }

    const sql = getSql();
    const id = uuid();
    await sql`
      INSERT INTO clients (
        id, owner_id, name, emails, phones, reminder_channel,
        case_type, bank, required_amount, property_value, existing_mortgage, property_address,
        drive_folder_url, drive_folder_id,
        spouse_name, spouse_email, spouse_phone, national_id
      )
      VALUES (
        ${id}, ${ownerId}, ${name}, ${JSON.stringify(emails)}, ${JSON.stringify(phones)}, ${channel},
        ${caseFields.caseType}, ${caseFields.bank}, ${caseFields.requiredAmount},
        ${caseFields.propertyValue}, ${caseFields.existingMortgage}, ${caseFields.propertyAddress},
        ${caseFields.driveFolderUrl}, ${caseFields.driveFolderId},
        ${caseFields.spouseName}, ${caseFields.spouseEmail}, ${caseFields.spousePhone},
        ${caseFields.nationalId}
      )
    `;

    const rows = await sql`SELECT * FROM clients WHERE id = ${id}`;
    return NextResponse.json(parseClient((rows as ClientRow[])[0]));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
