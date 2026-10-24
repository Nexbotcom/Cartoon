export type StyleId = "stick" | "flat" | "anime" | "sketch";
export type Expr = "neutral" | "happy" | "sad" | "angry" | "surprised";
export type ClipId = "idle" | "walk" | "wave" | "talk" | "type" | "jump" | "point" | "shrug";
export type View = "front" | "side" | "back";
export type ThemeId = "day" | "sunset" | "night" | "park" | "room";
export type SpriteKey = "front" | "threeq" | "side" | "back";

// ---- cut-out rig (limbs that move, built from the front picture) ----
export type PartKey = "head" | "torso" | "armLU" | "armLL" | "armRU" | "armRL" | "legLU" | "legLL" | "legRU" | "legRL";

// Cut lines as fractions (0..1) of the front picture. y values go top to bottom.
export interface RigParams {
  neckY: number; shoulderY: number; elbowY: number; armEndY: number; hipY: number; kneeY: number;
  lc: number;   // left cut: arm (screen-left) | torso
  rc: number;   // right cut: torso | arm (screen-right)
  cx: number;   // centre line between the legs
}
export interface MouthParams { x: number; y: number; w: number }   // fractions of the front picture
export interface RigPart { url: string; ox: number; oy: number; w: number; h: number; jx: number; jy: number }
export interface RigData {
  W: number; H: number;
  parts: Record<PartKey, RigPart>;
  mouth?: { x: number; y: number; w: number };   // in source pixels
}

// Imported art: one transparent PNG per view (data URLs).
export interface SpritePack {
  views: Partial<Record<SpriteKey, string>>;
  refH: number;          // pixel height of the tallest view; maps to def.height
  sideRight: boolean;
  threeqRight: boolean;
  rig?: RigData;         // if present, the front picture is animated as cut-out parts
  walkFront?: boolean;   // walk facing the camera with the rig (default true)
}

export interface CharacterDef {
  id: string; name: string; style: StyleId;
  skin: string; hair: string; eye: string; top: string; bottom: string; shoes: string;
  hairStyle: "short" | "spiky" | "bun" | "long" | "none";
  outfit: "pants" | "shorts" | "skirt";
  sleeve: "short" | "long";
  build: number;
  height: number;
  sprite?: SpritePack;
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
}

export interface PoseBlock { t0: number; t1: number; pose: Partial<Pose> }

export interface Actor { def: CharacterDef; x: number; depth: number; actions: Action[]; keys: PoseBlock[] }
export interface CastMember { def: CharacterDef; x: number; depth: number; keys?: PoseBlock[] }
export interface CamKey { t: number; x: number; y: number; zoom: number; follow?: number }
export interface Scene { duration: number; actors: Actor[]; cam: CamKey[] }
