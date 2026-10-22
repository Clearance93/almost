import { NextResponse } from "next/server";
import { z } from "zod";
import { open } from "@/lib/seal";
import type { RevealPayload } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  sealed: z.string().min(16),
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
    return NextResponse.json({ error: "Missing round token" }, { status: 400 });
  }

  try {
    const reveal = open<RevealPayload>(parsed.data.sealed);
    return NextResponse.json(reveal, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "That round token is not valid" }, { status: 400 });
  }
}
