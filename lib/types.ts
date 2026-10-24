export type StyleId = "stick" | "flat" | "anime" | "sketch";
export type Expr = "neutral" | "happy" | "sad" | "angry" | "surprised";
export type ClipId = "idle" | "walk" | "wave" | "talk" | "type" | "jump" | "point" | "shrug";
export type View = "front" | "side" | "back";

export interface CharacterDef {
  id: string; name: string; style: StyleId;
  skin: string; hair: string; eye: string; top: string; bottom: string; shoes: string;
  hairStyle: "short" | "spiky" | "bun" | "long" | "none";
  outfit: "pants" | "shorts" | "skirt";
  sleeve: "short" | "long";
  build: number;   // 0.8 slim to 1.25 broad
  height: number;
}

export interface Pose {
  aLU: number; aLB: number; aRU: number; aRB: number;   // arms: upper angle, elbow bend
  lLU: number; lLB: number; lRU: number; lRB: number;   // legs: upper angle, knee bend / lift
  yaw: number; pitch: number; tilt: number;             // head, degrees
  lean: number; bob: number; mouth: number; blink: number; eyeX: number; eyeY: number;
}

export interface Action {
  t0: number; t1: number;
  clip?: ClipId; expr?: Expr; say?: string; moveTo?: number;
  look?: string; nod?: boolean; shake?: boolean; view?: View;
}
export interface Actor { def: CharacterDef; x: number; depth: number; actions: Action[] }
export interface CastMember { def: CharacterDef; x: number; depth: number }
export interface CamKey { t: number; x: number; y: number; zoom: number; follow?: number }
export interface Scene { duration: number; actors: Actor[]; cam: CamKey[] }
