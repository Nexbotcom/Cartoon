import * as THREE from "three";
import { CharacterDef, ClipId, Expr, Pose, View } from "./types";

const D = Math.PI / 180, TAU = Math.PI * 2;
const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ss = (u: number) => { const t = cl(u, 0, 1); return t * t * (3 - 2 * t); };
const dk = (h: string, f: number) => {
  if (h[0] !== "#" || h.length < 7) return h;
  const n = parseInt(h.slice(1, 7), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`;
};
const mix = (a: string, b: string, k: number) => new THREE.Color(a).lerp(new THREE.Color(b), k).getStyle();

export interface ActorPoseInput {
  x: number; face: number; view: View; clip: ClipId; expr: Expr; pose: Pose; lookEx: number; moving: boolean;
}
export interface Hand { g: THREE.Group; fingers: THREE.Group[]; thumb: THREE.Group }
export interface CharRig {
  sig: string; root: THREE.Group; body: THREE.Group; torso: THREE.Group; torsoMesh: THREE.Mesh; tBase: [number, number, number];
  neck: THREE.Group;
  armL: THREE.Group; elL: THREE.Group; handL: Hand; armR: THREE.Group; elR: THREE.Group; handR: Hand;
  legL: THREE.Group; knL: THREE.Group; ankL: THREE.Group; legR: THREE.Group; knR: THREE.Group; ankR: THREE.Group;
  eyes: { g: THREE.Group; pup: THREE.Group }[]; brows: THREE.Mesh[];
  lips: THREE.Group; lipL: THREE.Mesh; mSmile: THREE.Mesh; mFrown: THREE.Mesh; mOpen: THREE.Mesh;
  laptop: THREE.Group; blob: THREE.Mesh;
  angle: number; init: boolean; s: number; hy: number; hp: number; ht: number;
}

const TORSO: [number, number][] = [
  [0.002, -0.02], [0.12, -0.015], [0.152, 0.03], [0.148, 0.1], [0.128, 0.2], [0.138, 0.3],
  [0.158, 0.4], [0.168, 0.47], [0.15, 0.53], [0.07, 0.575], [0.002, 0.585],
];
const BAND: [number, number][] = [
  [0.002, -0.075], [0.115, -0.07], [0.158, -0.02], [0.156, 0.06], [0.15, 0.16], [0.002, 0.165],
];

export function createCharFactory(gm: THREE.Texture) {
  const mats = new Map<string, THREE.MeshToonMaterial>();
  const toon = (col: string) => {
    let m = mats.get(col);
    if (!m) { m = new THREE.MeshToonMaterial({ color: new THREE.Color(col), gradientMap: gm }); mats.set(col, m); }
    return m;
  };

  // cartoon outline: a slightly inflated, back-faced copy of each smooth part
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x1b1620, side: THREE.BackSide });
  outlineMat.onBeforeCompile = sh => {
    sh.uniforms.thick = { value: 0.0065 };
    sh.vertexShader = "uniform float thick;\n" + sh.vertexShader.replace(
      "#include <begin_vertex>", "#include <begin_vertex>\n transformed += normal * thick;");
  };

  // soft contact shadow under the feet
  const blobTex = (() => {
    const cv = document.createElement("canvas"); cv.width = cv.height = 64;
    const x = cv.getContext("2d") as CanvasRenderingContext2D;
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, "rgba(0,0,0,0.38)"); g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  })();
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });

  const part = (parent: THREE.Object3D, geo: THREE.BufferGeometry, col: string, x = 0, y = 0, z = 0, outline = true) => {
    const m = new THREE.Mesh(geo, toon(col));
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    if (outline) m.add(new THREE.Mesh(geo, outlineMat));
    parent.add(m);
    return m;
  };
  const ball = (p: THREE.Object3D, r: number, col: string, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, outline = true) => {
    const m = part(p, new THREE.SphereGeometry(r, 22, 16), col, x, y, z, outline);
    m.scale.set(sx, sy, sz);
    return m;
  };
  const lmb = (p: THREE.Object3D, r: number, len: number, col: string, y0 = 0, outline = true) =>
    part(p, new THREE.CapsuleGeometry(r, Math.max(0.01, len - 2 * r), 5, 12), col, 0, y0 - len / 2, 0, outline);
  const box = (p: THREE.Object3D, w: number, h: number, d: number, col: string, x: number, y: number, z: number) =>
    part(p, new THREE.BoxGeometry(w, h, d), col, x, y, z, false);
  const ring = (p: THREE.Object3D, r: number, tube: number, col: string, y: number) => {
    const m = part(p, new THREE.TorusGeometry(r, tube, 6, 24), col, 0, y, 0, false);
    m.rotation.x = Math.PI / 2;
    return m;
  };
  const lathe = (pts: [number, number][]) => {
    const smooth = new THREE.SplineCurve(pts.map(q => new THREE.Vector2(q[0], q[1]))).getPoints(26);
    return new THREE.LatheGeometry(smooth.map(q => new THREE.Vector2(Math.max(0.001, q.x), q.y)), 28);
  };

  const build = (def: CharacterDef): CharRig => {
    const b = def.build ?? 1;
    const skin = def.skin, top = def.top, bot = def.bottom;
    const root = new THREE.Group(), body = new THREE.Group();
    root.add(body);
    const hipY = 0.88;

    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), blobMat);
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; root.add(blob);

    // ----- legs -----
    const mkLeg = (sgn: number) => {
      const lg = new THREE.Group(); lg.position.set(sgn * 0.1 * b, hipY, 0); body.add(lg);
      const bare = def.outfit !== "pants";
      lmb(lg, 0.072 * b, 0.44, def.outfit === "skirt" ? skin : bot);
      const kn = new THREE.Group(); kn.position.y = -0.44; lg.add(kn);
      ball(kn, 0.06 * b, bare ? skin : bot, 0, 0, 0, 1, 1, 1, false);
      lmb(kn, 0.052 * b, 0.4, bare ? skin : bot);
      if (!bare) ring(kn, 0.056 * b, 0.011, dk(bot, 0.8), -0.37);
      const ank = new THREE.Group(); ank.position.y = -0.4; kn.add(ank);
      const shoe = part(ank, new THREE.CapsuleGeometry(0.052 * b, 0.12, 5, 12), def.shoes, 0, -0.03, 0.05);
      shoe.rotation.x = Math.PI / 2; shoe.scale.set(1, 1, 0.8);
      box(ank, 0.1 * b, 0.018, 0.25, dk(def.shoes, 0.5), 0, -0.068, 0.055);
      return { lg, kn, ank };
    };
    const LL = mkLeg(-1), LR = mkLeg(1);

    // ----- torso -----
    const torso = new THREE.Group(); torso.position.y = hipY; body.add(torso);
    const tBase: [number, number, number] = [1.22 * b, 1, 0.74];
    const torsoMesh = part(torso, lathe(TORSO), top);
    torsoMesh.scale.set(...tBase);
    const band = part(torso, lathe(BAND), bot);
    band.scale.set(1.22 * b, 1, 0.74);
    const belt = part(torso, new THREE.TorusGeometry(0.152, 0.009, 6, 28), dk(bot, 0.6), 0, 0.15, 0, false);
    belt.rotation.x = Math.PI / 2; belt.scale.set(1.22 * b, 0.74, 1);
    ring(torso, 0.062, 0.013, dk(top, 0.85), 0.55);
    if (def.outfit === "skirt") {
      const sk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2 * b, 0.36 * b, 0.36, 28, 1, true),
        new THREE.MeshToonMaterial({ color: new THREE.Color(bot), gradientMap: gm, side: THREE.DoubleSide }));
      sk.position.y = -0.12; sk.castShadow = true; torso.add(sk);
      ring(sk, 0.36 * b, 0.01, dk(bot, 0.75), -0.18);
    }

    // ----- arms and hands -----
    const mkArm = (sgn: number) => {
      const sh = new THREE.Group(); sh.position.set(sgn * (0.205 * b + 0.04), 0.5, 0); torso.add(sh);
      ball(sh, 0.058, top);
      lmb(sh, 0.045 * b, 0.29, skin);
      const el = new THREE.Group(); el.position.y = -0.29; sh.add(el);
      ball(el, 0.04 * b, skin, 0, 0, 0, 1, 1, 1, false);
      lmb(el, 0.037 * b, 0.25, skin);
      if (def.sleeve === "long") {
        lmb(sh, 0.053 * b, 0.29, top); lmb(el, 0.046 * b, 0.2, top);
        ring(el, 0.046 * b, 0.009, dk(top, 0.8), -0.2);
      } else lmb(sh, 0.057 * b, 0.17, top);

      const hg = new THREE.Group(); hg.position.y = -0.265; el.add(hg);
      ball(hg, 0.04, skin, 0, -0.035, 0, 1, 1.15, 0.55);
      const fingers: THREE.Group[] = [];
      [-0.021, -0.007, 0.007, 0.021].forEach((fx, k) => {
        const f = new THREE.Group(); f.position.set(fx, -0.07, 0); hg.add(f);
        const len = [0.052, 0.058, 0.056, 0.046][k];
        lmb(f, 0.0115, len, skin, 0, false);
        fingers.push(f);
      });
      const thumb = new THREE.Group(); thumb.position.set(-sgn * 0.034, -0.03, 0.008); hg.add(thumb);
      lmb(thumb, 0.013, 0.045, skin, 0, false);
      return { sh, el, hand: { g: hg, fingers, thumb } as Hand };
    };
    const AL = mkArm(-1), AR = mkArm(1);

    // ----- neck and head -----
    const neck = new THREE.Group(); neck.position.y = 0.56; torso.add(neck);
    part(neck, new THREE.CylinderGeometry(0.044, 0.05, 0.12, 14), skin, 0, 0.03, 0, false);
    const head = new THREE.Group(); head.position.y = 0.14; neck.add(head);
    ball(head, 0.115, skin, 0, 0, 0, 1, 1.08, 1.02);
    ball(head, 0.093, skin, 0, -0.047, 0.012, 1, 0.92, 0.97);
    ball(head, 0.027, skin, -0.114, -0.004, 0, 0.55, 1, 0.85, false);
    ball(head, 0.027, skin, 0.114, -0.004, 0, 0.55, 1, 0.85, false);
    ball(head, 0.017, dk(skin, 0.94), 0, -0.016, 0.113, 0.9, 1, 1.1, false);

    if (def.hairStyle !== "none") {
      const hc = def.hair;
      const capH = part(head, new THREE.SphereGeometry(0.122, 28, 18, 0, TAU, 0, 1.1), hc, 0, 0.012, -0.004);
      capH.scale.set(1, 1.08, 1.02);
      const backH = part(head, new THREE.SphereGeometry(0.123, 28, 18, Math.PI, Math.PI, 0, def.hairStyle === "long" ? 2.5 : 1.95), hc, 0, 0, -0.004);
      backH.scale.set(1, 1.08, 1.02);
      for (let k = -2; k <= 2; k++) ball(head, 0.03, hc, k * 0.036, 0.075 - Math.abs(k) * 0.008, 0.104 - Math.abs(k) * 0.012, 1.15, 0.8, 0.8);
      ball(head, 0.03, hc, -0.108, 0.01, 0.03, 0.6, 1.3, 0.8);
      ball(head, 0.03, hc, 0.108, 0.01, 0.03, 0.6, 1.3, 0.8);
      if (def.hairStyle === "spiky") {
        const cg = new THREE.ConeGeometry(0.04, 0.11, 6);
        for (let k = 0; k < 7; k++) {
          const th = k === 0 ? 0 : 0.75, ph = ((k - 1) / 6) * TAU;
          const dir = new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)).normalize();
          const cn = part(head, cg, hc, dir.x * 0.125, dir.y * 0.138 + 0.01, dir.z * 0.125);
          cn.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        }
      }
      if (def.hairStyle === "bun") { ball(head, 0.058, hc, 0, 0.145, -0.045); ring(head, 0.05, 0.008, dk(hc, 0.6), 0.115); }
      if (def.hairStyle === "long") {
        part(head, new THREE.CapsuleGeometry(0.095, 0.2, 5, 12), hc, 0, -0.13, -0.075).scale.set(1.3, 1, 0.6);
        for (const sx of [-1, 1]) lmb(head, 0.028, 0.27, hc, -0.02).position.set(sx * 0.1, -0.02, 0.01);
      }
    }

    const eyes = [-1, 1].map(s => {
      const g = new THREE.Group(); g.position.set(s * 0.043, 0.018, 0.1); head.add(g);
      ball(g, 0.027, "#ffffff", 0, 0, 0, 1, 1.1, 0.5, false);
      const pup = new THREE.Group(); g.add(pup);
      ball(pup, 0.017, def.eye ?? "#3b2a1e", 0, 0, 0.008, 1, 1, 0.5, false);
      ball(pup, 0.009, "#14101c", 0, 0, 0.014, 1, 1, 0.5, false);
      return { g, pup };
    });
    const browCol = def.hairStyle === "none" ? "#3a2a20" : dk(def.hair, 0.8);
    const brows = [-1, 1].map(s => {
      const m = part(head, new THREE.CapsuleGeometry(0.005, 0.03, 3, 6), browCol, s * 0.043, 0.052, 0.104, false);
      m.rotation.z = Math.PI / 2;
      return m;
    });

    const lipCol = mix(skin, "#b2505c", 0.5);
    const lips = new THREE.Group(); head.add(lips);
    ball(lips, 0.016, lipCol, 0, -0.052, 0.107, 2.1, 0.5, 0.75, false);
    const lipL = ball(lips, 0.017, lipCol, 0, -0.062, 0.106, 2.0, 0.55, 0.75, false);
    const mSmile = part(head, new THREE.TorusGeometry(0.028, 0.005, 6, 18, Math.PI), lipCol, 0, -0.034, 0.107, false);
    mSmile.rotation.z = Math.PI;
    const mFrown = part(head, new THREE.TorusGeometry(0.026, 0.005, 6, 18, Math.PI), lipCol, 0, -0.078, 0.107, false);
    const mOpen = ball(head, 0.022, "#4a1a24", 0, -0.058, 0.1, 1.1, 0.3, 0.4, false);

    // ----- laptop desk (used by the "type" action) -----
    const laptop = new THREE.Group(); laptop.visible = false; root.add(laptop);
    box(laptop, 1.0, 0.05, 0.6, "#8a6a4a", 0, 0.72, 0.55);
    for (const [lx, lz] of [[-0.45, 0.3], [0.45, 0.3], [-0.45, 0.8], [0.45, 0.8]]) box(laptop, 0.05, 0.72, 0.05, "#6e5238", lx, 0.36, lz);
    box(laptop, 0.46, 0.02, 0.32, "#c9ccd3", 0, 0.755, 0.55);
    box(laptop, 0.46, 0.3, 0.016, "#2b2f3a", 0, 0.9, 0.42).rotation.x = -0.18;

    return {
      sig: "", root, body, torso, torsoMesh, tBase, neck,
      armL: AL.sh, elL: AL.el, handL: AL.hand, armR: AR.sh, elR: AR.el, handR: AR.hand,
      legL: LL.lg, knL: LL.kn, ankL: LL.ank, legR: LR.lg, knR: LR.kn, ankR: LR.ank,
      eyes, brows, lips, lipL, mSmile, mFrown, mOpen, laptop, blob,
      angle: 0, init: false, s: def.height / 300, hy: 0, hp: 0, ht: 0,
    };
  };

  // ---------- posing ----------
  const pose = (rig: CharRig, st: ActorPoseInput, wx: number, wz: number, jump: boolean, dt: number, t: number) => {
    const p = st.pose, clip = st.clip, side = st.view === "side";
    const fresh = !rig.init || jump;
    rig.root.position.set(wx, 0, wz);

    // body facing
    let target = 0;
    if (side) target = st.face > 0 ? Math.PI / 2 : -Math.PI / 2;
    else if (st.view === "back") target = Math.PI;
    else target = cl(st.lookEx * 0.55, -0.55, 0.55);
    if (fresh) rig.angle = target;
    else {
      const dA = Math.atan2(Math.sin(target - rig.angle), Math.cos(target - rig.angle));
      rig.angle += dA * (1 - Math.exp(-dt * 12));
    }
    rig.root.rotation.y = rig.angle;

    // walking and running: the leg cycle follows the distance travelled, so feet stay planted
    const gait = side && st.moving;
    const run = clip === "run";
    const A = run ? 46 : 26, K = run ? 100 : 48, stride = run ? 2.4 : 1.5;
    const phase = gait ? ((wx * (st.face > 0 ? 1 : -1)) / stride) * TAU : 0;
    const sn = Math.sin(phase);

    let bodyY = -p.bob * 0.0058, bodyYaw = 0, twist = 0, sway = 0.012 * Math.sin(t * 0.6);
    if (gait) {
      bodyY = -0.84 * (1 - Math.cos(A * D * Math.abs(sn))) + (run ? 0.05 * Math.abs(Math.cos(phase)) : 0);
      const k = run ? 1.5 : 1;
      bodyYaw = -0.07 * sn * k; twist = 0.14 * sn * k; sway = 0.02 * Math.cos(phase);
    }
    rig.body.position.y = bodyY;
    rig.body.rotation.set(0, bodyYaw, sway);
    rig.torso.rotation.set(p.lean * D, twist, 0);

    // breathing
    const br = Math.sin(t * 1.8);
    rig.torsoMesh.scale.set(rig.tBase[0] * (1 + 0.008 * br), 1 + 0.014 * br, rig.tBase[2] * (1 + 0.01 * br));

    // arms
    const armGesture = (sgn: number) => clip === "type" || clip === "jump" || (sgn > 0 && (clip === "wave" || clip === "point"));
    const setArm = (sh: THREE.Group, el: THREE.Group, aU: number, aB: number, sgn: number) => {
      sh.rotation.set(0, 0, 0); el.rotation.set(0, 0, 0);
      if (gait && !armGesture(sgn)) {
        const armA = run ? 48 : 22, eb = run ? 85 : 16;
        const f = -armA * Math.sin(phase + (sgn < 0 ? 0 : Math.PI));
        sh.rotation.set(-f * D, 0, sgn * 0.07);
        el.rotation.x = -(eb + 0.5 * Math.max(0, f)) * D;
        return;
      }
      if (clip === "type") { sh.rotation.x = -0.55; sh.rotation.z = sgn * 0.12; el.rotation.x = -1.45; return; }
      if (clip === "point" && sgn > 0) { sh.rotation.x = -1.55; sh.rotation.z = 0.15; return; }
      if (side) { sh.rotation.x = -aU * D; sh.rotation.z = sgn * 0.08; el.rotation.x = -aB * D; }
      else {
        sh.rotation.z = sgn * aU * D;
        if (clip === "wave") el.rotation.z = sgn * aB * D; else el.rotation.x = -aB * D;
      }
    };
    setArm(rig.armL, rig.elL, p.aLU, p.aLB, -1);
    setArm(rig.armR, rig.elR, p.aRU, p.aRB, 1);

    // hands
    const curl = (h: Hand, sgn: number, c: number, indexOut = false) => {
      const idx = sgn > 0 ? 0 : 3;
      h.fingers.forEach((f, i) => f.rotation.set(0, 0, -sgn * (indexOut && i === idx ? 0.05 : c)));
      h.thumb.rotation.z = -sgn * (0.5 - c * 0.2);
    };
    const base = clip === "run" ? 1.2 : clip === "type" ? 0.7 : clip === "talk" ? 0.25 : 0.35;
    curl(rig.handL, -1, base);
    if (clip === "wave") curl(rig.handR, 1, 0.08);
    else if (clip === "point") curl(rig.handR, 1, 1.4, true);
    else curl(rig.handR, 1, base);

    // legs
    const legPose = (lg: THREE.Group, kn: THREE.Group, ank: THREE.Group, sgn: number, aU: number, aB: number, ph: number) => {
      lg.rotation.set(0, 0, 0); kn.rotation.set(0, 0, 0); ank.rotation.set(0, 0, 0);
      if (clip === "jump") { lg.rotation.x = -0.5; kn.rotation.x = 1.0; ank.rotation.x = -0.3; return; }
      if (gait) {
        const s1 = Math.sin(ph), c1 = Math.cos(ph);
        lg.rotation.x = -A * s1 * D;
        kn.rotation.x = (6 + K * Math.max(0, c1)) * D;
        const w = 0.45 + 0.55 * ss(-c1 * 1.5 + 0.2);
        ank.rotation.x = -(lg.rotation.x + kn.rotation.x) * w;
        return;
      }
      if (side) { lg.rotation.x = -aU * D; kn.rotation.x = aB * D; }
      else { lg.rotation.z = sgn * aU * D * 0.5; kn.rotation.x = Math.max(0, aB) * D; }
    };
    legPose(rig.legL, rig.knL, rig.ankL, -1, p.lLU, p.lLB, phase);
    legPose(rig.legR, rig.knR, rig.ankR, 1, p.lRU, p.lRB, phase + Math.PI);

    // head: eased toward its target so it follows the body instead of snapping
    const bodyTurn = side || st.view === "back" ? 0 : cl(st.lookEx * 0.55, -0.55, 0.55);
    const ty = cl(p.yaw * D - bodyTurn * 0.7, -1.0, 1.0), tp = cl(p.pitch, -35, 35) * D, tt = p.tilt * D;
    if (fresh) { rig.hy = ty; rig.hp = tp; rig.ht = tt; }
    else {
      const k = 1 - Math.exp(-dt * 16);
      rig.hy += (ty - rig.hy) * k; rig.hp += (tp - rig.hp) * k; rig.ht += (tt - rig.ht) * k;
    }
    rig.neck.rotation.set(rig.hp, rig.hy - twist * 0.7, rig.ht);
    rig.init = true;

    // face
    const open = Math.max(p.mouth, st.expr === "surprised" ? 0.5 : 0);
    const talking = open > 0.12;
    rig.mOpen.visible = talking;
    rig.mOpen.scale.set(1.1, 0.3 + open * 1.1, 0.4);
    rig.lipL.position.y = -0.062 - (talking ? open * 0.016 : 0);
    rig.mSmile.visible = !talking && st.expr === "happy";
    rig.mFrown.visible = !talking && (st.expr === "sad" || st.expr === "angry");
    rig.lips.visible = !(rig.mSmile.visible || rig.mFrown.visible);
    rig.brows.forEach((b, k) => {
      const s = k === 0 ? -1 : 1;
      b.rotation.z = Math.PI / 2 + (st.expr === "angry" ? s * 0.35 : st.expr === "sad" ? -s * 0.35 : 0);
      b.position.y = st.expr === "surprised" ? 0.066 : st.expr === "sad" ? 0.056 : st.expr === "happy" ? 0.058 : 0.052;
    });
    rig.eyes.forEach(e => {
      e.g.scale.y = st.expr === "happy" ? 0.18 : Math.max(0.08, 1 - p.blink);
      e.pup.position.set(p.eyeX * 0.009, -p.eyeY * 0.007, 0);
    });
    rig.laptop.visible = clip === "type";
    rig.blob.scale.setScalar(1 / (1 + Math.max(0, bodyY) * 1.5));
  };

  return { build, pose };
}
