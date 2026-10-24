export type StyleId = "stick" | "flat" | "anime" | "sketch";
export type Expr = "neutral" | "happy" | "sad" | "angry" | "surprised";
export type ClipId = "idle" | "walk" | "wave" | "talk" | "type" | "jump";

export interface CharacterDef {
  id: string; name: string; style: StyleId;
  skin: string; hair: string; top: string; bottom: string; shoes: string;
  hairStyle: "short" | "bun" | "long" | "none";
  height: number;
}
export interface Pose {
  armL: number; armR: number; legL: number; legR: number;
  head: number; bob: number; mouth: number;
}
export interface Action {
  t0: number; t1: number; clip?: ClipId; expr?: Expr; say?: string; moveTo?: number;
}
export interface Actor { def: CharacterDef; x: number; actions: Action[] }
export interface CamKey { t: number; x: number; y: number; zoom: number; follow?: boolean }
export interface Scene { duration: number; actors: Actor[]; cam: CamKey[] }
