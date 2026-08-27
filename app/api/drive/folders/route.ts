import { NextRequest, NextResponse } from "next/server";
import { getCurrentOwnerId } from "@/lib/auth";
import {
  getDriveAccessToken,
  listDriveFolders,
  searchDriveFolders,
} from "@/lib/google-drive";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** List / search Drive folders for the connected Google account. */
export async function GET(req: NextRequest) {
  try {
    const ownerId = await getCurrentOwnerId();
    const parent = (req.nextUrl.searchParams.get("parent") || "root").trim();
    const q = (req.nextUrl.searchParams.get("q") || "").trim();

    const accessToken = await getDriveAccessToken(ownerId);
    const folders = q
      ? await searchDriveFolders(accessToken, q)
      : await listDriveFolders(accessToken, parent || "root");

    return NextResponse.json({
      parent: q ? null : parent || "root",
      folders,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status =
      msg.includes("אין חיבור") || msg.includes("חסרה הרשאת") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
