import { NextResponse } from "next/server";
import { z } from "zod";
import { validatePlayerNames } from "@/lib/game";
import { buildRound } from "@/lib/round-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  deck: z.string().min(1).max(32).default("any"),
  spice: z.enum(["mild", "medium", "hot"]).default("medium"),
  names: z.array(z.string()).min(4).max(10),
  gameId: z.uuid().optional(),
  roundIndex: z.number().int().min(0).max(2).default(0),
  seed: z.number().int().nonnegative().optional(),
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
    return NextResponse.json(
      { error: "Check the player names, deck, and spice." },
      { status: 400 },
    );
  }

  try {
    const names = validatePlayerNames(parsed.data.names);
    const round = await buildRound({
      deck: parsed.data.deck,
      spice: parsed.data.spice,
      names,
      gameId: parsed.data.gameId,
      roundIndex: parsed.data.roundIndex,
      seed: parsed.data.seed,
    });

    return NextResponse.json(round, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not build a round";
    console.error("[api/round]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
