import * as THREE from "three";
import { ThemeId } from "./types";
import { Kit, TAU, dk, rnd } from "./kit3d";
import { buildPitch } from "./pitch3d";

export interface EnvLight {
  sky: string[]; hemi: [string, string, number];
  sun?: { dir: [number, number, number]; color: string; intensity: number; disc: string; size: number };
  stars?: boolean; room?: boolean;
}
export interface Env {
  group: THREE.Group;
  parts: Record<string, THREE.Object3D[]>;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number } | null;
  height: number;
  light: EnvLight;
  view?: { dist: number; tz: number };
  anim: (t: number, dt: number, alive: boolean) => void;
}

// ---------------- rooms ----------------
interface RoomSpec {
  minX: number; maxX: number; minZ: number; maxZ: number; h: number; wall: string; trim: string;
  floor: "wood" | "tile" | "carpet" | "lino"; floorCol: string; windows: number[]; sideWindows?: number[]; lights: number[]; stairs?: boolean;
}
const ROOMS: Partial<Record<ThemeId, { spec: RoomSpec; light: EnvLight }>> = {
  kitchen: { spec: { minX: -6, maxX: 6, minZ: -8, maxZ: 5, h: 4.2, wall: "#f4ecd8", trim: "#ffffff", floor: "tile", floorCol: "#e9e1d0", windows: [2], lights: [-2, 2] }, light: { sky: ["#f2e9d6", "#e6dcc6"], hemi: ["#fff3e0", "#8a7a60", 1.25], room: true } },
  church: { spec: { minX: -8, maxX: 8, minZ: -14, maxZ: 6, h: 9, wall: "#d9d2c4", trim: "#b9ae98", floor: "tile", floorCol: "#8f8a80", windows: [], sideWindows: [-10, -6, -2], lights: [-4, 4] }, light: { sky: ["#d8d2c6", "#bdb6a6"], hemi: ["#fff1d6", "#6f6a60", 1.0], room: true } },
  office: { spec: { minX: -9, maxX: 9, minZ: -10, maxZ: 6, h: 4.2, wall: "#e8edf2", trim: "#cbd3dc", floor: "carpet", floorCol: "#7f8ea3", windows: [-6, -2, 2, 6], lights: [-4, 0, 4] }, light: { sky: ["#dfe8f2", "#eef3f8"], hemi: ["#f4f9ff", "#8a96a6", 1.3], room: true } },

  
  room: { spec: { minX: -9, maxX: 9, minZ: -10, maxZ: 6, h: 5, wall: "#eadfce", trim: "#cfc2ae", floor: "wood", floorCol: "#b98c5e", windows: [-6], lights: [-3, 3] }, light: { sky: ["#eadfce", "#d9ccb8"], hemi: ["#fff2e0", "#8a6a4a", 1.5], room: true } },
  bedroom: { spec: { minX: -7, maxX: 7, minZ: -9, maxZ: 5, h: 4.6, wall: "#cfdcec", trim: "#e8eef6", floor: "carpet", floorCol: "#9fb0c8", windows: [-1.5], lights: [0] }, light: { sky: ["#c7d3e6", "#d9e3f0"], hemi: ["#eef4ff", "#7a8aa5", 1.5], room: true } },
  house: { spec: { minX: -9.5, maxX: 9.5, minZ: -13, maxZ: 6, h: 5.5, wall: "#f1e6d3", trim: "#d9c9ae", floor: "wood", floorCol: "#a9774d", windows: [-6, 0, 6], lights: [-6, 0, 6], stairs: true }, light: { sky: ["#e6d6bd", "#f1e6d3"], hemi: ["#fff2e0", "#8a6a4a", 1.5], room: true } },
  classroom: { spec: { minX: -9, maxX: 9, minZ: -10, maxZ: 6, h: 4.6, wall: "#efe8cf", trim: "#cdbf98", floor: "lino", floorCol: "#d8cfae", windows: [], sideWindows: [-7, -3], lights: [-4, 4] }, light: { sky: ["#e3dcc2", "#f1ecd9"], hemi: ["#fffbe8", "#9a9070", 1.5], room: true } },
  ward: { spec: { minX: -8, maxX: 8, minZ: -9, maxZ: 5, h: 4.4, wall: "#e6f1f6", trim: "#ffffff", floor: "lino", floorCol: "#dfe7ec", windows: [-2, 3], lights: [-3, 3] }, light: { sky: ["#d9e8f0", "#eaf3f8"], hemi: ["#f4fbff", "#8aa0b0", 1.5], room: true } },
};

const floorTex = (k: Kit, kind: RoomSpec["floor"], col: string, w: number, d: number) =>
  k.tex(256, 256, c => {
    c.fillStyle = col; c.fillRect(0, 0, 256, 256);
    if (kind === "wood") {
      for (let i = 0; i < 4; i++) {
        c.fillStyle = i % 2 ? "rgba(0,0,0,.07)" : "rgba(255,255,255,.06)"; c.fillRect(i * 64, 0, 64, 256);
        c.fillStyle = "rgba(0,0,0,.28)"; c.fillRect(i * 64, 0, 2, 256); c.fillRect(i * 64 + ((i * 37) % 50), (i * 61) % 200, 64, 2);
      }
    } else if (kind === "tile") {
      c.fillStyle = "rgba(0,0,0,.08)"; c.fillRect(0, 0, 128, 128); c.fillRect(128, 128, 128, 128);
      c.fillStyle = "rgba(0,0,0,.25)"; c.fillRect(0, 0, 256, 2); c.fillRect(0, 128, 256, 2); c.fillRect(0, 0, 2, 256); c.fillRect(128, 0, 2, 256);
    } else if (kind === "carpet") {
      for (let i = 0; i < 500; i++) { c.fillStyle = i % 2 ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.05)"; c.fillRect((i * 97) % 256, (i * 53) % 256, 3, 3); }
    } else {
      c.fillStyle = "rgba(0,0,0,.12)"; c.fillRect(0, 0, 256, 2); c.fillRect(0, 128, 256, 2); c.fillRect(0, 0, 2, 256); c.fillRect(128, 0, 2, 256);
    }
  }, [w / 3, d / 3]);

function buildRoom(k: Kit, s: RoomSpec, light: EnvLight): Env {
  const { bx, mesh, glow, gm } = k;
  const g = new THREE.Group();
  const parts: Record<string, THREE.Object3D[]> = {};
  const reg = <T extends THREE.Object3D>(name: string, o: T): T => { (parts[name] ??= []).push(o); return o; };
  const w = s.maxX - s.minX, d = s.maxZ - s.minZ, cx = (s.minX + s.maxX) / 2, cz = (s.minZ + s.maxZ) / 2;
  const mat = (col: string) => new THREE.MeshToonMaterial({ color: new THREE.Color(col), gradientMap: gm });

  // walls are one-sided: you see them from inside, but not from outside, so the camera can orbit freely
  const plane = (name: string, pw: number, ph: number, x: number, y: number, z: number, rx: number, ry: number, m: THREE.Material) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), m);
    p.position.set(x, y, z); p.rotation.set(rx, ry, 0); p.receiveShadow = true; g.add(p);
    return reg(name, p);
  };
  const wm = mat(s.wall);
  plane("back", w, s.h, cx, s.h / 2, s.minZ, 0, 0, wm);
  plane("front", w, s.h, cx, s.h / 2, s.maxZ, 0, Math.PI, wm);
  plane("left", d, s.h, s.minX, s.h / 2, cz, 0, Math.PI / 2, wm);
  plane("right", d, s.h, s.maxX, s.h / 2, cz, 0, -Math.PI / 2, wm);
  plane("ceiling", w, d, cx, s.h, cz, Math.PI / 2, 0, mat("#f4f0e8"));
  plane("floor", w, d, cx, 0, cz, -Math.PI / 2, 0, new THREE.MeshToonMaterial({ map: floorTex(k, s.floor, s.floorCol, w, d), gradientMap: gm }));

  for (const y of [0.07, s.h - 0.06]) {
    reg("back", bx(g, w, 0.14, 0.06, s.trim, cx, y, s.minZ + 0.03)); reg("front", bx(g, w, 0.14, 0.06, s.trim, cx, y, s.maxZ - 0.03));
    reg("left", bx(g, 0.06, 0.14, d, s.trim, s.minX + 0.03, y, cz)); reg("right", bx(g, 0.06, 0.14, d, s.trim, s.maxX - 0.03, y, cz));
  }
  for (const x of s.windows) {
    reg("back", bx(g, 2.7, 2.0, 0.08, "#ffffff", x, 2.6, s.minZ + 0.04));
    reg("back", bx(g, 2.5, 1.8, 0.06, "#bfe3ff", x, 2.6, s.minZ + 0.06, true));
    reg("back", bx(g, 0.06, 1.8, 0.08, "#ffffff", x, 2.6, s.minZ + 0.07)); reg("back", bx(g, 2.5, 0.06, 0.08, "#ffffff", x, 2.6, s.minZ + 0.07));
  }
  for (const z of s.sideWindows ?? []) {
    const wg = new THREE.Group(); wg.position.set(s.minX, 0, z); wg.rotation.y = Math.PI / 2; g.add(wg); reg("left", wg);
    bx(wg, 2.0, 2.0, 0.08, "#ffffff", 0, 2.6, 0.04); bx(wg, 1.8, 1.8, 0.06, "#bfe3ff", 0, 2.6, 0.06, true); bx(wg, 0.06, 1.8, 0.08, "#ffffff", 0, 2.6, 0.07);
  }
  for (const x of s.lights) {
    reg("decor", mesh(g, new THREE.CylinderGeometry(0.4, 0.4, 0.06, 20), glow("#fff3c0", 0.9), x, s.h - 0.03, cz));
    const pl = new THREE.PointLight(0xfff0d0, 34, 22, 2); pl.position.set(x, s.h - 0.7, cz); g.add(pl); reg("decor", pl);
  }
  if (s.stairs) {
    const sx = s.maxX - 1.0;
    for (let i = 0; i < 10; i++) reg("stairs", bx(g, 1.8, 0.28 * (i + 1), 0.45, "#c9a77c", sx, 0.14 * (i + 1), -2 - i * 0.45));
    reg("stairs", bx(g, 1.8, 2.8, 3.0, "#c9a77c", sx, 1.4, -8));
    for (let i = 0; i < 6; i++) reg("stairs", bx(g, 0.05, 0.9, 0.05, "#6e5238", sx - 0.85, 3.25, -6.6 - i * 0.55));
    reg("stairs", bx(g, 0.06, 0.06, 3.0, "#6e5238", sx - 0.85, 3.7, -8));
  }
  return {
    group: g, parts, light, height: s.h,
    bounds: { minX: s.minX + 0.05, maxX: s.maxX - 0.05, minZ: s.minZ + 0.05, maxZ: s.maxZ - 0.05 },
    anim: () => {},
  };
}

// ---------------- outdoor places ----------------
interface OutCfg { light: EnvLight; ground: string; bld?: [string, string]; road?: boolean; trees?: boolean; lit?: boolean; place?: "pitch" | "school" | "hospital" }
const DAYSUN = { dir: [0.5, 0.35, -0.8] as [number, number, number], color: "#fff6df", intensity: 2.2, disc: "#fff3b0", size: 5 };
const OUT: Partial<Record<ThemeId, OutCfg>> = {
  street: { light: { sky: ["#8fd0ff", "#eef8ff"], hemi: ["#cfe9ff", "#8a9a7a", 1.3], sun: DAYSUN }, ground: "#6f7379", bld: ["#c8a27a", "#fff3c9"], road: true },
  market: { light: { sky: ["#9fd8ff", "#fdf3dc"], hemi: ["#fff0d6", "#9a8a6a", 1.3], sun: DAYSUN }, ground: "#c9b48a", bld: ["#e0c9a0", "#fff0c0"], trees: true },
  forest: { light: { sky: ["#a8d8c0", "#e6f4e6"], hemi: ["#cfe9d6", "#4a6a4a", 1.0], sun: { ...DAYSUN, intensity: 1.5 } }, ground: "#3e7a3a", trees: true },
  beach: { light: { sky: ["#7fd0ff", "#f4fbff"], hemi: ["#d6f0ff", "#c9b88a", 1.4], sun: DAYSUN }, ground: "#e8d8a4" },
  graveyard: { light: { sky: ["#14162e", "#2b2a4d"], hemi: ["#5b5f9a", "#1d1f33", 0.7], sun: { dir: [0.3, 0.5, -0.8] as [number, number, number], color: "#b8c4ff", intensity: 0.8, disc: "#f4f1d8", size: 3 }, stars: true }, ground: "#2a3a2a", trees: true },
  rooftop: { light: { sky: ["#9ad0ff", "#e8f4ff"], hemi: ["#d6ecff", "#7a8088", 1.3], sun: DAYSUN }, ground: "#6c7078" },
  day: { light: { sky: ["#8fd0ff", "#eef8ff"], hemi: ["#cfe9ff", "#8a9a7a", 1.3], sun: DAYSUN }, ground: "#9bc58a", bld: ["#b3bfd3", "#e6ecf7"], road: true },
  sunset: { light: { sky: ["#2d1f5e", "#d9577a", "#ffb36b"], hemi: ["#ffb08a", "#4a3a5a", 0.9], sun: { dir: [-0.6, 0.12, -0.8], color: "#ffb27a", intensity: 1.6, disc: "#ffd29a", size: 8 } }, ground: "#5a6b4a", bld: ["#4a2f66", "#7a5588"], road: true },
  night: { light: { sky: ["#0b1030", "#1b2a5c"], hemi: ["#4a5a9a", "#1a2438", 0.8], sun: { dir: [0.4, 0.45, -0.8], color: "#9fb4ff", intensity: 0.9, disc: "#f4f1d8", size: 3.5 }, stars: true }, ground: "#27413a", bld: ["#202b4d", "#ffd86b"], road: true, lit: true },
  park: { light: { sky: ["#9fdcff", "#f4fbff"], hemi: ["#cfe9ff", "#7a9a6a", 1.3], sun: { ...DAYSUN, dir: [-0.45, 0.4, -0.8] as [number, number, number] } }, ground: "#8fd07a", trees: true },
  pitch: { light: { sky: ["#7ec8ff", "#eaf6ff"], hemi: ["#cfe9ff", "#7a9a6a", 1.3], sun: DAYSUN }, ground: "#3f9a4a", place: "pitch" },
  school: { light: { sky: ["#8fd0ff", "#eef8ff"], hemi: ["#cfe9ff", "#8a9a7a", 1.3], sun: DAYSUN }, ground: "#8e949c", place: "school" },
  hospital: { light: { sky: ["#a9d8ff", "#f4fbff"], hemi: ["#cfe9ff", "#8a9a7a", 1.3], sun: DAYSUN }, ground: "#9bc58a", place: "hospital" },
};

const winTexture = (k: Kit, wall: string, win: string, lit: boolean) =>
  k.tex(64, 64, c => {
    c.fillStyle = wall; c.fillRect(0, 0, 64, 64);
    for (let r = 0; r < 2; r++) for (let q = 0; q < 2; q++) { c.fillStyle = lit && (r * 3 + q * 5) % 3 !== 0 ? "#ffd86b" : win; c.fillRect(8 + q * 28, 8 + r * 28, 18, 18); }
  });

function buildOutdoor(k: Kit, cfg: OutCfg): Env {
  const { bx, cyl, sph, mesh, toon, gm } = k;
  const g = new THREE.Group();
  const parts: Record<string, THREE.Object3D[]> = {};
  const grp = (name: string) => { const o = new THREE.Group(); g.add(o); (parts[name] ??= []).push(o); return o; };
  const gGround = grp("ground"), gBack = grp("backdrop"), gTrees = grp("trees"), gClouds = grp("clouds");
  const sway: THREE.Object3D[] = [];
  const clouds: THREE.Object3D[] = [];
  const extra: ((t: number, dt: number, alive: boolean) => void)[] = [];

  const gr = new THREE.Mesh(new THREE.CircleGeometry(130, 48), toon(cfg.ground));
  gr.rotation.x = -Math.PI / 2; gr.receiveShadow = true; gGround.add(gr);

  const mkTree = (x: number, z: number, s: number, c1: string, c2: string) => {
    const tg = new THREE.Group(); tg.position.set(x, 0, z); tg.scale.setScalar(s); gTrees.add(tg);
    cyl(tg, 0.14, 0.2, 1.2, "#6b4a2f", 0, 0.6, 0);
    const crown = new THREE.Group(); crown.position.y = 1.2; tg.add(crown);
    sph(crown, 0.9, c1, 0, 0.7, 0); sph(crown, 0.7, c2, 0.4, 0.4, 0.2);
    sway.push(crown);
  };
  const mkBush = (x: number, z: number) => {
    const b = new THREE.Group(); b.position.set(x, 0, z); gTrees.add(b);
    sph(b, 0.45, "#4f9a52", 0, 0.4, 0); sph(b, 0.35, "#3f8a49", -0.4, 0.3, 0.1); sph(b, 0.38, "#3f8a49", 0.4, 0.3, 0);
    sway.push(b);
  };
  const facade = (w: number, h: number, d: number, x: number, z: number, wall: string, win: string, rx: number, ry: number) => {
    const tex = winTexture(k, wall, win, false);
    tex.repeat.set(rx, ry);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshToonMaterial({ map: tex, gradientMap: gm }));
    m.position.set(x, h / 2, z); m.castShadow = true; m.receiveShadow = true; gBack.add(m);
    return m;
  };

  if (cfg.road) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(260, 3.6), toon("#4a4f5a"));
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0.01, -4); road.receiveShadow = true; gGround.add(road);
    for (const zz of [-6.6, -1.4]) {
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(260, 1.2), toon("#c9c4b8"));
      sw.rotation.x = -Math.PI / 2; sw.position.set(0, 0.015, zz); sw.receiveShadow = true; gGround.add(sw);
    }
    for (let i = -40; i < 40; i++) bx(gGround, 1.4, 0.01, 0.12, "#f2e6a0", i * 3.2, 0.02, -4);
    for (let j = 0; j < 6; j++) bx(gGround, 0.4, 0.01, 3.4, "#f4f1ea", 14 + j * 0.8, 0.02, -4);   // zebra crossing
  }
  if (cfg.bld) {
    const texA = winTexture(k, cfg.bld[0], cfg.bld[1], false), texB = winTexture(k, cfg.bld[0], cfg.bld[1], !!cfg.lit);
    for (let i = 0; i < 28; i++) {
      const w = 3 + rnd(i, 1) * 3, h = 5 + rnd(i, 2) * 11, d = 3 + rnd(i, 3) * 3;
      const x = -52 + i * 3.8 + rnd(i, 4) * 1.5, z = -17 - (i % 3) * 6 - rnd(i, 5) * 3;
      const tex = (cfg.lit && rnd(i, 6) > 0.25 ? texB : texA).clone();
      tex.needsUpdate = true; tex.repeat.set(Math.round(w * 1.1), Math.round(h * 0.9));
      const m = new THREE.MeshToonMaterial({ map: tex, gradientMap: gm });
      if (cfg.lit) { m.emissive = new THREE.Color("#ffffff"); m.emissiveMap = tex; m.emissiveIntensity = 0.55; }
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, h / 2, z); b.castShadow = true; b.receiveShadow = true; gBack.add(b);
    }
    mkTree(-12, -9.5, 1, "#4f9a52", "#5aa85d"); mkTree(13, -9.8, 1.1, "#3f8a49", "#5aa85d");
  }
  if (cfg.trees) {
    for (let i = 0; i < 40; i++) mkTree(-45 + rnd(i, 1) * 90, -12 - rnd(i, 2) * 28, 0.8 + rnd(i, 3) * 0.9, rnd(i, 4) > 0.5 ? "#4f9a52" : "#3f8a49", "#5aa85d");
    for (let i = 0; i < 14; i++) mkBush(-12 + rnd(i, 7) * 24, -8 - rnd(i, 8) * 6);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(260, 2.4), toon("#d8c9a3"));
    path.rotation.x = -Math.PI / 2; path.position.set(0, 0.012, -5.5); path.receiveShadow = true; gGround.add(path);
  }

  if (cfg.place === "pitch") {
    for (let i = -16; i < 16; i++) {
      const st = new THREE.Mesh(new THREE.PlaneGeometry(8, 60), toon(i % 2 ? "#3f9a4a" : "#47a652"));
      st.rotation.x = -Math.PI / 2; st.position.set(i * 8 + 4, 0.005, -6); st.receiveShadow = true; gGround.add(st);
    }
    bx(gGround, 130, 0.01, 0.12, "#ffffff", 0, 0.02, -12);
    bx(gGround, 0.12, 0.01, 16, "#ffffff", 0, 0.02, -4);
    mesh(gGround, new THREE.TorusGeometry(3, 0.05, 6, 40), toon("#ffffff"), 0, 0.02, -4).rotation.x = Math.PI / 2;
    for (let t = 0; t < 5; t++) bx(gBack, 90, (t + 1) * 0.9, 2.0, "#6f7586", 0, (t + 1) * 0.45, -15 - t * 2);

    // the crowd: 350 people in the stands, cheering
    const gCrowd = grp("crowd");
    const palette = ["#e63946", "#f4a261", "#2a9d8f", "#457b9d", "#e9c46a", "#f1faee", "#8338ec", "#ff7aa2"].map(c => new THREE.Color(c));
    const skins = ["#f2c9a0", "#8a5a3a", "#d9a066"].map(c => new THREE.Color(c));
    const n = 5 * 70;
    const bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.55, 0.35), new THREE.MeshToonMaterial({ gradientMap: gm }), n);
    const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshToonMaterial({ gradientMap: gm }), n);
    const base: [number, number, number][] = [];
    let idx = 0;
    for (let t = 0; t < 5; t++) for (let j = 0; j < 70; j++, idx++) {
      base.push([-43 + j * 1.25 + (t % 2) * 0.6, (t + 1) * 0.9, -15 - t * 2 + 0.3]);
      bodies.setColorAt(idx, palette[Math.floor(rnd(idx, 1) * palette.length)]);
      heads.setColorAt(idx, skins[Math.floor(rnd(idx, 2) * skins.length)]);
    }
    const m4 = new THREE.Matrix4();
    const place = (t: number, alive: boolean) => {
      for (let i = 0; i < n; i++) {
        const [x, y, z] = base[i];
        const b = alive ? Math.abs(Math.sin(t * 2.4 + i * 1.7)) * 0.1 : 0;
        m4.makeTranslation(x, y + 0.3 + b, z); bodies.setMatrixAt(i, m4);
        m4.makeTranslation(x, y + 0.75 + b, z); heads.setMatrixAt(i, m4);
      }
      bodies.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
    };
    place(0, false);
    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
    if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
    gCrowd.add(bodies, heads);
    extra.push((t, _dt, alive) => { if (alive) place(t, true); });

    const boards = ["#2f6fdc", "#e63946", "#f4a261", "#2a9d8f"];
    for (let i = 0; i < 22; i++) bx(gBack, 4, 0.9, 0.1, boards[i % 4], -42 + i * 4, 0.45, -13);
    for (const sx of [-30, 30]) { cyl(gBack, 0.15, 0.2, 14, "#3a3f4b", sx, 7, -22); bx(gBack, 3, 0.8, 0.3, "#fff3b0", sx, 14.2, -21.8, true); }
  } else if (cfg.place === "school") {
    facade(26, 8, 6, 0, -16, "#d9a15f", "#f4f1ea", 8, 3);
    bx(gBack, 27, 0.8, 7, "#9b4d3a", 0, 8.4, -16);
    bx(gBack, 4, 3, 1, "#7a5c3e", 0, 1.5, -12.8);
    const label = k.tex(256, 64, c => {
      c.fillStyle = "#2f4f6f"; c.fillRect(0, 0, 256, 64);
      c.fillStyle = "#ffffff"; c.font = "700 36px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("SCHOOL", 128, 34);
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: label }));
    sign.position.set(0, 6.4, -12.95); gBack.add(sign);
    cyl(gBack, 0.05, 0.05, 7, "#6e5238", 9, 3.5, -12.5); bx(gBack, 1.2, 0.8, 0.05, "#e63946", 9.6, 6.6, -12.5);
    mkTree(-18, -13, 1, "#4f9a52", "#5aa85d"); mkTree(18, -13, 1, "#4f9a52", "#5aa85d");
    mkTree(-9, -9.5, 1, "#4f9a52", "#5aa85d"); mkTree(11, -9.5, 1, "#3f8a49", "#5aa85d");
  } else if (cfg.place === "hospital") {
    facade(30, 10, 7, 0, -17, "#eef3f8", "#9ec9e8", 10, 3);
    bx(gBack, 31, 0.5, 7.5, "#cfd8e3", 0, 10.2, -17);
    bx(gBack, 6, 0.3, 3, "#6c8aa8", 0, 3.2, -12.5);
    bx(gBack, 0.2, 3, 0.2, "#6c8aa8", -2.8, 1.6, -11.2); bx(gBack, 0.2, 3, 0.2, "#6c8aa8", 2.8, 1.6, -11.2);
    bx(gBack, 3.6, 2.6, 0.1, "#cfe7f7", 0, 1.3, -13.6);
    bx(gBack, 3.4, 3.4, 0.4, "#ffffff", 0, 12.2, -17);
    bx(gBack, 0.9, 3, 0.45, "#d62839", 0, 12.2, -16.75); bx(gBack, 3, 0.9, 0.45, "#d62839", 0, 12.2, -16.75);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(60, 3), toon("#c9ced6"));
    path.rotation.x = -Math.PI / 2; path.position.set(0, 0.012, -8.5); path.receiveShadow = true; gGround.add(path);
    mkTree(-12, -10, 1, "#4f9a52", "#5aa85d"); mkTree(12, -10, 1, "#4f9a52", "#5aa85d");
  }

  // drifting clouds
  const cloudCol = cfg.light.stars ? "#3b4670" : cfg.light.sky.length > 2 ? "#ffd9d0" : "#ffffff";
  for (let i = 0; i < 9; i++) {
    const cg = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const m = sph(cg, 1.6 * (0.6 + rnd(i * 7 + j, 2) * 0.5), cloudCol, (j - 1.5) * 1.7, rnd(j, 3) * 0.6, 0, 1, 0.65, 0.8);
      m.castShadow = false;
    }
    cg.position.set(-60 + rnd(i, 4) * 120, 20 + rnd(i, 5) * 10, -35 - rnd(i, 6) * 35);
    cg.scale.setScalar((1 + rnd(i, 1) * 1.2) * 1.4);
    gClouds.add(cg); clouds.push(cg);
  }

  return {
    group: g, parts, bounds: null, height: 6, light: cfg.light,
    anim: (t, dt, alive) => {
      sway.forEach((o, i) => { o.rotation.z = alive ? Math.sin(t * 0.9 + i * 1.3) * 0.03 : 0; });
      clouds.forEach((c, i) => { if (alive) { c.position.x += dt * (0.5 + (i % 4) * 0.15); if (c.position.x > 75) c.position.x = -75; } });
      extra.forEach(f => f(t, dt, alive));
    },
  };
}

// ---------- extra scenery for the newer places ----------
function addExtras(k: Kit, env: Env, theme: ThemeId) {
  const { bx, cyl, sph, mesh, toon } = k;
  const g = new THREE.Group();
  const rn = (i: number, s: number) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5; return v - Math.floor(v); };
  if (theme === "beach") {                                        // a moving sea, a foam line and palm trees
    const sea = k.tex(256, 256, c => {
      const gr = c.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#2f9bd6"); gr.addColorStop(1, "#58c4ea");
      c.fillStyle = gr; c.fillRect(0, 0, 256, 256); c.fillStyle = "rgba(255,255,255,0.45)";
      for (let i = 0; i < 40; i++) c.fillRect((i * 97) % 256, (i * 53) % 256, 36, 3);
    });
    sea.wrapS = sea.wrapT = THREE.RepeatWrapping; sea.repeat.set(10, 10);
    const water = mesh(g, new THREE.PlaneGeometry(220, 120), new THREE.MeshBasicMaterial({ map: sea }), 0, 0.05, -75);
    water.rotation.x = -Math.PI / 2;
    bx(g, 220, 0.04, 1.2, "#f4fbff", 0, 0.06, -14.6);
    for (let i = 0; i < 5; i++) {
      const px = -12 + i * 6 + rn(i, 1) * 2, pz = -9 - rn(i, 2) * 3, lean = (rn(i, 3) - 0.5) * 0.3;
      cyl(g, 0.1, 0.16, 4.2, "#8a6a4a", px, 2.1, pz).rotation.z = lean;
      for (let j = 0; j < 7; j++) {
        const a = (j / 7) * Math.PI * 2;
        const lf = mesh(g, new THREE.ConeGeometry(0.22, 2.0, 4), toon("#3f9a4a"), px + Math.cos(a) * 0.9 + lean * 2, 4.2, pz + Math.sin(a) * 0.9);
        lf.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15);
      }
    }
    const old = env.anim; env.anim = (t, dt, alive) => { old(t, dt, alive); sea.offset.set(t * 0.01, t * 0.02); };
  } else if (theme === "graveyard") {                             // rows of gravestones and a few crosses
    for (let r = 0; r < 3; r++) for (let q = -4; q <= 4; q++) {
      if (r === 0 && Math.abs(q) < 1) continue;
      const x = q * 2.6 + (rn(q, r) - 0.5) * 0.6, z = -3 - r * 3.2;
      if (rn(q * 3, r) > 0.7) { bx(g, 0.14, 1.3, 0.14, "#8d9199", x, 0.65, z); bx(g, 0.7, 0.14, 0.14, "#8d9199", x, 0.95, z); }
      else { bx(g, 0.75, 0.9, 0.18, "#8d9199", x, 0.45, z); sph(g, 0.375, "#8d9199", x, 0.9, z, 1, 0.55, 0.25); }
    }
  } else if (theme === "rooftop") {                               // a low wall round the edge and a skyline behind
    bx(g, 26, 1.1, 0.4, "#8a8f98", 0, 0.55, -11); bx(g, 0.4, 1.1, 18, "#8a8f98", -13, 0.55, -2); bx(g, 0.4, 1.1, 18, "#8a8f98", 13, 0.55, -2);
    for (let i = 0; i < 24; i++) bx(g, 3 + rn(i, 1) * 4, 6 + rn(i, 2) * 18, 3 + rn(i, 3) * 4, i % 3 ? "#6a7388" : "#7d869b", -60 + i * 5.2, 0, -32 - rn(i, 4) * 22).position.y = (6 + rn(i, 2) * 18) / 2 - 2;
  } else if (theme === "forest") {                                // a thick ring of trees around the clearing
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2, rad = 15 + rn(i, 1) * 20, x = Math.cos(a) * rad, z = -4 + Math.sin(a) * rad * 0.8, h = 5 + rn(i, 2) * 4;
      cyl(g, 0.2, 0.3, h * 0.4, "#5a3f28", x, h * 0.2, z);
      mesh(g, new THREE.ConeGeometry(1.7, h * 0.7, 7), toon(i % 2 ? "#1f5a34" : "#2a6b3d"), x, h * 0.4 + h * 0.3, z);
      mesh(g, new THREE.ConeGeometry(1.3, h * 0.5, 7), toon(i % 2 ? "#2a6b3d" : "#1f5a34"), x, h * 0.7 + h * 0.25, z);
    }
  } else if (theme === "market") {                                // striped stall awnings along the back
    for (let i = 0; i < 5; i++) {
      const x = -10 + i * 5, col = ["#d9534f", "#f0ad4e", "#5cb85c", "#5bc0de", "#9b59b6"][i];
      bx(g, 0.12, 2.7, 0.12, "#8a6a4a", x - 1.8, 1.35, -9); bx(g, 0.12, 2.7, 0.12, "#8a6a4a", x + 1.8, 1.35, -9);
      for (let s = 0; s < 6; s++) bx(g, 0.6, 0.08, 1.7, s % 2 ? "#ffffff" : col, x - 1.5 + s * 0.6, 2.75, -9.4).rotation.x = -0.2;
    }
  }
  env.parts["extras"] = [g]; env.group.add(g);
}

export function buildEnv(k: Kit, theme: ThemeId): Env { const env = buildEnvBase(k, theme); addExtras(k, env, theme); return env; }

function buildEnvBase(k: Kit, theme: ThemeId): Env {
  if (theme === "pitch") return buildPitch(k);
  const room = ROOMS[theme];
  if (room) return buildRoom(k, room.spec, room.light);
  return buildOutdoor(k, OUT[theme] ?? (OUT.day as OutCfg));
}
export { TAU, dk };
