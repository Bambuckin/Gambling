import { NextResponse } from "next/server";
import { listMockTerminalInboxRows } from "../../../../../lib/purchase/mock-terminal-inbox";

export async function GET(): Promise<NextResponse> {
  const rows = await listMockTerminalInboxRows();
  return NextResponse.json({
    fetchedAt: new Date().toISOString(),
    rows
  });
}
