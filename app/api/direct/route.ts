import { NextResponse } from "next/server";

const system = (names: string[]) => `You are a film director's assistant. Rewrite the user's direction as a script.
Actors available: ${names.join(", ")}.
Rules:
- One line per beat, format "Name: what they do". Use only the actor names above.
- Spoken dialogue goes in double quotes, e.g. Sam: "Hello!" smiling and waving
- Allowed actions: walk to <Name> / left / right / center, wave, point, shrug, jump, type on a laptop,
  look at <Name> / the camera / left / right, nod, shake head, turn around, face the camera,
  smile, sad, angry, surprised. Add "for 3 seconds" to set a duration. Use "then" to chain actions inside one line.
- Camera lines: "Camera: zoom in on <Name>", "Camera: close-up on <Name>", "Camera: pan left", "Camera: pan right",
  "Camera: follow <Name>", "Camera: zoom out".
- A line starting with "&" happens at the same time as the previous line.
- Output ONLY the script. No markdown, no explanations.`;

export async function POST(req: Request) {
  try {
    const { text, names } = (await req.json()) as { text: string; names: string[] };
    const key = process.env.GEMINI_API_KEY;
    if (!key) return NextResponse.json({ error: "GEMINI_API_KEY is not set in Vercel" }, { status: 500 });
    const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system(names) }] },
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: { temperature: 0.3 },
      }),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data?.error?.message ?? "Gemini error" }, { status: 502 });
    const out: string = (data?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
    return NextResponse.json({ script: out.replace(/```[a-z]*\n?|```/g, "").trim() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
