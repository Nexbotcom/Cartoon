import { PropKind, ThemeId } from "./types";

export const PART_LABEL: Record<string, string> = {
  back: "Back wall", left: "Left wall", right: "Right wall", front: "Front wall", ceiling: "Ceiling", floor: "Floor",
  decor: "Ceiling lights", stairs: "Stairs", backdrop: "Backdrop", trees: "Trees & plants", clouds: "Clouds",
  ground: "Ground & road", crowd: "Stadium crowd",
};

// positions are in metres: X left/right, Z front(+) / back(-); y is the height for wall and ceiling things
export interface TItem { kind: PropKind; X: number; Z: number; rot?: number; y?: number; color?: string; scale?: number }
const I = (kind: PropKind, X: number, Z: number, extra: Partial<TItem> = {}): TItem => ({ kind, X, Z, ...extra });

const street: TItem[] = [
  I("streetlight", -3, -6.9), I("streetlight", 5, -6.9), I("bench", 1.2, -7.4), I("bin", -1, -6.9),
  I("bush", -8.4, -7.9), I("bush", 9, -7.9),
];

export const TEMPLATES: Record<ThemeId, TItem[]> = {
  day: street, sunset: street, night: street,
  park: [
    I("tree", -8, -8), I("tree", -4, -12), I("tree", 6, -9), I("tree", 9, -5.5),
    I("bench", -2, -6), I("bench", 3, -4.5), I("bush", -6, -5), I("bush", 7.5, -7), I("bush", 0.5, -10), I("streetlight", 0, -9.5),
  ],
  pitch: [I("goal", 0, -9), I("ball", 0.8, -3), I("bench", 6, -11.4), I("bin", -6.5, -11.4)],
  school: [I("tree", -9, -9), I("tree", 10, -9.5), I("bench", -5, -9.5), I("bench", 5, -9.5), I("bin", 7.5, -9), I("bush", -7, -8.2), I("bush", 8.8, -8.2)],
  hospital: [I("tree", -10, -9), I("tree", 10, -9), I("bench", -4, -9.2), I("bench", 4, -9.2), I("bush", -7, -8), I("bush", 7, -8), I("bush", 0, -11.2), I("bin", 6, -8.4)],
  room: [
    I("rug", -1.5, -6.5, { color: "#a55d4a", scale: 1.6 }), I("sofa", -1.5, -9.35), I("table", -1.5, -6.6, { scale: 0.8 }),
    I("tv", 5, -9.5), I("bookshelf", -8.4, -9.6), I("lamp", -4.3, -9.4), I("plant", 8, -9.2), I("plant", -8.2, -3),
    I("picture", -1.5, -9.95, { y: 1.7 }), I("picture", 2.6, -9.95, { y: 1.9 }), I("clock", 5, -9.95, { y: 3.3 }),
    I("curtains", -6, -9.9, { y: 1.1 }), I("fan", 0, -3, { y: 5 }),
  ],
  bedroom: [
    I("bed", -5.85, -5.5), I("wardrobe", 4.2, -8.65), I("desk", 1.2, -8.6), I("chair", 1.2, -7.4, { rot: 180 }),
    I("lamp", -6.5, -7.6), I("rug", 1.5, -4, { color: "#6f8bb5", scale: 1.3 }), I("picture", -3.6, -8.95, { y: 1.8 }),
    I("clock", 5.5, -8.95, { y: 3 }), I("curtains", -1.5, -8.9, { y: 1.1 }), I("fan", 0, -3, { y: 4.6 }), I("plant", 6.2, -3),
  ],
  house: [
    // kitchen (left, back)
    I("fridge", -9.0, -12.6), I("counter", -7.7, -12.6), I("counter", -5.5, -12.6), I("counter", -3.3, -12.6),
    // dining area
    I("table", -6, -9, { scale: 1.2 }), I("chair", -7.6, -9, { rot: 90 }), I("chair", -4.4, -9, { rot: -90 }),
    I("chair", -6, -7.6, { rot: 180 }), I("chair", -6, -10.4),
    // lounge
    I("rug", 2.5, -8.5, { color: "#a55d4a", scale: 1.8 }), I("sofa", 2.5, -12.0), I("table", 2.5, -8.8, { scale: 0.8 }),
    I("tv", 5.7, -12.6), I("lamp", 0.3, -12.5), I("plant", 9.0, -12.4), I("bookshelf", -9.2, -3.5, { rot: 90 }),
    I("picture", -1.5, -12.95, { y: 1.9 }), I("picture", 4.5, -12.95, { y: 1.9 }), I("clock", 0.3, -12.95, { y: 3.6 }),
    I("curtains", 0, -12.9, { y: 1.1 }), I("fan", -6, -8, { y: 5.5 }), I("fan", 2.5, -6, { y: 5.5 }),
  ],
  classroom: [
    I("board", 0, -9.75), I("desk", -4, -8.3), I("clock", 0, -9.95, { y: 3.6 }), I("plant", -8, -9.2),
    ...[-4.5, 0, 4.5].flatMap(X => [-5.5, -2.5].flatMap(Z => [I("desk", X, Z, { rot: 180 }), I("chair", X, Z + 0.95, { rot: 180 })])),
    I("locker", 8.7, -8, { rot: -90 }), I("locker", 8.7, -6.9, { rot: -90 }), I("locker", 8.7, -5.8, { rot: -90 }),
    I("fan", -4, -4, { y: 4.6 }), I("fan", 4, -4, { y: 4.6 }),
  ],
  ward: [
    I("bed", -6.85, -6.2, { color: "#dbe9f4" }), I("bed", -6.85, -2.8, { color: "#dbe9f4" }),
    I("ivstand", -5.4, -7.6), I("ivstand", -5.4, -4.2), I("locker", 3, -8.7), I("locker", 4.1, -8.7),
    I("curtains", -2, -8.9, { y: 1.1 }), I("clock", 6, -8.95, { y: 3 }), I("plant", 7, -8.2), I("chair", 5.5, -3, { rot: 180 }),
  ],
};
