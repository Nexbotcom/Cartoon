export type StyleId = "stick" | "flat" | "anime" | "sketch";
export type Expr = "neutral" | "happy" | "sad" | "angry" | "surprised";
export type ClipId = "idle" | "walk" | "run" | "wave" | "talk" | "type" | "jump" | "point" | "shrug" | "kick";
export type View = "front" | "side" | "back";
export type ThemeId =
  | "day" | "sunset" | "night" | "park" | "room" | "pitch" | "school" | "hospital"
  | "bedroom" | "house" | "classroom" | "ward";
export type PropKind =
  | "sofa" | "chair" | "table" | "desk" | "bookshelf" | "lamp" | "plant"
  | "tv" | "door" | "bed" | "tree" | "bench" | "streetlight" | "car"
  | "box" | "cake" | "bag" | "ball" | "goal" | "board"
  | "wardrobe" | "fridge" | "counter" | "rug" | "picture" | "clock" | "window"
  | "curtains" | "fan" | "locker" | "bin" | "bush" | "fence" | "crowd" | "ivstand" | "phone";

export interface CharacterDef {
  id: string; name: string; style: StyleId;
  skin: string; hair: string; eye: string; top: string; bottom: string; shoes: string;
  hairStyle: "short" | "spiky" | "bun" | "long" | "none";
  outfit: "pants" | "shorts" | "skirt";
  sleeve: "short" | "long";
  build: number;   // 0.8 slim to 1.25 broad
  voice?: string;  // text-to-speech voice; empty = the voice named like the character
  height: number;
}

export interface Pose {
  aLU: number; aLB: number; aRU: number; aRB: number;
  lLU: number; lLB: number; lRU: number; lRB: number;
  yaw: number; pitch: number; tilt: number;
  lean: number; bob: number; mouth: number; blink: number; eyeX: number; eyeY: number;
  sit: number;   // 0 standing .. 1 sitting
  lie: number;   // 0 .. 1 lying on a bed
}

export interface Action {
  t0: number; t1: number;
  clip?: ClipId; expr?: Expr; say?: string; moveTo?: number;
  look?: string; nod?: boolean; shake?: boolean; view?: View;
  fromX?: number;      // start this move from here (enter from off-screen or a door)
  enter?: boolean;     // becomes visible at t0
  exit?: boolean;      // becomes invisible after t1
  toDepth?: number;    // move to this depth while moving
  fromDepth?: number;  // start the move at this depth
  lift?: number;       // height above the floor in pixels (objects placed on tables)
  ride?: number;       // actor is inside the prop with this index during [t0, t1]
  posture?: "sit" | "stand" | "lie";
  rot?: number;        // direction (degrees) a seated character faces
  lin?: boolean;       // move in a straight line at constant speed (a kicked ball)
  power?: boolean;     // for props: switched on / open (true) or off / closed (false)
  open?: boolean;      // for doors: open during [t0, t1]
}

export interface PoseBlock { t0: number; t1: number; pose: Partial<Pose> }
export interface Hold { t0: number; t1: number; by: number }   // an actor carries a prop

export interface Actor {
  def: CharacterDef; x: number; depth: number; actions: Action[]; keys: PoseBlock[]; startHidden?: boolean;
}
export interface CastMember { def: CharacterDef; x: number; depth: number; keys?: PoseBlock[] }

export interface PropMember { 
  id: string; kind: PropKind; name: string; x: number; depth: number; scale: number; color: string; flip: boolean;
  y?: number;     // height above the floor in metres
  rot?: number;   // turn in degrees (3D)
}
export interface SceneProp extends PropMember { actions: Action[]; holds: Hold[]; startHidden?: boolean }

// follow: 0..999 = actor index, 1000+ = prop index + 1000
export interface CamKey { t: number; x: number; y: number; zoom: number; follow?: number }
// A 360 / orbit camera move. Only used by the 3D mode, and only where the script asks for it.
export interface Shot3D { t0: number; t1: number; deg: number; target?: number }
export interface Scene { duration: number; actors: Actor[]; props: SceneProp[]; cam: CamKey[]; shots: Shot3D[]; warnings: string[] }
