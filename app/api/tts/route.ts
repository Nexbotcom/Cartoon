import { NextResponse } from "next/server";
import { errMsg, synthesize } from "@/lib/ttsServer";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { text?: string; voice?: string; style?: string };
    const text = (body.text ?? "").trim();
    if (!text) return NextResponse.json({ error: "No text to speak." }, { status: 400 });
    if (text.length > 800) return NextResponse.json({ error: "That line is too long (800 characters at most)." }, { status: 400 });
    const { bytes, type } = await synthesize(text, (body.voice ?? body.style ?? "").trim());
    return new Response(bytes, { headers: { "Content-Type": type, "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: errMsg(e) }, { status: 502 });
  }
}
