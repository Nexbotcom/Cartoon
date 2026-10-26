import { NextResponse } from "next/server";
import { errMsg, getSpec } from "@/lib/ttsServer";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    const spec = await getSpec();
    return NextResponse.json({ voices: spec.voices, endpoint: spec.endpoint, textParam: spec.textParam, voiceParam: spec.voiceParam });
  } catch (e) {
    return NextResponse.json({ voices: [], error: errMsg(e) });
  }
}
