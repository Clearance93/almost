import { NextResponse } from "next/server";
import { listScores } from "@/lib/round-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gameId = new URL(request.url).searchParams.get("gameId");
  if (!gameId) {
    return NextResponse.json({ error: "gameId is required" }, { status: 400 });
  }

  try {
    return NextResponse.json(
      { leaderboard: await listScores(gameId) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("[api/scores]", error);
    return NextResponse.json({ error: "Could not read the scoreboard" }, { status: 500 });
  }
}
