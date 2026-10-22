import { NextResponse } from "next/server";
import { z } from "zod";
import { finishRound } from "@/lib/round-store";
import { friendlyError, isTransient, withRetry } from "@/lib/appwrite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  sealed: z.string().min(16),
  accusedPlayerId: z.string().min(1).max(64),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing the round token or the accused" }, { status: 400 });
  }

  try {
    const payload = await withRetry(
      () =>
        finishRound({
          sealed: parsed.data.sealed,
          accusedPlayerId: parsed.data.accusedPlayerId,
        }),
      4,
      400,
    );
    return NextResponse.json(payload, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = friendlyError(error, "Could not score the round");
    const alreadyScored = message.includes("already been scored");
    const status = alreadyScored ? 409 : isTransient(error) ? 503 : 400;
    console.error("[api/round/finish]", message);
    return NextResponse.json({ error: message }, { status });
  }
}
