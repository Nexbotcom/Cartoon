import { get, set } from "idb-keyval";
import { CastMember, PropMember, ThemeId } from "./types";

export interface SceneFile {
  name: string;
  note?: string;
  theme: ThemeId;
  cast: CastMember[];
  props: PropMember[];
  script: string;
}

const KEY = "toon:scenes";

export async function listScenes(): Promise<SceneFile[]> {
  return (await get<SceneFile[]>(KEY)) ?? [];
}
export async function saveScene(s: SceneFile): Promise<SceneFile[]> {
  const all = await listScenes();
  const i = all.findIndex(x => x.name === s.name);
  if (i >= 0) all[i] = s; else all.push(s);
  await set(KEY, all);
  return all;
}
export async function deleteScene(name: string): Promise<SceneFile[]> {
  const all = (await listScenes()).filter(x => x.name !== name);
  await set(KEY, all);
  return all;
}
export const exportScenes = (all: SceneFile[]) => JSON.stringify(all, null, 2);

export function importScenes(json: string): SceneFile[] {
  const raw = JSON.parse(json);
  const arr: unknown[] = Array.isArray(raw) ? raw : [raw];
  return arr.filter((x): x is SceneFile => {
    const o = x as Partial<SceneFile> | null;
    return !!o && typeof o.name === "string" && typeof o.script === "string" && Array.isArray(o.cast) && Array.isArray(o.props);
  });
}
