import { get, set } from "idb-keyval";
import { CharacterDef } from "./types";
import { PRESETS } from "./presets";

const KEY = "toon:characters";

export async function listChars(): Promise<CharacterDef[]> {
  return (await get<CharacterDef[]>(KEY)) ?? [];
}
export async function saveChar(d: CharacterDef) {
  const all = await listChars();
  const i = all.findIndex(c => c.id === d.id);
  if (i >= 0) all[i] = d; else all.push(d);
  await set(KEY, all);
  return all;
}
export async function deleteChar(id: string) {
  const all = (await listChars()).filter(c => c.id !== id);
  await set(KEY, all);
  return all;
}
export const exportChar = (d: CharacterDef) => JSON.stringify(d, null, 2);

export function importChars(json: string): CharacterDef[] {
  const raw = JSON.parse(json);
  return (Array.isArray(raw) ? raw : [raw]).map((r: Partial<CharacterDef>) => ({
    ...PRESETS[0], ...r, id: crypto.randomUUID(),   // fill gaps so old or partial files still load
  }));
}
