import { Client } from "@gradio/client";

const SPACE = process.env.TTS_SPACE || "FreshB/tts-voice-backend";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

export interface TtsSpec { endpoint: string; textParam: string; voiceParam: string | null; voices: string[] }

let clientP: Promise<Client> | null = null;
let specP: Promise<TtsSpec> | null = null;

export function getClient(): Promise<Client> {
  if (!clientP) {
    const token = process.env.HF_TOKEN;
    if (!token) return Promise.reject(new Error("HF_TOKEN is not set in the Vercel project settings."));
    clientP = Client.connect(SPACE, { hf_token: token as `hf_${string}` });
    clientP.catch(() => { clientP = null; specP = null; });
  }
  return clientP;
}

// the list of choices of a dropdown parameter, read from the Space's API description
const choicesOf = (p: Loose): string[] => {
  const raw = p?.python_type?.type ?? p?.type?.type ?? p?.type;
  const s = typeof raw === "string" ? raw : JSON.stringify(raw ?? "");
  const list = Array.from(s.matchAll(/'([^']+)'/g)).map((m: RegExpMatchArray) => m[1]);
  if (list.length) return list;
  const en = p?.type?.enum ?? p?.enum;
  return Array.isArray(en) ? en.map(String) : [];
};

// finds the endpoint, the text parameter and the voice parameter by itself.
// Pin them with TTS_API_NAME, TTS_TEXT_PARAM and TTS_VOICE_PARAM if needed.
export function getSpec(): Promise<TtsSpec> {
  if (!specP) {
    specP = (async () => {
      const client = await getClient();
      const api: Loose = await client.view_api();
      const named: Record<string, Loose> = api?.named_endpoints ?? {};
      const forced = process.env.TTS_API_NAME;
      const names = forced ? [forced.startsWith("/") ? forced : "/" + forced] : Object.keys(named);
      const pname = (p: Loose): string => String(p?.parameter_name ?? p?.label ?? "");
      for (const name of names) {
        const params: Loose[] = named[name]?.parameters ?? [];
        const textP = params.find(p => /^text$/i.test(pname(p))) ?? params.find(p => /text|prompt|script|sentence/i.test(pname(p)));
        if (!textP && !forced) continue;
        const voiceP = params.find(p => p !== textP && /style|voice|speaker|name/i.test(pname(p))) ?? params.find(p => p !== textP);
        return {
          endpoint: name,
          textParam: process.env.TTS_TEXT_PARAM || pname(textP ?? params[0]),
          voiceParam: process.env.TTS_VOICE_PARAM || (voiceP ? pname(voiceP) : null),
          voices: voiceP ? choicesOf(voiceP) : [],
        } as TtsSpec;
      }
      throw new Error("Could not find a text-to-speech endpoint on the Space. Set TTS_API_NAME in Vercel.");
    })();
    specP.catch(() => { specP = null; });
  }
  return specP;
}

export function errMsg(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const o = e as { message?: unknown; title?: unknown; detail?: unknown };
    for (const v of [o.message, o.title, o.detail]) if (typeof v === "string" && v) return v;
    try { return JSON.stringify(e); } catch { return "Unknown error"; }
  }
  return String(e);
}

export async function synthesize(text: string, voiceIn: string): Promise<{ bytes: ArrayBuffer; type: string }> {
  const client = await getClient();
  const spec = await getSpec();

  let voice = voiceIn;
  if (spec.voices.length && voice) {
    const hit = spec.voices.find(v => v.toLowerCase() === voice.toLowerCase());
    if (!hit) throw new Error(`Unknown voice "${voice}". Available voices: ${spec.voices.join(", ")}.`);
    voice = hit;
  }

  const payload: Record<string, unknown> = { [spec.textParam]: text };
  if (spec.voiceParam && voice) payload[spec.voiceParam] = voice;
  const res: Loose = await client.predict(spec.endpoint, payload);

  const out: Loose = res?.data?.[0];
  let url: string | undefined = typeof out === "string" ? out : out?.url ?? out?.path;
  if (!url) throw new Error("The voice backend returned no audio.");

  if (url.startsWith("data:")) {
    const buf = Buffer.from(url.split(",")[1] ?? "", "base64");
    return { bytes: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, type: "audio/wav" };
  }
  if (!/^https?:/.test(url)) url = `https://${SPACE.replace("/", "-").toLowerCase()}.hf.space/gradio_api/file=${url}`;

  const f = await fetch(url, { headers: process.env.HF_TOKEN ? { Authorization: `Bearer ${process.env.HF_TOKEN}` } : {} });
  if (!f.ok) throw new Error(`Could not download the audio (${f.status}).`);
  return { bytes: await f.arrayBuffer(), type: f.headers.get("content-type") || "audio/wav" };
}
