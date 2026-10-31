import * as THREE from "three";
import { CharacterDef, Scene, ThemeId } from "./types";
import { FOOT, H, W, actorState, camAt, drawBubble, posAt, propPlace, smoothPose, visibleAt } from "./engine";
import { AnimIn, D, TAU, cl, lerp, makeKit, sm } from "./kit3d";
import { Env, buildEnv } from "./env3d";
import { RiderHead, buildProp3D } from "./props3d";

const UNIT = 150;                                   // 2D pixels per 3D metre
const toX = (px: number) => (px - 640) / UNIT;
const toZ = (depth: number) => -depth * 8;

export type Sel = { kind: "prop" | "actor"; index: number };
export interface RenderOpts {
  theme: ThemeId; bubbles: boolean; alive: boolean; hidden: string[]; editor: boolean; selection: Sel | null;
}
export interface Renderer3D {
  render(c: CanvasRenderingContext2D, s: Scene, t: number, o: RenderOpts): void;
  orbit(dx: number, dy: number): void;
  zoom(f: number): void;
  pan(dx: number, dy: number): void;
  resetEditorCam(): void;
  pick(nx: number, ny: number): Sel | null;
  ground(nx: number, ny: number, y?: number): { X: number; Z: number } | null;
  info(): { parts: string[]; bounds: Env["bounds"]; height: number };
  dispose(): void;
}

interface HandRig { g: THREE.Group; fingers: THREE.Group[]; thumb: THREE.Group }
interface Rig {
  sig: string; root: THREE.Group; body: THREE.Group; torso: THREE.Group; neck: THREE.Group;
  armL: THREE.Group; elL: THREE.Group; armR: THREE.Group; elR: THREE.Group;
  legL: THREE.Group; knL: THREE.Group; legR: THREE.Group; knR: THREE.Group;
  eyes: { g: THREE.Group; pup: THREE.Group }[]; brows: THREE.Mesh[];
  mFlat: THREE.Mesh; mSmile: THREE.Mesh; mFrown: THREE.Mesh; mOpen: THREE.Mesh;
  laptop: THREE.Group; angle: number; init: boolean; s: number; handL: HandRig; handR: HandRig;
}
const shortest = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const aLerp = (a: number, b: number, u: number) => a + shortest(b - a) * u;
// steady speed in the middle, soft start and stop (r = share of the time spent easing at each end)
const trap = (u: number, r: number) => {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  if (u < r) return (u * u) / (2 * r * (1 - r));
  if (u > 1 - r) return 1 - ((1 - u) * (1 - u)) / (2 * r * (1 - r));
  return (u - r / 2) / (1 - r);
};
const tmpV = new THREE.Vector3();
const dk = (h: string, f: number) => {
  if (h[0] !== "#" || h.length < 7) return h;
  const n = parseInt(h.slice(1, 7), 16);
  return `rgb(${Math.round(((n >> 16) & 255) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`;
};

export function createRenderer3D(): Renderer3D {
  let canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const makeRenderer = (): THREE.WebGLRenderer => {
    const tries: THREE.WebGLRendererParameters[] = [
      { antialias: true, preserveDrawingBuffer: true },
      { antialias: false, preserveDrawingBuffer: true },
      { antialias: false, preserveDrawingBuffer: true, powerPreference: "low-power" },
    ];
    let err: unknown = null;
    for (const p of tries) {
      const cv = document.createElement("canvas");
      cv.width = W; cv.height = H;
      try { const r = new THREE.WebGLRenderer({ canvas: cv, ...p }); canvas = cv; return r; } catch (e) { err = e; }
    }
    throw err instanceof Error ? err : new Error("WebGL is not available in this browser.");
  };
  const renderer = makeRenderer();
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene3 = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 300);   // the director camera
  const edCam = new THREE.PerspectiveCamera(45, W / H, 0.1, 400);    // the editor camera (separate)
  const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
  const sunOff = new THREE.Vector3(10, 20, 10);
  const followSun = (fx: number, fz: number, half: number) => {
    if (!env || env.bounds) return;
    sun.target.position.set(fx, 0, fz);
    sun.position.set(fx, 0, fz).add(sunOff);
    const sc = sun.shadow.camera;
    if (sc.right !== half) { sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.updateProjectionMatrix(); }
    sun.target.updateMatrixWorld();
  };
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  const shadowSize = Math.min(2048, renderer.capabilities.maxTextureSize);
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.0005;
  scene3.add(hemi, sun, sun.target);

  const k = makeKit();
  const { toon, bx, cyl, sph, mesh, limb } = k;

  // ---------- characters ----------
  const buildCharacter = (def: CharacterDef): Rig => {
    const b = def.build ?? 1;
    const skin = def.skin, top = def.top, bot = def.bottom;
    const root = new THREE.Group(), body = new THREE.Group();
    root.add(body);
    const hipY = 0.88;

    const mkLeg = (sgn: number) => {
      const lg = new THREE.Group(); lg.position.set(sgn * 0.1 * b, hipY, 0); body.add(lg);
      const bare = def.outfit !== "pants";
      limb(lg, 0.072 * b, 0.44, def.outfit === "skirt" ? skin : bot);
      const kn = new THREE.Group(); kn.position.y = -0.44; lg.add(kn);
      limb(kn, 0.055 * b, 0.4, bare ? skin : bot);
      bx(kn, 0.11 * b, 0.08, 0.25, def.shoes, 0, -0.41, 0.045);
      return { lg, kn };
    };
    const L = mkLeg(-1), R = mkLeg(1);

    const torso = new THREE.Group(); torso.position.y = hipY; body.add(torso);
    mesh(torso, new THREE.CapsuleGeometry(0.15, 0.25, 4, 14), toon(top), 0, 0.28, 0).scale.set(1.35 * b, 1, 0.75);
    sph(torso, 0.15, bot, 0, 0.02, 0, 1.3 * b, 0.75, 0.82);
    if (def.outfit === "skirt") {
      const sk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.19 * b, 0.34 * b, 0.34, 24, 1, true),
        new THREE.MeshToonMaterial({ color: new THREE.Color(bot), gradientMap: k.gm, side: THREE.DoubleSide }));
      sk.position.y = -0.1; sk.castShadow = true; torso.add(sk);
    }

    const mkArm = (sgn: number) => {
      const sh = new THREE.Group(); sh.position.set(sgn * (0.205 * b + 0.045), 0.5, 0); torso.add(sh);
      sph(sh, 0.058, top, 0, 0, 0);
      limb(sh, 0.045 * b, 0.29, skin);
      const el = new THREE.Group(); el.position.y = -0.29; sh.add(el);
      limb(el, 0.04 * b, 0.27, skin);
      // hand with four fingers and a thumb
      const hg = new THREE.Group(); hg.position.y = -0.27; el.add(hg);
      sph(hg, 0.04, skin, 0, -0.035, 0, 1, 1.15, 0.55);
      const fingers = [-0.021, -0.007, 0.007, 0.021].map((fx, i) => {
        const f = new THREE.Group(); f.position.set(fx, -0.07, 0); hg.add(f);
        limb(f, 0.0115, [0.052, 0.058, 0.056, 0.046][i], skin);
        return f;
      });
      const thumb = new THREE.Group(); thumb.position.set(-sgn * 0.034, -0.03, 0.008); hg.add(thumb);
      limb(thumb, 0.013, 0.045, skin);
      if (def.sleeve === "long") { limb(sh, 0.054 * b, 0.29, top); limb(el, 0.047 * b, 0.2, top); }
      else limb(sh, 0.058 * b, 0.17, top);
      return { sh, el, hand: { g: hg, fingers, thumb } as HandRig };
    };
    const AL = mkArm(-1), AR = mkArm(1);

    const neck = new THREE.Group(); neck.position.y = 0.56; torso.add(neck);
    cyl(neck, 0.045, 0.05, 0.1, skin, 0, 0.02, 0);
    const head = new THREE.Group(); head.position.y = 0.14; neck.add(head);
    sph(head, 0.115, skin, 0, 0, 0, 1, 1.1, 1);
    sph(head, 0.028, skin, -0.113, -0.005, 0, 0.6, 1, 1);
    sph(head, 0.028, skin, 0.113, -0.005, 0, 0.6, 1, 1);

    if (def.hairStyle !== "none") {
      const hm = toon(def.hair);
      const cap = mesh(head, new THREE.SphereGeometry(0.122, 28, 18, 0, TAU, 0, 1.1), hm, 0, 0.012, -0.004);
      const back = mesh(head, new THREE.SphereGeometry(0.123, 28, 18, Math.PI, Math.PI, 0, def.hairStyle === "long" ? 2.5 : 1.95), hm, 0, 0, -0.004);
      cap.scale.y = 1.1; back.scale.y = 1.1;
      if (def.hairStyle === "spiky") {
        const cg = new THREE.ConeGeometry(0.04, 0.11, 6);
        for (let i = 0; i < 7; i++) {
          const th = i === 0 ? 0 : 0.75, ph = ((i - 1) / 6) * TAU;
          const dir = new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)).normalize();
          const cn = mesh(head, cg, hm, dir.x * 0.125, dir.y * 0.138 + 0.01, dir.z * 0.125);
          cn.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        }
      }
      if (def.hairStyle === "bun") sph(head, 0.058, def.hair, 0, 0.14, -0.05);
      if (def.hairStyle === "long") mesh(head, new THREE.CapsuleGeometry(0.09, 0.2, 4, 10), hm, 0, -0.12, -0.075).scale.set(1.3, 1, 0.6);
    }

    const eyes = [-1, 1].map(s => {
      const g = new THREE.Group(); g.position.set(s * 0.043, 0.018, 0.1); head.add(g);
      sph(g, 0.027, "#ffffff", 0, 0, 0, 1, 1.1, 0.5);
      const pup = new THREE.Group(); g.add(pup);
      sph(pup, 0.017, def.eye ?? "#3b2a1e", 0, 0, 0.008, 1, 1, 0.5);
      sph(pup, 0.009, "#14101c", 0, 0, 0.014, 1, 1, 0.5);
      return { g, pup };
    });
    const browCol = def.hairStyle === "none" ? "#3a2a20" : dk(def.hair, 0.8);
    const brows = [-1, 1].map(s => bx(head, 0.045, 0.009, 0.008, browCol, s * 0.043, 0.052, 0.104));
    sph(head, 0.018, dk(skin, 0.9), 0, -0.018, 0.113, 1, 0.9, 1);

    const mFlat = mesh(head, new THREE.BoxGeometry(0.05, 0.006, 0.006), toon("#5a2a2a"), 0, -0.052, 0.107);
    const mSmile = mesh(head, new THREE.TorusGeometry(0.028, 0.0045, 6, 18, Math.PI), toon("#5a2a2a"), 0, -0.034, 0.107);
    mSmile.rotation.z = Math.PI;
    const mFrown = mesh(head, new THREE.TorusGeometry(0.026, 0.0045, 6, 18, Math.PI), toon("#5a2a2a"), 0, -0.078, 0.107);
    const mOpen = sph(head, 0.022, "#5a1f2a", 0, -0.058, 0.1, 1, 0.5, 0.5);

    const laptop = new THREE.Group(); laptop.visible = false; root.add(laptop);
    bx(laptop, 1.0, 0.05, 0.6, "#8a6a4a", 0, 0.72, 0.55);
    for (const [lx, lz] of [[-0.45, 0.3], [0.45, 0.3], [-0.45, 0.8], [0.45, 0.8]]) bx(laptop, 0.05, 0.72, 0.05, "#6e5238", lx, 0.36, lz);
    bx(laptop, 0.46, 0.02, 0.32, "#c9ccd3", 0, 0.755, 0.55);
    bx(laptop, 0.46, 0.3, 0.016, "#2b2f3a", 0, 0.9, 0.42).rotation.x = -0.18;

    return {
      sig: "", root, body, torso, neck,
      armL: AL.sh, elL: AL.el, armR: AR.sh, elR: AR.el,
      legL: L.lg, knL: L.kn, legR: R.lg, knR: R.kn,
      eyes, brows, mFlat, mSmile, mFrown, mOpen, laptop,
      angle: 0, init: false, s: def.height / 300, handL: AL.hand, handR: AR.hand,
    };
  };

  // ---------- environment, sky and light ----------
  const skyTex = (stops: string[]) => k.tex(4, 256, c => {
    const gr = c.createLinearGradient(0, 0, 0, 256), n = stops.length;
    stops.forEach((col, i) => gr.addColorStop((i / (n - 1)) * 0.5, col));
    gr.addColorStop(0.5, stops[n - 1]); gr.addColorStop(1, stops[n - 1]);
    c.fillStyle = gr; c.fillRect(0, 0, 4, 256);
  });
  let env: Env | null = null;
  let envTheme: ThemeId | null = null;
  let sky: THREE.Mesh | null = null;
  let skyExtras: THREE.Group | null = null;

  // ---------- editor camera (the world stays put, the camera moves around it) ----------
  const ed = { az: 0.55, el: 0.55, dist: 20, tx: 0, ty: 1, tz: -3 };
  const placeEdCam = () => {
    const ce = Math.cos(ed.el);
    edCam.position.set(ed.tx + Math.sin(ed.az) * ce * ed.dist, ed.ty + Math.sin(ed.el) * ed.dist, ed.tz + Math.cos(ed.az) * ce * ed.dist);
    edCam.lookAt(ed.tx, ed.ty, ed.tz);
    edCam.updateMatrixWorld();
  };
  const resetEdCam = () => {
    const b = env?.bounds;
    if (env?.view) { ed.tx = 0; ed.ty = 1; ed.tz = env.view.tz; ed.dist = env.view.dist; ed.az = 0.55; ed.el = 0.55; return; }
    if (b) {
      ed.tx = (b.minX + b.maxX) / 2; ed.tz = (b.minZ + b.maxZ) / 2; ed.ty = 1;
      ed.dist = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * 1.1;
    } else { ed.tx = 0; ed.tz = -6; ed.ty = 1; ed.dist = 24; }
    ed.az = 0.55; ed.el = 0.55;
  };

  const applyEnv = (theme: ThemeId) => {
    if (env) { scene3.remove(env.group); k.dispose(env.group); }
    if (skyExtras) { scene3.remove(skyExtras); k.dispose(skyExtras); }
    env = buildEnv(k, theme);
    scene3.add(env.group);
    envTheme = theme;
    const L = env.light;

    if (!sky) {
      sky = new THREE.Mesh(new THREE.SphereGeometry(120, 24, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false }));
      scene3.add(sky);
    }
    const skyMat = sky.material as THREE.MeshBasicMaterial;
    if (skyMat.map) skyMat.map.dispose();
    skyMat.map = skyTex(L.sky); skyMat.needsUpdate = true;
    scene3.fog = new THREE.Fog(new THREE.Color(L.sky[L.sky.length - 1]), L.room ? 90 : 45, L.room ? 170 : 110);

    hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
    skyExtras = new THREE.Group(); scene3.add(skyExtras);
    const b = env.bounds;
    const cx = b ? (b.minX + b.maxX) / 2 : 0, cz = b ? (b.minZ + b.maxZ) / 2 : -2;
    sun.target.position.set(cx, 0, cz);
    if (L.sun) {
      const dir = new THREE.Vector3(L.sun.dir[0], L.sun.dir[1], L.sun.dir[2]).normalize();
      sun.color.set(L.sun.color); sun.intensity = L.sun.intensity;
      sunOff.copy(dir).multiplyScalar(30);
      sun.position.set(cx, 0, cz).add(sunOff);
      const disc = new THREE.Mesh(new THREE.SphereGeometry(L.sun.size, 16, 12), new THREE.MeshBasicMaterial({ color: L.sun.disc, fog: false }));
      disc.position.copy(dir.clone().multiplyScalar(100)); skyExtras.add(disc);
    } else {
      sun.color.set("#ffffff"); sun.intensity = 0.5; sun.position.set(cx + 2, 9, cz + 6);
    }
    if (L.stars) {
      const pts: number[] = [];
      for (let i = 0; i < 260; i++) {
        const u = (((i * 127.1) % 1000) / 1000) * TAU, v = 0.15 + (((i * 311.7) % 1000) / 1000) * 0.85, r = 110, q = Math.sqrt(1 - v * v);
        pts.push(Math.cos(u) * q * r, v * r, Math.sin(u) * q * r);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      skyExtras.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false })));
    }
    const half = b ? Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + 2 : 14;
    const sc = sun.shadow.camera;
    sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.updateProjectionMatrix();
    resetEdCam();
  };

  // ---------- keep 3D objects in sync with the scene ----------
  const rigs: (Rig | null)[] = [];
  const sigOf = (d: CharacterDef) => [d.skin, d.hair, d.eye, d.top, d.bottom, d.shoes, d.hairStyle, d.outfit, d.sleeve, d.build, d.height].join("|");
  const syncRigs = (s: Scene) => {
    s.actors.forEach((a, i) => {
      const sig = sigOf(a.def), cur = rigs[i];
      if (!cur || cur.sig !== sig) {
        if (cur) { scene3.remove(cur.root); k.dispose(cur.root); }
        const r = buildCharacter(a.def);
        r.sig = sig; r.root.scale.setScalar(a.def.height / 300);
        scene3.add(r.root); rigs[i] = r;
      }
    });
    for (let i = s.actors.length; i < rigs.length; i++) { const r = rigs[i]; if (r) { scene3.remove(r.root); k.dispose(r.root); } }
    rigs.length = s.actors.length;
  };
  const propObjs: ({ sig: string; g: THREE.Group } | null)[] = [];
  const syncProps = (s: Scene) => {
    s.props.forEach((p, i) => {
      const sig = p.kind + "|" + p.color, cur = propObjs[i];
      if (!cur || cur.sig !== sig) {
        if (cur) { scene3.remove(cur.g); k.dispose(cur.g); }
        const g = buildProp3D(k, p.kind, p.color);
        scene3.add(g); propObjs[i] = { sig, g };
      }
    });
    for (let i = s.props.length; i < propObjs.length; i++) { const o = propObjs[i]; if (o) { scene3.remove(o.g); k.dispose(o.g); } }
    propObjs.length = s.props.length;
  };

  // ---------- posing ----------
  const poseRig = (rig: Rig, st: ReturnType<typeof actorState>, jump: boolean, dt: number) => {
    const p = st.pose, clip = st.clip, side = st.walking || st.view === "side";
    const lie = p.lie;
    const seatA = (st.seatRot ?? 0) * D;            // direction of the chair or bed we are on
    rig.root.position.set(toX(st.x) + lie * 0.9 * Math.cos(seatA), 0, toZ(st.depth) - lie * 0.9 * Math.sin(seatA));
    
    let target = 0;
    if (st.moving) target = st.heading;
    else if (side) target = st.face > 0 ? Math.PI / 2 : -Math.PI / 2;
    else if (st.view === "back") target = Math.PI;
    else target = cl(st.lookEx * 0.55, -0.55, 0.55);
    if (!rig.init || jump) { rig.angle = target; rig.init = true; }
    else rig.angle += shortest(target - rig.angle) * (1 - Math.exp(-dt * 12));
    const faceA = aLerp(rig.angle, seatA, p.sit);
    rig.root.rotation.y = aLerp(faceA, seatA + Math.PI / 2, lie);
    // a little hip sway and shoulder twist while walking
    const sw = st.walking ? cl(p.lLU / (clip === "run" ? 48 : 26), -1, 1) : 0;
    rig.body.position.y = -p.bob * 0.0058 - p.sit * 0.27 + lie * 0.78;
    rig.body.rotation.set(-lie * Math.PI / 2, -0.05 * sw, 0.015 * sw);
    rig.torso.rotation.set(p.lean * D, 0.1 * sw, 0);

    const setArm = (sh: THREE.Group, el: THREE.Group, aU: number, aB: number, sgn: number) => {
      sh.rotation.set(0, 0, 0); el.rotation.set(0, 0, 0);
      if (st.holding && (!st.oneHand || sgn > 0)) {
        if (st.oneHand) { sh.rotation.set(-0.55, 0, 0.18); el.rotation.x = -1.75; }   // phone: one hand up in front
        else { sh.rotation.set(-0.8, 0, sgn * 0.12); el.rotation.x = -1.15; }
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

    const setLeg = (lg: THREE.Group, kn: THREE.Group, aU: number, aB: number, sgn: number) => {
      lg.rotation.set(0, 0, 0); kn.rotation.set(0, 0, 0);
      if (p.sit > 0.02 && !st.moving) { lg.rotation.x = -p.sit * 1.25; kn.rotation.x = p.sit * 1.25; return; }
      if (clip === "jump") { lg.rotation.x = -0.5; kn.rotation.x = 1.0; return; }
      if (side) { lg.rotation.x = -aU * D; kn.rotation.x = aB * D; }
      else { lg.rotation.z = sgn * aU * D * 0.5; kn.rotation.x = Math.max(0, aB) * D; }
    };
    setLeg(rig.legL, rig.knL, p.lLU, p.lLB, -1);
    setLeg(rig.legR, rig.knR, p.lRU, p.lRB, 1);

    // fingers
    const curl = (h: HandRig, sgn: number, c: number, indexOut = false) => {
      const idx = sgn > 0 ? 0 : 3;
      h.fingers.forEach((f, i) => f.rotation.set(0, 0, -sgn * (indexOut && i === idx ? 0.05 : c)));
      h.thumb.rotation.z = -sgn * (0.5 - Math.min(c, 1.2) * 0.2);
    };
    const relaxed = clip === "run" ? 1.2 : clip === "type" ? 0.6 : clip === "talk" ? 0.25 : 0.35;
    curl(rig.handL, -1, st.holding && !st.oneHand ? 0.9 : relaxed);
    curl(rig.handR, 1, st.holding ? 0.9 : clip === "wave" ? 0.08 : clip === "point" ? 1.4 : relaxed, clip === "point" && !st.holding);

    const bodyYaw = side || st.view === "back" ? 0 : cl(st.lookEx * 0.55, -0.55, 0.55);
    rig.neck.rotation.set(cl(p.pitch, -35, 35) * D, cl(p.yaw * D - bodyYaw * 0.7 - 0.07 * sw, -1.0, 1.0), p.tilt * D);

    const open = Math.max(p.mouth, st.expr === "surprised" ? 0.5 : 0);
    const talking = open > 0.12;
    rig.mOpen.visible = talking;
    rig.mOpen.scale.set(1.3, 0.3 + open * 1.2, 0.4);
    rig.mSmile.visible = !talking && st.expr === "happy";
    rig.mFrown.visible = !talking && (st.expr === "sad" || st.expr === "angry");
    rig.mFlat.visible = !talking && !rig.mSmile.visible && !rig.mFrown.visible;
    rig.brows.forEach((br, i) => {
      const s = i === 0 ? -1 : 1;
      br.rotation.z = st.expr === "angry" ? s * 0.35 : st.expr === "sad" ? -s * 0.35 : 0;
      br.position.y = st.expr === "surprised" ? 0.066 : st.expr === "sad" ? 0.056 : st.expr === "happy" ? 0.058 : 0.052;
    });
    rig.eyes.forEach(e => {
      e.g.scale.y = st.expr === "happy" ? 0.18 : Math.max(0.08, 1 - p.blink);
      e.pup.position.set(p.eyeX * 0.009, -p.eyeY * 0.007, 0);
    });
    rig.laptop.visible = clip === "type";
  };

  // ---------- director camera: angle, zoom up to 10x, and steady 360 orbits ----------
  const placeCamera = (s: Scene, t: number) => {
    const c2 = camAt(s, t);
    const tx = toX(c2.x), ty = cl((FOOT - c2.y) / 171, 0.4, 3);   // 171 px per metre: a 300 px person is 1.75 m
    const dist = 7.2 / c2.zoom;                                    // 10x zoom = 0.72 m from the face
    let az = c2.az * D, rise = 0, ox = tx, oy = ty, oz = 0;
    for (const sh of s.shots) {
      const len = Math.max(0.01, sh.t1 - sh.t0);
      const u = cl((t - sh.t0) / len, 0, 1);
      az += sh.deg * D * trap(u, Math.min(0.2, 1.5 / Math.max(1, len)));   // steady speed, gentle start and stop
      if (t >= sh.t0 && t <= sh.t1) {
        rise += Math.sin(Math.PI * u) * 0.25 * Math.min(1, dist / 4);
        if (sh.target !== undefined) {
          const ent = sh.target >= 1000 ? s.props[sh.target - 1000] : s.actors[sh.target];
          if (ent) {
            const pe = posAt(ent, t, s.props);
            const w = sm(cl((t - sh.t0) / 1.5, 0, 1)) * (1 - sm(cl((t - (sh.t1 - 1.5)) / 1.5, 0, 1)));
            ox = lerp(tx, toX(pe.x), w); oz = lerp(0, toZ(pe.depth), w); oy = lerp(ty, 1.15, w);
          }
        }
      }
    }
    const el = c2.el * D, ce = Math.cos(el);
    camera.position.set(ox + Math.sin(az) * ce * dist, oy + Math.sin(el) * dist + rise, oz + Math.cos(az) * ce * dist);
    camera.lookAt(ox, oy, oz);
    camera.updateMatrixWorld();
    return { fx: ox, fz: oz };
  };

  // ---------- selection highlight ----------
  const helper = new THREE.BoxHelper(new THREE.Object3D(), 0xffd400);
  (helper.material as THREE.LineBasicMaterial).depthTest = false;
  helper.visible = false; helper.renderOrder = 10; scene3.add(helper);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffd400, side: THREE.DoubleSide, depthTest: false }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; ring.renderOrder = 10; scene3.add(ring);
  const box = new THREE.Box3(), size = new THREE.Vector3(), center = new THREE.Vector3();

  // ---------- picking ----------
  const ray = new THREE.Raycaster();
  const ndc = (nx: number, ny: number) => new THREE.Vector2(nx * 2 - 1, -(ny * 2 - 1));
  const pick = (nx: number, ny: number): Sel | null => {
    ray.setFromCamera(ndc(nx, ny), edCam);
    const roots: { obj: THREE.Object3D; sel: Sel }[] = [];
    propObjs.forEach((o, i) => { if (o && o.g.visible) roots.push({ obj: o.g, sel: { kind: "prop", index: i } }); });
    rigs.forEach((r, i) => { if (r && r.root.visible) roots.push({ obj: r.root, sel: { kind: "actor", index: i } }); });
    const hits = ray.intersectObjects(roots.map(r => r.obj), true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) { const f = roots.find(r => r.obj === o); if (f) return f.sel; o = o.parent; }
    }
    return null;
  };
  const ground = (nx: number, ny: number, y = 0) => {
    ray.setFromCamera(ndc(nx, ny), edCam);
    const p = new THREE.Vector3();
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p) ? { X: p.x, Z: p.z } : null;
  };

  // ---------- frame ----------
  let lastNow = performance.now(), lastT = 0;
  let RW = W, RH = H;
  const render = (c: CanvasRenderingContext2D, s0: Scene, t: number, o: RenderOpts) => {
        // follow the size of the picture: wide for a video, tall for a Short
    const cw = c.canvas.width, ch = c.canvas.height;
    if (cw !== RW || ch !== RH) {
      RW = cw; RH = ch;
      renderer.setSize(cw, ch, false);
      camera.aspect = cw / ch; camera.fov = cw < ch ? 48 : 40; camera.updateProjectionMatrix();
      edCam.aspect = cw / ch; edCam.updateProjectionMatrix();
    }
    if (envTheme !== o.theme) applyEnv(o.theme);
    const e = env as Env;
    for (const [name, objs] of Object.entries(e.parts)) for (const ob of objs) ob.visible = !o.hidden.includes(name);

    // the editor shows the set as laid out (everybody present, standing); the film view follows the script
    const s: Scene = o.editor
      ? {
          ...s0,
          actors: s0.actors.map(a => ({ ...a, actions: [], keys: [], startHidden: false })),
          props: s0.props.map(p => ({ ...p, actions: [], holds: [], startHidden: false })),
          shots: [],
        }
      : s0;
    syncRigs(s); syncProps(s);

    const now = performance.now();
    let dt = (now - lastNow) / 1000; lastNow = now;
    const jump = Math.abs(t - lastT) > 0.25 || dt > 0.25;
    lastT = t; dt = cl(dt, 0, 0.1);
    e.anim(t, dt, o.alive);

    const talkers: { x: number; y: number; z: number; say: string }[] = [];
    const sits: number[] = [];
    s.actors.forEach((a, i) => {
      const rig = rigs[i];
      if (!rig) return;
      const vis = visibleAt(a, t);
      rig.root.visible = vis;
      if (!vis) {
        const sr = actorState(s, a, t);
        if (sr.say && a.actions.some(q => q.ride !== undefined && t >= q.t0 && t < q.t1)) talkers.push({ x: toX(sr.x), y: 2.1, z: toZ(sr.depth), say: sr.say });
        return;
      }
      const st0 = actorState(s, a, t);
      const st = { ...st0, pose: smoothPose("3d" + i, st0.pose, t) };
      poseRig(rig, st, jump, dt);
      sits[i] = st.pose.sit;
      if (st.say) talkers.push({ x: toX(st.x), y: 1.86 * rig.s, z: toZ(st.depth), say: st.say });
    });

    s.props.forEach((p, i) => {
      const po = propObjs[i];
      if (!po) return;
      const vis = visibleAt(p, t);
      po.g.visible = vis;
      if (!vis) return;
      const pl = propPlace(s, p, t);
      const holder = pl.held ? rigs[pl.by] : undefined;
      const rotY = (p.rot ?? 0) * D;
      po.g.rotation.order = "YXZ"; po.g.rotation.set(0, 0, 0);
      if (pl.held && holder && p.kind === "phone") {
        // a phone sits in the right hand, screen toward the face
        holder.root.updateMatrixWorld(true);
        holder.handR.g.getWorldPosition(tmpV);
        po.g.position.set(tmpV.x, tmpV.y - 0.04 * holder.s, tmpV.z);
        po.g.rotation.set(-0.35, holder.angle + Math.PI, 0);
      } else if (pl.held && holder) {
        po.g.position.set(
          holder.root.position.x + Math.sin(holder.angle) * 0.32 * holder.s,
          (0.85 - (sits[pl.by] ?? 0) * 0.27) * holder.s,
          holder.root.position.z + Math.cos(holder.angle) * 0.32 * holder.s);
        po.g.rotation.y = holder.angle;
      } else {
        po.g.position.set(toX(pl.x), pl.lift / UNIT, toZ(pl.depth));
        const dir = (p.flip ? -1 : 1) * (p.kind === "car" ? pl.face : 1);
        po.g.rotation.y = p.kind === "car" ? (dir > 0 ? 0 : Math.PI) + rotY : (p.flip ? Math.PI : 0) + rotY;
      }
      po.g.scale.setScalar(p.scale);

      const wheels = po.g.userData.wheels as THREE.Group[] | undefined;
      if (wheels) { const dir = (p.flip ? -1 : 1) * pl.face; for (const w of wheels) w.rotation.z = -(toX(pl.x) * dir) / 0.27; }
      const panel = po.g.userData.panel as THREE.Group | undefined;
      if (panel) panel.rotation.y = pl.open * 1.45;
      const anim = po.g.userData.anim as ((a: AnimIn) => void) | undefined;
      if (anim) anim({ t, dt, alive: o.alive, power: pl.power, open: pl.open });
      const riders = po.g.userData.riders as RiderHead[] | undefined;
      if (riders) {
        const inside = s.actors.filter(a => a.actions.some(q => q.ride === i && t >= q.t0 && t < q.t1));
        riders.forEach((r, n) => {
          const a = inside[n];
          r.g.visible = !!a;
          if (a) { r.skin.material = toon(a.def.skin); r.hair.material = toon(a.def.hair); }
        });
      }
    });

    // highlight the selected object (editor only)
    const sel = o.editor ? o.selection : null;
    const target = sel ? (sel.kind === "prop" ? propObjs[sel.index]?.g : rigs[sel.index]?.root) : undefined;
    if (target) {
      helper.visible = true; helper.setFromObject(target);
      box.setFromObject(target); box.getSize(size); box.getCenter(center);
      ring.visible = true; ring.position.set(center.x, 0.03, center.z); ring.scale.setScalar(Math.max(size.x, size.z) / 2 + 0.25);
    } else { helper.visible = false; ring.visible = false; }

    if (o.editor) {
      placeEdCam();
      followSun(ed.tx, ed.tz, 40);
      if (sky) sky.position.copy(edCam.position);
      renderer.render(scene3, edCam);
    } else {
      const fc = placeCamera(s, t);
      followSun(fc.fx, fc.fz, 16);
      if (sky) sky.position.copy(camera.position);
      renderer.render(scene3, camera);
    }
    c.drawImage(canvas, 0, 0, RW, RH);

    if (o.bubbles && !o.editor) {
      for (const q of talkers) {
        const v = new THREE.Vector3(q.x, q.y, q.z).project(camera);
        if (v.z > -1 && v.z < 1) drawBubble(c, q.say, (v.x * 0.5 + 0.5) * RW, (-v.y * 0.5 + 0.5) * RH
      }
    }
  };

  return {
    render,
    orbit(dx, dy) { ed.az -= dx * 0.008; ed.el = cl(ed.el + dy * 0.006, 0.03, 1.5); },
    zoom(f) { ed.dist = cl(ed.dist * f, 1.5, 120); },
    pan(dx, dy) {
      const kk = ed.dist * 0.0016;
      const rx = Math.cos(ed.az), rz = -Math.sin(ed.az), fx = -Math.sin(ed.az), fz = -Math.cos(ed.az);
      ed.tx += -rx * dx * kk + fx * dy * kk;
      ed.tz += -rz * dx * kk + fz * dy * kk;
    },
    resetEditorCam: resetEdCam,
    pick, ground,
    info() {
      const parts = env
        ? Object.entries(env.parts)
            .filter(([, os]) => os.some(o2 => (o2 as THREE.Group).children.length > 0 || (o2 as THREE.Mesh).isMesh || (o2 as THREE.Light).isLight))
            .map(([n]) => n)
        : [];
      return { parts, bounds: env ? env.bounds : null, height: env ? env.height : 5 };
    },
    dispose() { k.dispose(scene3); renderer.dispose(); },
  };
}
