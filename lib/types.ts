export type StyleId = "stick" | "flat" | "anime" | "sketch";
export type Expr = "neutral" | "happy" | "sad" | "angry" | "surprised";
export type ClipId = "idle" | "walk" | "wave" | "talk" | "type" | "jump" | "point" | "shrug";
export type View = "front" | "side" | "back";
export type ThemeId = "day" | "sunset" | "night" | "park" | "room";
export type SpriteKey = "front" | "threeq" | "side" | "back";

// Imported art: one transparent PNG per view (data URLs), all cut from the same sheet scale.
export interface SpritePack {
  views: Partial<Record<SpriteKey, string>>;
  refH: number;          // pixel height of the tallest view; maps to def.height
  sideRight: boolean;    // does the side view face screen-right in the image?
  threeqRight: boolean;  // does the 3/4 view face screen-right in the image?
}

export interface CharacterDef {
  id: string; name: string; style: StyleId;
  skin: string; hair: string; eye: string; top: string; bottom: string; shoes: string;
  hairStyle: "short" | "spiky" | "bun" | "long" | "none";
  outfit: "pants" | "shorts" | "skirt";
  sleeve: "short" | "long";
  build: number;   // 0.8 slim to 1.25 broad
  height: number;
  sprite?: SpritePack;   // if set, the actor is drawn from imported art
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
