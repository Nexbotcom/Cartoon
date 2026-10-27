import { PropKind } from "./types";

export const PROP_LIST: { kind: PropKind; label: string; color: string; depth: number; w: number }[] = [
  { kind: "sofa", label: "Sofa", color: "#7a6cc4", depth: 0.35, w: 280 },
  { kind: "chair", label: "Chair", color: "#c9855a", depth: 0.2, w: 100 },
  { kind: "table", label: "Table", color: "#a9744f", depth: 0.25, w: 210 },
  { kind: "desk", label: "Desk", color: "#8a6a4a", depth: 0.4, w: 250 },
  { kind: "bookshelf", label: "Bookshelf", color: "#8a5a3a", depth: 0.6, w: 160 },
  { kind: "lamp", label: "Lamp", color: "#f2c94c", depth: 0.5, w: 80 },
  { kind: "plant", label: "Plant", color: "#4f9a52", depth: 0.5, w: 90 },
  { kind: "tv", label: "TV", color: "#2b2f3a", depth: 0.5, w: 220 },
  { kind: "door", label: "Door", color: "#b9824f", depth: 0.8, w: 130 },
  { kind: "bed", label: "Bed", color: "#6aa3d6", depth: 0.5, w: 320 },
  { kind: "tree", label: "Tree", color: "#4f9a52", depth: 0.7, w: 200 },
  { kind: "bench", label: "Bench", color: "#a9744f", depth: 0.3, w: 220 },
  { kind: "streetlight", label: "Streetlight", color: "#3a3f4b", depth: 0.7, w: 80 },
  { kind: "car", label: "Car", color: "#d94f4f", depth: 0.5, w: 320 },
  { kind: "box", label: "Box", color: "#c0405a", depth: 0.25, w: 60 },
  { kind: "cake", label: "Cake", color: "#ff9ec4", depth: 0.25, w: 80 },
  { kind: "bag", label: "Bag", color: "#4b6aa8", depth: 0.25, w: 50 },
  { kind: "ball", label: "Ball", color: "#ffffff", depth: 0.15, w: 45 },
  { kind: "goal", label: "Goal", color: "#ffffff", depth: 0.7, w: 360 },
  { kind: "board", label: "Board", color: "#8a6a4a", depth: 0.8, w: 240 },
  { kind: "wardrobe", label: "Wardrobe", color: "#8a5a3a", depth: 0.6, w: 120 },
  { kind: "fridge", label: "Fridge", color: "#e9eef5", depth: 0.6, w: 70 },
  { kind: "counter", label: "Counter", color: "#a9744f", depth: 0.6, w: 220 },
  { kind: "rug", label: "Rug", color: "#a55d4a", depth: 0.4, w: 260 },
  { kind: "picture", label: "Picture", color: "#7a5c3e", depth: 0.9, w: 70 },
  { kind: "clock", label: "Clock", color: "#7a5c3e", depth: 0.9, w: 52 },
  { kind: "window", label: "Window", color: "#ffffff", depth: 0.9, w: 100 },
  { kind: "curtains", label: "Curtains", color: "#c0405a", depth: 0.9, w: 160 },
  { kind: "fan", label: "Fan", color: "#c9ccd3", depth: 0.5, w: 140 },
  { kind: "locker", label: "Locker", color: "#5b7a9a", depth: 0.6, w: 52 },
  { kind: "bin", label: "Bin", color: "#6b7280", depth: 0.3, w: 40 },
  { kind: "bush", label: "Bush", color: "#4f9a52", depth: 0.5, w: 120 },
  { kind: "fence", label: "Fence", color: "#c9a77c", depth: 0.6, w: 260 },
  { kind: "crowd", label: "Crowd", color: "#ffffff", depth: 0.5, w: 260 },
  { kind: "ivstand", label: "IV stand", color: "#9aa4b0", depth: 0.4, w: 50 },
];

// where people can sit: x offsets (px) from the middle of the prop
export const SEATS: Partial<Record<PropKind, number[]>> = { sofa: [-62, 62], chair: [0], bench: [-60, 60] };
// height (px) of the surface where small things can be put down
export const SURFACE: Partial<Record<PropKind, number>> = { table: 66, desk: 128, bench: 54, sofa: 80, counter: 92 };
// default height (metres) for things that hang on a wall or from the ceiling
export const DEFAULT_Y: Partial<Record<PropKind, number>> = { picture: 1.5, clock: 3.0, window: 1.0, curtains: 1.1, fan: 5 };

export interface PropFx { open?: number; riders?: { skin: string; hair: string }[]; power?: number; t?: number }

const TAU = Math.PI * 2;
const dk = (h: string, f: number) => {
  if (h[0] !== "#" || h.length < 7) return h;
  const n = parseInt(h.slice(1, 7), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`;
};
const rr = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  c.beginPath(); c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
};
const fl = (c: CanvasRenderingContext2D, col: string) => { c.fillStyle = col; c.fill(); };
const circle = (c: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) => {
  c.beginPath(); c.arc(x, y, r, 0, TAU); fl(c, col);
};

// Everything is drawn with the origin at the middle of the base, facing right. roll = wheel angle in radians.
export function drawProp(
  c: CanvasRenderingContext2D, kind: PropKind, color: string,
  x: number, footY: number, scale: number, mirror: number, roll: number, fx: PropFx = {}
) {
  const info = PROP_LIST.find(p => p.kind === kind);
  c.save();
  c.translate(x, footY);
  c.scale(scale * mirror, scale);
  c.lineJoin = "round"; c.lineCap = "round";
  c.fillStyle = "rgba(0,0,0,0.14)";
  c.beginPath(); c.ellipse(0, 0, (info?.w ?? 100) * 0.5, 9, 0, 0, TAU); c.fill();

  const d1 = dk(color, 0.78), d2 = dk(color, 0.62);
  switch (kind) {
    case "sofa": {
      c.fillStyle = "#4a3b34"; c.fillRect(-120, -14, 14, 14); c.fillRect(106, -14, 14, 14);
      rr(c, -130, -128, 260, 90, 18); fl(c, d1);
      rr(c, -118, -74, 236, 52, 14); fl(c, color);
      c.strokeStyle = d2; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -72); c.lineTo(0, -24); c.stroke();
      rr(c, -146, -100, 36, 84, 16); fl(c, d1);
      rr(c, 110, -100, 36, 84, 16); fl(c, d1);
      break;
    }
    case "chair": {
      rr(c, -36, -150, 72, 66, 8); fl(c, d1);
      c.fillStyle = d2; c.fillRect(-38, -50, 8, 50); c.fillRect(30, -50, 8, 50);
      rr(c, -44, -66, 88, 18, 6); fl(c, color);
      break;
    }
    case "table": {
      c.fillStyle = d1; c.fillRect(-95, -50, 10, 50); c.fillRect(85, -50, 10, 50);
      rr(c, -105, -64, 210, 16, 6); fl(c, color);
      circle(c, -40, -74, 10, "#f4f1ea"); circle(c, 30, -72, 8, "#e07b45");
      break;
    }
    case "desk": {
      c.fillStyle = d1; c.fillRect(-118, -110, 14, 110); c.fillRect(104, -110, 14, 110);
      rr(c, 36, -108, 66, 62, 4); fl(c, d1);
      circle(c, 69, -78, 4, "#f2c94c");
      rr(c, -125, -124, 250, 14, 5); fl(c, color);
      rr(c, -56, -134, 74, 10, 3); fl(c, "#c9ccd3");
      rr(c, -48, -196, 58, 62, 4); fl(c, "#2b2f3a");
      rr(c, -42, -190, 46, 50, 2); fl(c, "#7fb3ff");
      break;
    }
    case "bookshelf": {
      rr(c, -80, -232, 160, 232, 6); fl(c, color);
      c.fillStyle = dk(color, 0.55); c.fillRect(-72, -224, 144, 216);
      const cols = ["#e07b45", "#5b8a3c", "#4b6aa8", "#c0405a", "#f2c94c"];
      for (let r = 0; r < 4; r++) {
        const sy = -224 + r * 54;
        c.fillStyle = color; c.fillRect(-72, sy + 46, 144, 8);
        let bx = -68, k = 0;
        while (bx < 56) {
          const bw = 10 + ((r * 5 + k * 3) % 7), bh = 32 + ((r * 3 + k * 5) % 14);
          c.fillStyle = cols[(r * 7 + k) % 5]; c.fillRect(bx, sy + 46 - bh, bw, bh);
          bx += bw + 2; k++;
        }
      }
      break;
    }
    case "lamp": {
      if ((fx.power ?? 1) > 0.5) circle(c, 0, -205, 92, "rgba(255,236,160,0.18)");
      c.fillStyle = "#3a3f4b"; c.beginPath(); c.ellipse(0, -4, 28, 8, 0, 0, TAU); c.fill();
      c.fillRect(-3, -190, 6, 186);
      c.beginPath(); c.moveTo(-34, -168); c.lineTo(34, -168); c.lineTo(22, -236); c.lineTo(-22, -236); c.closePath(); fl(c, color);
      break;
    }
    case "plant": {
      for (const a of [-55, -28, 0, 28, 55]) {
        c.save(); c.translate(0, -58); c.rotate((a * Math.PI) / 180);
        c.beginPath(); c.ellipse(0, -46, 14, 48, 0, 0, TAU); fl(c, Math.abs(a) > 30 ? d1 : color);
        c.restore();
      }
      c.beginPath(); c.moveTo(-28, -62); c.lineTo(28, -62); c.lineTo(20, 0); c.lineTo(-20, 0); c.closePath(); fl(c, "#c9855a");
      c.fillStyle = "#b0714a"; c.fillRect(-30, -68, 60, 10);
      break;
    }
    case "tv": {
      c.fillStyle = "#8a6a4a"; c.fillRect(-84, -50, 168, 50);
      c.fillStyle = "#6e5238"; c.fillRect(-84, -26, 168, 4);
      rr(c, -100, -176, 200, 128, 8); fl(c, color);
      rr(c, -92, -168, 184, 112, 4); fl(c, (fx.power ?? 1) > 0.5 ? "#3a6ea5" : "#14161c");
      c.fillStyle = "rgba(255,255,255,0.12)";
      c.beginPath(); c.moveTo(-92, -168); c.lineTo(-20, -168); c.lineTo(-92, -90); c.closePath(); c.fill();
      break;
    }
    case "door": {
      const o = fx.open ?? 0;
      rr(c, -62, -264, 124, 264, 4); fl(c, d2);
      if (o > 0.02) { rr(c, -54, -256, 108, 256, 3); fl(c, "#2a2230"); }
      const pw = 108 * (1 - o * 0.86);
      rr(c, -54, -256, pw, 256, 3); fl(c, color);
      if (pw > 40) {
        rr(c, -54 + pw * 0.12, -238, pw * 0.76, 100, 3); fl(c, d1);
        rr(c, -54 + pw * 0.12, -122, pw * 0.76, 100, 3); fl(c, d1);
        circle(c, -54 + pw - 18, -130, 6, "#f2c94c");
      }
      break;
    }
    case "bed": {
      c.fillStyle = "#6e5238"; c.fillRect(-150, -20, 12, 20); c.fillRect(138, -20, 12, 20);
      rr(c, -170, -150, 24, 150, 6); fl(c, "#8a6a4a");
      rr(c, -160, -62, 320, 44, 6); fl(c, "#8a6a4a");
      rr(c, -150, -96, 300, 42, 14); fl(c, "#f4f1ea");
      rr(c, -40, -104, 190, 48, 14); fl(c, color);
      rr(c, -142, -116, 74, 30, 12); fl(c, "#ffffff");
      break;
    }
    case "tree": {
      rr(c, -16, -140, 32, 140, 6); fl(c, "#6b4a2f");
      circle(c, 0, -216, 82, d1); circle(c, -62, -176, 60, d1); circle(c, 62, -176, 60, d1);
      circle(c, 0, -222, 70, color); circle(c, -54, -180, 50, color); circle(c, 54, -180, 50, color);
      break;
    }
    case "bench": {
      c.fillStyle = d2; c.fillRect(-92, -60, 10, 60); c.fillRect(82, -60, 10, 60);
      rr(c, -105, -134, 210, 14, 4); fl(c, color);
      rr(c, -105, -112, 210, 14, 4); fl(c, color);
      rr(c, -105, -80, 210, 16, 4); fl(c, d1);
      c.fillStyle = d2; c.fillRect(-98, -134, 8, 60); c.fillRect(90, -134, 8, 60);
      break;
    }
    case "streetlight": {
      circle(c, 54, -318, 72, "rgba(255,236,160,0.16)");
      rr(c, -14, -14, 28, 14, 3); fl(c, color);
      c.fillStyle = color; c.fillRect(-4, -322, 8, 310);
      c.strokeStyle = color; c.lineWidth = 8;
      c.beginPath(); c.moveTo(0, -322); c.quadraticCurveTo(0, -346, 40, -340); c.stroke();
      rr(c, 28, -342, 52, 16, 6); fl(c, "#fff3b0");
      break;
    }
    case "car": {
      rr(c, -160, -76, 320, 50, 18); fl(c, color);
      c.beginPath(); c.moveTo(-88, -76); c.lineTo(-58, -128); c.lineTo(66, -128); c.lineTo(104, -76); c.closePath(); fl(c, color);
      c.fillStyle = "#cfe9ff";
      c.beginPath(); c.moveTo(-76, -80); c.lineTo(-52, -120); c.lineTo(-2, -120); c.lineTo(-2, -80); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(8, -80); c.lineTo(8, -120); c.lineTo(60, -120); c.lineTo(92, -80); c.closePath(); c.fill();
      (fx.riders ?? []).slice(0, 2).forEach((r, k) => {
        const cx = k === 0 ? 40 : -24;
        circle(c, cx, -106, 13, r.skin);
        c.fillStyle = r.hair; c.beginPath(); c.arc(cx, -108, 14, Math.PI, TAU); c.fill();
      });
      rr(c, 138, -66, 18, 12, 4); fl(c, "#ffe9a8");
      rr(c, -158, -66, 12, 12, 4); fl(c, "#e45b5b");
      rr(c, -166, -44, 332, 10, 5); fl(c, d1);
      for (const wx of [-95, 95]) {
        c.save(); c.translate(wx, -26);
        c.fillStyle = "#22252d"; c.beginPath(); c.arc(0, 0, 28, 0, TAU); c.fill();
        c.rotate(roll);
        c.fillStyle = "#c9ccd3"; c.beginPath(); c.arc(0, 0, 14, 0, TAU); c.fill();
        c.strokeStyle = "#22252d"; c.lineWidth = 4;
        for (let k = 0; k < 4; k++) { c.rotate(Math.PI / 4); c.beginPath(); c.moveTo(-14, 0); c.lineTo(14, 0); c.stroke(); }
        c.restore();
      }
      break;
    }
    case "wardrobe": {
      rr(c, -60, -200, 120, 200, 4); fl(c, color);
      rr(c, -54, -192, 52, 184, 3); fl(c, d1); rr(c, 2, -192, 52, 184, 3); fl(c, d1);
      circle(c, -10, -100, 4, "#f2c94c"); circle(c, 10, -100, 4, "#f2c94c");
      break;
    }
    case "fridge": {
      rr(c, -34, -180, 68, 180, 6); fl(c, "#e9eef5");
      c.fillStyle = "#9aa4b0"; c.fillRect(-34, -118, 68, 3); c.fillRect(20, -165, 5, 36); c.fillRect(20, -105, 5, 60);
      break;
    }
    case "counter": {
      rr(c, -110, -88, 220, 88, 3); fl(c, color);
      c.fillStyle = "#d9d4c7"; c.fillRect(-114, -98, 228, 10);
      c.strokeStyle = d2; c.lineWidth = 2;
      for (const k of [-55, 0, 55]) { c.beginPath(); c.moveTo(k, -88); c.lineTo(k, 0); c.stroke(); }
      c.fillStyle = "#9aa4b0"; c.fillRect(40, -104, 40, 6);
      break;
    }
    case "rug": {
      c.fillStyle = color; c.beginPath(); c.ellipse(0, -5, 130, 14, 0, 0, TAU); c.fill();
      c.fillStyle = d1; c.beginPath(); c.ellipse(0, -5, 96, 9, 0, 0, TAU); c.fill();
      break;
    }
    case "picture": {
      rr(c, -34, -48, 68, 48, 3); fl(c, "#7a5c3e"); rr(c, -28, -42, 56, 36, 2); fl(c, "#f3d9a8");
      circle(c, 12, -30, 6, "#ffb703");
      c.fillStyle = "#6a9a5a"; c.beginPath(); c.moveTo(-28, -6); c.lineTo(-6, -30); c.lineTo(14, -6); c.closePath(); c.fill();
      break;
    }
    case "clock": {
      circle(c, 0, -26, 26, "#7a5c3e"); circle(c, 0, -26, 22, "#f4f1ea");
      c.strokeStyle = "#222"; c.lineWidth = 3;
      c.beginPath(); c.moveTo(0, -26); c.lineTo(0, -42); c.moveTo(0, -26); c.lineTo(12, -22); c.stroke();
      break;
    }
    case "window": {
      rr(c, -50, -96, 100, 96, 3); fl(c, "#ffffff");
      rr(c, -43, -89, 40, 82, 2); fl(c, "#bfe3ff"); rr(c, 3, -89, 40, 82, 2); fl(c, "#bfe3ff");
      break;
    }
    case "curtains": {
      const o = fx.open ?? 0, w = 70 - 48 * o;
      c.fillStyle = "#3a3f4b"; c.fillRect(-80, -178, 160, 4);
      rr(c, -78, -174, w, 172, 5); fl(c, color); rr(c, 78 - w, -174, w, 172, 5); fl(c, d1);
      break;
    }
    case "fan": {
      c.fillStyle = "#3a3f4b"; c.fillRect(-3, -60, 6, 40); circle(c, 0, -18, 14, "#3a3f4b");
      const a = (fx.t ?? 0) * 6 * (fx.power ?? 1);
      c.fillStyle = color;
      for (let k = 0; k < 3; k++) { const w = Math.abs(Math.cos(a + k * 2.1)) * 70 + 8; c.beginPath(); c.ellipse(0, -14, w, 5, 0, 0, TAU); c.fill(); }
      break;
    }
    case "locker": {
      rr(c, -26, -190, 52, 190, 3); fl(c, "#5b7a9a");
      c.fillStyle = "#3f5a75"; for (const k of [-170, -160, -150]) c.fillRect(-18, k, 36, 4);
      circle(c, 14, -100, 3, "#e9eef5");
      break;
    }
    case "bin": {
      c.beginPath(); c.moveTo(-18, -50); c.lineTo(18, -50); c.lineTo(14, 0); c.lineTo(-14, 0); c.closePath(); fl(c, color);
      rr(c, -20, -56, 40, 8, 3); fl(c, d1);
      break;
    }
    case "bush": {
      circle(c, -28, -26, 28, d1); circle(c, 26, -24, 26, d1); circle(c, 0, -36, 34, color);
      break;
    }
    case "fence": {
      for (let k = -5; k <= 5; k++) { rr(c, k * 22 - 7, -72, 14, 72, 2); fl(c, color); }
      c.fillStyle = d2; c.fillRect(-125, -55, 250, 8); c.fillRect(-125, -25, 250, 8);
      break;
    }
    case "crowd": {
      const cols = ["#e63946", "#f4a261", "#2a9d8f", "#457b9d", "#e9c46a", "#8338ec", "#ff7aa2", "#f1faee"];
      const sk = ["#f2c9a0", "#8a5a3a", "#d9a066", "#6f4a2f"];
      for (let r = 2; r >= 0; r--) for (let k = 0; k < 7; k++) {
        const i = r * 7 + k, px = (k - 3) * 36 + (r % 2) * 14, py = -r * 22;
        const b = Math.abs(Math.sin((fx.t ?? 0) * 2.4 + i * 1.7)) * 4;
        rr(c, px - 11, py - 52 - b, 22, 34, 8); fl(c, cols[i % 8]);
        circle(c, px, py - 62 - b, 10, sk[(i * 3) % 4]);
      }
      break;
    }
    case "ivstand": {
      c.fillStyle = "#9aa4b0"; c.fillRect(-2, -170, 4, 170); c.fillRect(-24, -4, 48, 4); c.fillRect(-14, -176, 28, 4);
      rr(c, -8, -150, 16, 28, 5); fl(c, "#cfe9ff");
      break;
    }
    case "box": {
      rr(c, -22, -40, 44, 40, 4); fl(c, color);
      c.fillStyle = "#f2c94c"; c.fillRect(-4, -40, 8, 40); c.fillRect(-22, -24, 44, 7);
      c.beginPath(); c.ellipse(-9, -46, 10, 6, -0.4, 0, TAU); c.ellipse(9, -46, 10, 6, 0.4, 0, TAU); c.fill();
      break;
    }
    case "cake": {
      c.fillStyle = "#eef0f4"; c.beginPath(); c.ellipse(0, -3, 38, 7, 0, 0, TAU); c.fill();
      rr(c, -28, -36, 56, 32, 6); fl(c, "#f3d9a8");
      rr(c, -28, -46, 56, 16, 8); fl(c, color);
      for (const cx of [-14, 0, 14]) {
        c.fillStyle = "#ffffff"; c.fillRect(cx - 2, -62, 4, 16);
        c.fillStyle = "#ffb703"; c.beginPath(); c.ellipse(cx, -66, 3, 5, 0, 0, TAU); c.fill();
      }
      break;
    }
    case "bag": {
      rr(c, -20, -50, 40, 50, 3); fl(c, color);
      c.strokeStyle = d2; c.lineWidth = 3; c.beginPath(); c.arc(0, -50, 11, Math.PI, TAU); c.stroke();
      break;
    }
    case "ball": {
      circle(c, 0, -18, 18, "#ffffff");
      c.fillStyle = "#22252d";
      c.beginPath(); c.moveTo(0, -30); c.lineTo(10, -23); c.lineTo(6, -12); c.lineTo(-6, -12); c.lineTo(-10, -23); c.closePath(); c.fill();
      c.strokeStyle = "#22252d"; c.lineWidth = 2; c.beginPath(); c.arc(0, -18, 18, 0, TAU); c.stroke();
      break;
    }
    case "goal": {
      c.strokeStyle = "rgba(255,255,255,0.4)"; c.lineWidth = 1.5;
      for (let k = -170; k <= 170; k += 14) { c.beginPath(); c.moveTo(k, -212); c.lineTo(k, 0); c.stroke(); }
      for (let k = -212; k <= 0; k += 14) { c.beginPath(); c.moveTo(-170, k); c.lineTo(170, k); c.stroke(); }
      c.fillStyle = color;
      c.fillRect(-180, -220, 10, 220); c.fillRect(170, -220, 10, 220); c.fillRect(-180, -220, 360, 10);
      break;
    }
    case "board": {
      c.fillStyle = "#6e5238"; c.fillRect(-100, -110, 8, 110); c.fillRect(92, -110, 8, 110);
      rr(c, -110, -230, 220, 120, 4); fl(c, color);
      rr(c, -102, -222, 204, 104, 2); fl(c, "#2f4f45");
      c.fillStyle = color; c.fillRect(-110, -112, 220, 7);
      c.fillStyle = "rgba(255,255,255,0.85)"; c.font = "700 24px system-ui, sans-serif"; c.textAlign = "center";
      c.fillText("2 + 2 = 4", 0, -165);
      c.fillRect(-70, -150, 100, 3);
      break;
    }
  }
  c.restore();
}
