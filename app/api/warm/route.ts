import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { TABLES, getTablesDb, ids, withRetry } from "@/lib/appwrite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cheap keep-warm ping. The play screen calls this as soon as it mounts, so
 * the database connection and the Appwrite cold start are paid for while the
 * players are still typing their names.
 */
export async function GET() {
  try {
    await withRetry(
      () =>
        getTablesDb().listRows({
          databaseId: ids.database,
          tableId: TABLES.words,
          queries: [Query.limit(1)],
        }),
      2,
      300,
    );
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
