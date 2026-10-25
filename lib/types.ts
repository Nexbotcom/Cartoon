export type StyleId = "stick" | "flat" | "anime" | "sketch";
export type Expr = "neutral" | "happy" | "sad" | "angry" | "surprised";
export type ClipId = "idle" | "walk" | "run" | "wave" | "talk" | "type" | "jump" | "point" | "shrug";
export type View = "front" | "side" | "back";
export type ThemeId = "day" | "sunset" | "night" | "park" | "room";
export type PropKind =
  | "sofa" | "chair" | "table" | "desk" | "bookshelf" | "lamp" | "plant"
  | "tv" | "door" | "bed" | "tree" | "bench" | "streetlight" | "car";

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
  aLU: number; aLB: number; aRU: number; aRB: number;
  lLU: number; lLB: number; lRU: number; lRB: number;
  yaw: number; pitch: number; tilt: number;
  lean: number; bob: number; mouth: number; blink: number; eyeX: number; eyeY: number;
}

export interface Action {
  t0: number; t1: number;
  clip?: ClipId; expr?: Expr; say?: string; moveTo?: number;
  look?: string; nod?: boolean; shake?: boolean; view?: View;
  fromX?: number;     // start this move from here (used to enter from off-screen)
  enter?: boolean;    // becomes visible at t0
  exit?: boolean;     // becomes invisible after t1
}

export interface PoseBlock { t0: number; t1: number; pose: Partial<Pose> }

export interface Actor {
  def: CharacterDef; x: number; depth: number; actions: Action[]; keys: PoseBlock[]; startHidden?: boolean;
}
export interface CastMember { def: CharacterDef; x: number; depth: number; keys?: PoseBlock[] }

export interface PropMember {
  id: string; kind: PropKind; name: string; x: number; depth: number; scale: number; color: string; flip: boolean;
}
export interface SceneProp extends PropMember { actions: Action[]; startHidden?: boolean }

// follow: 0..999 = actor index, 1000+ = prop index + 1000
export interface CamKey { t: number; x: number; y: number; zoom: number; follow?: number }
export interface Scene { duration: number; actors: Actor[]; props: SceneProp[]; cam: CamKey[] }
