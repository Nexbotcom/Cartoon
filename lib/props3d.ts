import * as THREE from "three";
import { PropKind } from "./types";
import { AnimIn, Kit, TAU, dk, rnd } from "./kit3d";

export interface RiderHead { g: THREE.Group; skin: THREE.Mesh; hair: THREE.Mesh }
export const WALL_PROPS: PropKind[] = ["picture", "clock", "window", "curtains"];
export const CEILING_PROPS: PropKind[] = ["fan"];

// every prop is built in metres, front facing +Z (the car faces +X), standing on y = 0
export function buildProp3D(k: Kit, kind: PropKind, color: string): THREE.Group {
  const { bx, cyl, sph, mesh, toon, glow, gm } = k;
  const g = new THREE.Group();
  const d1 = dk(color, 0.78), d2 = dk(color, 0.62);
  const anims: ((a: AnimIn) => void)[] = [];
  const emissiveMat = (c0: string, e: number) =>
    new THREE.MeshToonMaterial({ color: new THREE.Color(c0), gradientMap: gm, emissive: new THREE.Color(c0), emissiveIntensity: e });

  switch (kind) {
    case "sofa":
      bx(g, 1.9, 0.32, 0.85, d1, 0, 0.24, 0); bx(g, 1.9, 0.62, 0.22, d1, 0, 0.7, -0.32);
      bx(g, 0.22, 0.55, 0.85, d1, -0.84, 0.46, 0); bx(g, 0.22, 0.55, 0.85, d1, 0.84, 0.46, 0);
      bx(g, 0.8, 0.14, 0.62, color, -0.4, 0.45, 0.08); bx(g, 0.8, 0.14, 0.62, color, 0.4, 0.45, 0.08);
      bx(g, 0.5, 0.4, 0.14, dk(color, 0.9), -0.5, 0.74, -0.16); bx(g, 0.5, 0.4, 0.14, dk(color, 0.9), 0.5, 0.74, -0.16);
      break;
    case "chair":
      bx(g, 0.55, 0.07, 0.55, color, 0, 0.48, 0); bx(g, 0.55, 0.62, 0.07, d1, 0, 0.85, -0.24);
      for (const [sx, sz] of [[-0.24, -0.24], [0.24, -0.24], [-0.24, 0.24], [0.24, 0.24]]) bx(g, 0.06, 0.48, 0.06, d2, sx, 0.24, sz);
      break;
    case "table":
      bx(g, 1.4, 0.07, 0.8, color, 0, 0.45, 0);
      for (const [sx, sz] of [[-0.62, -0.33], [0.62, -0.33], [-0.62, 0.33], [0.62, 0.33]]) bx(g, 0.07, 0.45, 0.07, d2, sx, 0.22, sz);
      cyl(g, 0.05, 0.04, 0.09, "#f4f1ea", -0.3, 0.52, 0.1);
      break;
    case "desk":
      bx(g, 1.7, 0.06, 0.8, color, 0, 0.76, 0);
      bx(g, 0.07, 0.76, 0.8, d1, -0.8, 0.38, 0); bx(g, 0.07, 0.76, 0.8, d1, 0.8, 0.38, 0);
      bx(g, 0.5, 0.5, 0.74, d1, 0.5, 0.45, 0);
      bx(g, 0.5, 0.02, 0.34, "#c9ccd3", -0.3, 0.8, 0.05);
      bx(g, 0.5, 0.32, 0.02, "#2b2f3a", -0.3, 0.97, -0.1).rotation.x = -0.15;
      break;
    case "bookshelf": {
      const cols = ["#e07b45", "#5b8a3c", "#4b6aa8", "#c0405a", "#f2c94c"];
      bx(g, 0.06, 2.1, 0.35, color, -0.52, 1.05, 0); bx(g, 0.06, 2.1, 0.35, color, 0.52, 1.05, 0);
      bx(g, 1.1, 2.1, 0.04, d2, 0, 1.05, -0.15);
      for (let r = 0; r < 4; r++) {
        const y0 = 0.05 + r * 0.5;
        bx(g, 1.0, 0.05, 0.33, color, 0, y0, 0);
        let x = -0.46, i = 0;
        while (x < 0.42) {
          const bw = 0.05 + ((r * 5 + i * 3) % 5) * 0.012, bh = 0.26 + ((r * 3 + i * 5) % 6) * 0.03;
          bx(g, bw, bh, 0.22, cols[(r * 7 + i) % 5], x + bw / 2, y0 + 0.025 + bh / 2, 0);
          x += bw + 0.01; i++;
        }
      }
      bx(g, 1.0, 0.05, 0.33, color, 0, 2.05, 0);
      break;
    }
    case "lamp": {
      cyl(g, 0.2, 0.22, 0.04, "#3a3f4b", 0, 0.02, 0); cyl(g, 0.02, 0.02, 1.6, "#3a3f4b", 0, 0.85, 0);
      const m = emissiveMat(color, 0.7);
      mesh(g, new THREE.CylinderGeometry(0.14, 0.24, 0.3, 18), m, 0, 1.75, 0);
      anims.push(a => { m.emissiveIntensity = 0.05 + 0.75 * a.power; });
      break;
    }
    case "plant": {
      cyl(g, 0.16, 0.12, 0.3, "#c9855a", 0, 0.15, 0);
      const leaves = new THREE.Group(); leaves.position.y = 0.3; g.add(leaves);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU;
        const leaf = sph(leaves, 1, i % 2 ? color : d1, Math.cos(a) * 0.1, 0.3, Math.sin(a) * 0.1, 0.09, 0.3, 0.09);
        leaf.rotation.z = -Math.cos(a) * 0.5; leaf.rotation.x = Math.sin(a) * 0.5;
      }
      anims.push(a => { leaves.rotation.z = a.alive ? Math.sin(a.t * 1.3) * 0.035 : 0; leaves.rotation.x = a.alive ? Math.cos(a.t * 1.1) * 0.03 : 0; });
      break;
    }
    case "tv": {
      bx(g, 1.5, 0.5, 0.5, "#8a6a4a", 0, 0.25, 0); bx(g, 1.5, 0.9, 0.08, color, 0, 0.98, 0);
      const m = emissiveMat("#3a6ea5", 0.9);
      mesh(g, new THREE.BoxGeometry(1.38, 0.78, 0.02), m, 0, 0.98, 0.05);
      anims.push(a => {
        if (a.power < 0.5) { m.emissive.set("#05060a"); m.color.set("#05060a"); return; }
        const h = a.alive ? (a.t * 0.06) % 1 : 0.6;
        m.emissive.setHSL(h, 0.55, 0.4); m.color.setHSL(h, 0.5, 0.35);
      });
      break;
    }
    case "door": {
      bx(g, 1.0, 2.2, 0.1, d2, 0, 1.1, 0);
      bx(g, 0.84, 2.1, 0.02, "#241d2b", 0, 1.05, -0.03);
      const pivot = new THREE.Group(); pivot.position.set(-0.42, 0, 0.03); g.add(pivot);
      bx(pivot, 0.84, 2.1, 0.08, color, 0.42, 1.05, 0);
      bx(pivot, 0.6, 0.8, 0.02, d1, 0.42, 1.5, 0.05); bx(pivot, 0.6, 0.8, 0.02, d1, 0.42, 0.6, 0.05);
      sph(pivot, 0.04, "#f2c94c", 0.74, 1.05, 0.07);
      g.userData.panel = pivot;
      break;
    }
    case "bed":
      bx(g, 2.1, 0.28, 1.5, "#8a6a4a", 0, 0.27, 0);
      for (const [sx, sz] of [[-1, -0.7], [1, -0.7], [-1, 0.7], [1, 0.7]]) bx(g, 0.1, 0.14, 0.1, "#6e5238", sx, 0.07, sz);
      bx(g, 2.0, 0.24, 1.4, "#f4f1ea", 0, 0.53, 0);
      bx(g, 1.35, 0.1, 1.46, color, 0.32, 0.68, 0);
      bx(g, 0.5, 0.12, 0.5, "#ffffff", -0.75, 0.72, 0.35); bx(g, 0.5, 0.12, 0.5, "#ffffff", -0.75, 0.72, -0.35);
      bx(g, 0.1, 1.0, 1.55, "#8a6a4a", -1.05, 0.62, 0); bx(g, 0.08, 0.5, 1.55, "#8a6a4a", 1.04, 0.45, 0);
      break;
    case "tree": {
      cyl(g, 0.18, 0.24, 1.4, "#6b4a2f", 0, 0.7, 0);
      const crown = new THREE.Group(); crown.position.y = 1.4; g.add(crown);
      sph(crown, 1.0, d1, 0, 0.9, 0); sph(crown, 0.8, color, -0.6, 0.6, 0.2); sph(crown, 0.8, color, 0.6, 0.6, -0.1); sph(crown, 0.9, color, 0, 1.2, 0);
      anims.push(a => { crown.rotation.z = a.alive ? Math.sin(a.t * 0.8) * 0.025 : 0; });
      break;
    }
    case "bench":
      bx(g, 1.5, 0.06, 0.45, color, 0, 0.46, 0);
      bx(g, 1.5, 0.12, 0.05, color, 0, 0.72, -0.2); bx(g, 1.5, 0.12, 0.05, color, 0, 0.9, -0.2);
      bx(g, 0.06, 0.42, 0.4, d2, -0.65, 0.21, 0); bx(g, 0.06, 0.42, 0.4, d2, 0.65, 0.21, 0);
      break;
    case "streetlight":
      cyl(g, 0.05, 0.07, 3.4, color, 0, 1.7, 0); cyl(g, 0.12, 0.14, 0.15, color, 0, 0.07, 0);
      bx(g, 0.7, 0.06, 0.06, color, 0.3, 3.4, 0); bx(g, 0.4, 0.1, 0.2, color, 0.6, 3.35, 0);
      bx(g, 0.3, 0.04, 0.14, "#fff3b0", 0.6, 3.28, 0, true);
      break;
    case "car": {
      const glass = new THREE.MeshToonMaterial({ color: new THREE.Color("#cfe9ff"), gradientMap: gm, transparent: true, opacity: 0.4 });
      bx(g, 2.1, 0.45, 1.0, color, 0, 0.5, 0);
      bx(g, 1.1, 0.06, 0.92, color, -0.15, 1.17, 0);
      for (const sx of [-0.65, 0.35]) for (const sz of [-0.43, 0.43]) bx(g, 0.06, 0.42, 0.06, color, sx, 0.93, sz);
      mesh(g, new THREE.BoxGeometry(1.0, 0.34, 0.9), glass, -0.15, 0.95, 0);
      bx(g, 0.9, 0.1, 0.8, "#3a3f4b", -0.15, 0.62, 0); bx(g, 0.1, 0.3, 0.7, "#3a3f4b", -0.5, 0.82, 0);
      bx(g, 0.05, 0.12, 0.2, "#ffe9a8", 1.06, 0.55, 0.3, true); bx(g, 0.05, 0.12, 0.2, "#ffe9a8", 1.06, 0.55, -0.3, true);
      bx(g, 0.05, 0.1, 0.2, "#e45b5b", -1.06, 0.55, 0.3, true); bx(g, 0.05, 0.1, 0.2, "#e45b5b", -1.06, 0.55, -0.3, true);
      bx(g, 0.08, 0.14, 1.04, d1, 1.08, 0.35, 0); bx(g, 0.08, 0.14, 1.04, d1, -1.08, 0.35, 0);
      const wheels: THREE.Group[] = [];
      for (const sx of [-0.7, 0.7]) for (const sz of [-0.5, 0.5]) {
        const pv = new THREE.Group(); pv.position.set(sx, 0.27, sz); g.add(pv);
        mesh(pv, new THREE.CylinderGeometry(0.27, 0.27, 0.18, 18), toon("#22252d")).rotation.x = Math.PI / 2;
        mesh(pv, new THREE.CylinderGeometry(0.13, 0.13, 0.2, 14), toon("#c9ccd3")).rotation.x = Math.PI / 2;
        bx(pv, 0.46, 0.05, 0.2, "#22252d", 0, 0, 0);
        wheels.push(pv);
      }
      g.userData.wheels = wheels;
      const riders: RiderHead[] = [];
      for (const [hx, hz] of [[0.2, 0.25], [-0.3, 0.25]]) {
        const hg = new THREE.Group(); hg.position.set(hx, 1.0, hz); hg.visible = false; g.add(hg);
        const skinM = sph(hg, 0.11, "#f2c9a0", 0, 0, 0);
        const hairM = mesh(hg, new THREE.SphereGeometry(0.118, 14, 10, 0, TAU, 0, 1.7), toon("#2b2118"), 0, 0.012, -0.004);
        riders.push({ g: hg, skin: skinM, hair: hairM });
      }
      g.userData.riders = riders;
      break;
    }
    case "phone": {
      bx(g, 0.075, 0.15, 0.012, "#1d2026", 0, 0.075, 0);
      const scr = emissiveMat("#7fb3ff", 0.8);
      mesh(g, new THREE.BoxGeometry(0.064, 0.126, 0.004), scr, 0, 0.078, 0.007);
      anims.push(a => {
        const c0 = a.power < 0.5 ? "#05060a" : "#7fb3ff";
        scr.emissive.set(c0); scr.color.set(c0);
      });
      break;
    }
    case "box":
      bx(g, 0.34, 0.3, 0.34, color, 0, 0.15, 0); bx(g, 0.07, 0.31, 0.35, "#f2c94c", 0, 0.15, 0); bx(g, 0.35, 0.07, 0.35, "#f2c94c", 0, 0.18, 0);
      sph(g, 0.045, "#f2c94c", -0.05, 0.34, 0, 1.4, 0.8, 1); sph(g, 0.045, "#f2c94c", 0.05, 0.34, 0, 1.4, 0.8, 1);
      break;
    case "cake":
      cyl(g, 0.3, 0.3, 0.03, "#eef0f4", 0, 0.015, 0); cyl(g, 0.22, 0.22, 0.16, "#f3d9a8", 0, 0.11, 0); cyl(g, 0.22, 0.22, 0.08, color, 0, 0.23, 0);
      for (const a of [0, 2.1, 4.2]) {
        cyl(g, 0.012, 0.012, 0.1, "#ffffff", Math.cos(a) * 0.11, 0.32, Math.sin(a) * 0.11);
        sph(g, 0.02, "#ffb703", Math.cos(a) * 0.11, 0.39, Math.sin(a) * 0.11, 1, 1.5, 1);
      }
      break;
    case "bag":
      bx(g, 0.3, 0.36, 0.16, color, 0, 0.18, 0);
      mesh(g, new THREE.TorusGeometry(0.08, 0.012, 6, 14, Math.PI), toon(d2), 0, 0.36, 0);
      break;
    case "ball":
      sph(g, 0.16, "#ffffff", 0, 0.16, 0);
      for (const [dx, dy, dz] of [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]]) sph(g, 0.05, "#22252d", dx * 0.155, 0.16 + dy * 0.155, dz * 0.155);
      break;
    case "goal": {
      cyl(g, 0.05, 0.05, 1.5, color, -1.2, 0.75, 0); cyl(g, 0.05, 0.05, 1.5, color, 1.2, 0.75, 0);
      mesh(g, new THREE.CylinderGeometry(0.05, 0.05, 2.45, 12), toon(color), 0, 1.5, 0).rotation.z = Math.PI / 2;
      const net = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.5 });
      const back = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5, 17, 10), net); back.position.set(0, 0.75, -0.9); g.add(back);
      for (const sx of [-1.2, 1.2]) { const sd = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.5, 6, 10), net); sd.rotation.y = Math.PI / 2; sd.position.set(sx, 0.75, -0.45); g.add(sd); }
      break;
    }
    case "board":
      bx(g, 0.06, 0.9, 0.06, "#6e5238", -0.95, 0.45, 0); bx(g, 0.06, 0.9, 0.06, "#6e5238", 0.95, 0.45, 0);
      bx(g, 2.2, 1.2, 0.06, color, 0, 1.5, 0); bx(g, 2.04, 1.04, 0.02, "#2f4f45", 0, 1.5, 0.03);
      bx(g, 2.2, 0.04, 0.1, color, 0, 0.88, 0.05);
      bx(g, 1.0, 0.02, 0.01, "#ffffff", -0.3, 1.65, 0.045); bx(g, 0.7, 0.02, 0.01, "#ffffff", -0.45, 1.5, 0.045); bx(g, 0.9, 0.02, 0.01, "#ffffff", -0.35, 1.35, 0.045);
      break;

    // ----- new props -----
    case "wardrobe":
      bx(g, 1.2, 2.1, 0.6, color, 0, 1.05, 0); bx(g, 0.58, 1.9, 0.03, d1, -0.3, 1.05, 0.31); bx(g, 0.58, 1.9, 0.03, d1, 0.3, 1.05, 0.31);
      sph(g, 0.03, "#f2c94c", -0.06, 1.05, 0.34); sph(g, 0.03, "#f2c94c", 0.06, 1.05, 0.34); bx(g, 1.26, 0.06, 0.66, d2, 0, 2.13, 0);
      break;
    case "fridge":
      bx(g, 0.8, 1.8, 0.7, "#e9eef5", 0, 0.9, 0); bx(g, 0.8, 0.03, 0.02, "#9aa4b0", 0, 1.25, 0.36);
      bx(g, 0.04, 0.4, 0.04, "#9aa4b0", 0.3, 1.5, 0.38); bx(g, 0.04, 0.6, 0.04, "#9aa4b0", 0.3, 0.8, 0.38);
      break;
    case "counter":
      bx(g, 2.2, 0.9, 0.7, color, 0, 0.45, 0); bx(g, 2.3, 0.05, 0.78, "#d9d4c7", 0, 0.925, 0);
      for (const x of [-0.55, 0, 0.55]) bx(g, 0.02, 0.8, 0.02, d2, x, 0.45, 0.36);
      bx(g, 0.5, 0.02, 0.4, "#9aa4b0", 0.5, 0.95, 0); cyl(g, 0.02, 0.02, 0.25, "#9aa4b0", 0.5, 1.08, -0.15);
      break;
    case "rug": {
      const r1 = mesh(g, new THREE.CylinderGeometry(1.3, 1.3, 0.03, 36), toon(color), 0, 0.015, 0);
      r1.scale.z = 0.7; r1.castShadow = false;
      const r2 = mesh(g, new THREE.CylinderGeometry(0.95, 0.95, 0.035, 36), toon(d1), 0, 0.018, 0);
      r2.scale.z = 0.7; r2.castShadow = false;
      break;
    }
    case "picture":
      bx(g, 0.8, 0.6, 0.04, "#7a5c3e", 0, 0.3, 0); bx(g, 0.68, 0.48, 0.02, "#f3d9a8", 0, 0.3, 0.02);
      sph(g, 0.07, "#ffb703", 0.14, 0.4, 0.04, 1, 1, 0.3);
      bx(g, 0.3, 0.2, 0.01, "#6a9a5a", -0.12, 0.2, 0.035).rotation.z = 0.5;
      break;
    case "clock": {
      mesh(g, new THREE.CylinderGeometry(0.26, 0.26, 0.05, 24), toon("#7a5c3e"), 0, 0.26, 0).rotation.x = Math.PI / 2;
      mesh(g, new THREE.CylinderGeometry(0.22, 0.22, 0.06, 24), toon("#f4f1ea"), 0, 0.26, 0.005).rotation.x = Math.PI / 2;
      const hh = new THREE.Group(); hh.position.set(0, 0.26, 0.04); g.add(hh);
      bx(hh, 0.02, 0.1, 0.01, "#222", 0, 0.05, 0);
      const mh = new THREE.Group(); mh.position.set(0, 0.26, 0.05); g.add(mh);
      bx(mh, 0.014, 0.17, 0.01, "#222", 0, 0.085, 0);
      anims.push(a => { mh.rotation.z = a.alive ? -a.t * 0.2 : 0; hh.rotation.z = a.alive ? -a.t * 0.0167 + 0.6 : 0.6; });
      break;
    }
    case "window":
      bx(g, 1.2, 1.4, 0.08, "#ffffff", 0, 0.7, 0); bx(g, 1.05, 1.25, 0.04, "#bfe3ff", 0, 0.7, 0.02, true);
      bx(g, 0.04, 1.25, 0.05, "#ffffff", 0, 0.7, 0.03); bx(g, 1.05, 0.04, 0.05, "#ffffff", 0, 0.7, 0.03);
      break;
    case "curtains": {
      mesh(g, new THREE.CylinderGeometry(0.02, 0.02, 2.5, 8), toon("#3a3f4b"), 0, 2.1, 0).rotation.z = Math.PI / 2;
      const panels: THREE.Group[] = [];
      for (const sx of [-1, 1]) {
        const pg = new THREE.Group(); pg.position.set(sx * 1.15, 2.05, 0); g.add(pg);
        for (let f = 0; f < 4; f++) bx(pg, 0.15, 2.0, 0.07, f % 2 ? color : d1, -sx * (0.075 + f * 0.14), -1.0, (f % 2) * 0.03);
        panels.push(pg);
      }
      anims.push(a => panels.forEach((pg, i) => { pg.scale.x = 1 - 0.65 * a.open; pg.rotation.z = a.alive ? Math.sin(a.t * 0.9 + i) * 0.012 : 0; }));
      break;
    }
    case "fan": {
      cyl(g, 0.03, 0.03, 0.3, "#3a3f4b", 0, -0.15, 0); cyl(g, 0.14, 0.14, 0.12, "#3a3f4b", 0, -0.36, 0);
      const blades = new THREE.Group(); blades.position.y = -0.42; g.add(blades);
      for (let b = 0; b < 4; b++) { const arm = new THREE.Group(); arm.rotation.y = (b * Math.PI) / 2; blades.add(arm); bx(arm, 0.55, 0.02, 0.14, color, 0.4, 0, 0); }
      let ang = 0;
      anims.push(a => { ang += a.dt * 9 * a.power * (a.alive ? 1 : 0); blades.rotation.y = ang; });
      break;
    }
    case "locker":
      bx(g, 0.45, 1.8, 0.4, "#5b7a9a", 0, 0.9, 0); for (const y of [1.55, 1.62, 1.69]) bx(g, 0.3, 0.02, 0.02, "#3f5a75", 0, y, 0.21);
      sph(g, 0.025, "#e9eef5", 0.14, 1.0, 0.21);
      break;
    case "bin":
      cyl(g, 0.18, 0.14, 0.5, color, 0, 0.25, 0); cyl(g, 0.19, 0.19, 0.04, d1, 0, 0.52, 0);
      break;
    case "bush": {
      const b = new THREE.Group(); g.add(b);
      sph(b, 0.5, color, 0, 0.45, 0); sph(b, 0.4, d1, -0.45, 0.35, 0.1); sph(b, 0.42, d1, 0.45, 0.35, -0.05); sph(b, 0.35, color, 0.1, 0.85, 0);
      anims.push(a => { b.rotation.z = a.alive ? Math.sin(a.t * 1.1 + 1) * 0.03 : 0; });
      break;
    }
    case "fence":
      for (let i = -5; i <= 5; i++) bx(g, 0.1, 0.9, 0.05, color, i * 0.34, 0.45, 0);
      bx(g, 3.8, 0.06, 0.05, d2, 0, 0.3, 0.03); bx(g, 3.8, 0.06, 0.05, d2, 0, 0.68, 0.03);
      break;
    case "crowd": {
      const shirts = ["#e63946", "#f4a261", "#2a9d8f", "#457b9d", "#e9c46a", "#8338ec", "#ff7aa2", "#f1faee"];
      const skins = ["#f2c9a0", "#8a5a3a", "#d9a066", "#6f4a2f"];
      const people: THREE.Group[] = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 7; c++) {
        const i = r * 7 + c, p = new THREE.Group();
        p.position.set((c - 3) * 0.55 + (r % 2) * 0.25, 0, -r * 0.6); g.add(p);
        mesh(p, new THREE.CapsuleGeometry(0.14, 0.4, 4, 8), toon(shirts[Math.floor(rnd(i, 1) * 8)]), 0, 0.5, 0);
        sph(p, 0.12, skins[Math.floor(rnd(i, 2) * 4)], 0, 0.98, 0);
        people.push(p);
      }
      anims.push(a => people.forEach((p, i) => { p.position.y = a.alive ? Math.abs(Math.sin(a.t * 2.4 + i * 1.7)) * 0.06 : 0; }));
      break;
    }
    case "ivstand":
      cyl(g, 0.02, 0.02, 1.8, "#9aa4b0", 0, 0.9, 0);
      for (let i = 0; i < 4; i++) bx(g, 0.5, 0.03, 0.03, "#9aa4b0", 0, 0.05, 0).rotation.y = (i * Math.PI) / 4;
      bx(g, 0.5, 0.03, 0.03, "#9aa4b0", 0, 1.8, 0);
      sph(g, 0.1, "#cfe9ff", 0.2, 1.65, 0, 0.7, 1.2, 0.7);
      break;
  }
  if (anims.length) g.userData.anim = (a: AnimIn) => anims.forEach(f => f(a));
  return g;
}
