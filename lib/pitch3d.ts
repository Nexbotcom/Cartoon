import * as THREE from "three";
import type { Env, EnvLight } from "./env3d";
import { Kit, rnd } from "./kit3d";

const LIGHT: EnvLight = {
  sky: ["#7ec8ff", "#eaf6ff"], hemi: ["#cfe9ff", "#7a9a6a", 1.3],
  sun: { dir: [0.5, 0.35, -0.8], color: "#fff6df", intensity: 2.2, disc: "#fff3b0", size: 5 },
};

export function buildPitch(k: Kit): Env {
  const { bx, cyl, sph, mesh, toon, gm } = k;
  const g = new THREE.Group();
  const parts: Record<string, THREE.Object3D[]> = {};
  const grp = (name: string) => { const o = new THREE.Group(); g.add(o); (parts[name] ??= []).push(o); return o; };
  const gGround = grp("ground"), gBack = grp("backdrop"), gClouds = grp("clouds");
  const FX0 = -30, FX1 = 30, FZ0 = -21, FZ1 = 15, CZ = -3;     // the playing field, in metres
  const animFns: ((t: number, dt: number, alive: boolean) => void)[] = [];

  // grass with mowing stripes
  const ground = new THREE.Mesh(new THREE.CircleGeometry(160, 48), toon("#2c6f37"));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; gGround.add(ground);
  for (let i = 0; i < 15; i++) {
    const st = new THREE.Mesh(new THREE.PlaneGeometry(4, FZ1 - FZ0), toon(i % 2 ? "#3a9444" : "#43a04d"));
    st.rotation.x = -Math.PI / 2; st.position.set(FX0 + 2 + i * 4, 0.006, CZ); st.receiveShadow = true; gGround.add(st);
  }

  // markings
  const line = (w: number, d: number, x: number, z: number) => { bx(gGround, w, 0.02, d, "#ffffff", x, 0.03, z).castShadow = false; };
  line(60, 0.14, 0, FZ0); line(60, 0.14, 0, FZ1);
  line(0.14, FZ1 - FZ0, FX0, CZ); line(0.14, FZ1 - FZ0, FX1, CZ); line(0.14, FZ1 - FZ0, 0, CZ);
  for (const s of [-1, 1]) {
    const gx = s < 0 ? FX0 : FX1;
    line(0.14, 20, gx - s * 9, CZ); line(9, 0.14, gx - s * 4.5, CZ - 10); line(9, 0.14, gx - s * 4.5, CZ + 10);
    line(0.14, 10, gx - s * 3.5, CZ); line(3.5, 0.14, gx - s * 1.75, CZ - 5); line(3.5, 0.14, gx - s * 1.75, CZ + 5);
    cyl(gGround, 0.12, 0.12, 0.02, "#ffffff", gx - s * 6.5, 0.03, CZ).castShadow = false;
  }
  const ring = mesh(gGround, new THREE.TorusGeometry(4.6, 0.07, 6, 48), toon("#ffffff"), 0, 0.03, CZ);
  ring.rotation.x = Math.PI / 2; ring.castShadow = false;
  cyl(gGround, 0.14, 0.14, 0.02, "#ffffff", 0, 0.03, CZ).castShadow = false;
  for (const x of [FX0, FX1]) for (const z of [FZ0, FZ1]) {
    cyl(gGround, 0.03, 0.03, 1.5, "#f4f1ea", x, 0.75, z);
    bx(gGround, 0.5, 0.3, 0.02, "#e63946", x - Math.sign(x) * 0.25, 1.35, z);
  }

  // advertising boards all the way round
  const boards = ["#2f6fdc", "#e63946", "#f4a261", "#2a9d8f"];
  for (let i = 0; i < 15; i++) {
    bx(gBack, 3.9, 0.9, 0.1, boards[i % 4], FX0 + 2 + i * 4, 0.45, FZ0 - 1.3);
    bx(gBack, 3.9, 0.9, 0.1, boards[(i + 2) % 4], FX0 + 2 + i * 4, 0.45, FZ1 + 1.3);
  }
  for (let i = 0; i < 9; i++) {
    bx(gBack, 0.1, 0.9, 3.9, boards[i % 4], FX0 - 1.3, 0.45, FZ0 + 2 + i * 4);
    bx(gBack, 0.1, 0.9, 3.9, boards[(i + 1) % 4], FX1 + 1.3, 0.45, FZ0 + 2 + i * 4);
  }
  // floodlights
  for (const x of [-35, 35]) for (const z of [-26, 20]) {
    cyl(gBack, 0.2, 0.3, 18, "#3a3f4b", x, 9, z);
    bx(gBack, 4, 1, 0.4, "#fff3b0", x, 18.4, z, true);
  }

  // four stands, each full of cheering fans
  const palette = ["#e63946", "#f4a261", "#2a9d8f", "#457b9d", "#e9c46a", "#f1faee", "#8338ec", "#ff7aa2"].map(c => new THREE.Color(c));
  const skins = ["#f2c9a0", "#8a5a3a", "#d9a066"].map(c => new THREE.Color(c));
  const mkStand = (name: string, r: number, cx: number, cz: number, length: number) => {
    const sg = grp(name);
    const tiers = 5, step = 2.0;
    const loc = (u: number, v: number): [number, number] => [cx + u * Math.cos(r) + v * Math.sin(r), cz - u * Math.sin(r) + v * Math.cos(r)];
    const count = Math.floor(length / 1.25), n = tiers * count;
    const bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.55, 0.35), new THREE.MeshToonMaterial({ gradientMap: gm }), n);
    const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshToonMaterial({ gradientMap: gm }), n);
    const base: [number, number, number][] = [];
    let idx = 0;
    for (let t = 0; t < tiers; t++) {
      const [sx, sz] = loc(0, 1 + t * step);
      const stp = new THREE.Mesh(new THREE.BoxGeometry(length, (t + 1) * 0.9, step), toon("#6f7586"));
      stp.position.set(sx, ((t + 1) * 0.9) / 2, sz); stp.rotation.y = r; stp.castShadow = true; stp.receiveShadow = true; sg.add(stp);
      for (let j = 0; j < count; j++, idx++) {
        const [x, z] = loc(-length / 2 + 0.6 + j * 1.25 + (t % 2) * 0.4, 1 + t * step);
        base.push([x, (t + 1) * 0.9, z]);
        bodies.setColorAt(idx, palette[Math.floor(rnd(idx + name.length, 1) * palette.length)]);
        heads.setColorAt(idx, skins[Math.floor(rnd(idx + name.length, 2) * skins.length)]);
      }
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
    sg.add(bodies, heads);
    animFns.push((t, _dt, alive) => { if (alive) place(t, true); });
  };
  mkStand("stand_back", Math.PI, 0, FZ0 - 2.0, 64);
  mkStand("stand_front", 0, 0, FZ1 + 2.0, 64);
  mkStand("stand_left", -Math.PI / 2, FX0 - 2.0, CZ, 44);
  mkStand("stand_right", Math.PI / 2, FX1 + 2.0, CZ, 44);

  // scoreboard above the back stand
  const boardTex = k.tex(256, 96, c => {
    c.fillStyle = "#101319"; c.fillRect(0, 0, 256, 96);
    c.fillStyle = "#ffd400"; c.font = "700 44px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("7B  0 : 0  AWAY", 128, 50);
  });
  bx(gBack, 12.4, 5, 0.3, "#14161c", 0, 10.5, -33.9);
  const sb = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.6), new THREE.MeshBasicMaterial({ map: boardTex }));
  sb.position.set(0, 10.5, -33.7); gBack.add(sb);

  // clouds
  const clouds: THREE.Object3D[] = [];
  for (let i = 0; i < 9; i++) {
    const cg = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const m = sph(cg, 1.6 * (0.6 + rnd(i * 7 + j, 2) * 0.5), "#ffffff", (j - 1.5) * 1.7, rnd(j, 3) * 0.6, 0, 1, 0.65, 0.8);
      m.castShadow = false;
    }
    cg.position.set(-60 + rnd(i, 4) * 120, 20 + rnd(i, 5) * 10, -35 - rnd(i, 6) * 35);
    cg.scale.setScalar((1 + rnd(i, 1) * 1.2) * 1.4);
    gClouds.add(cg); clouds.push(cg);
  }

  return {
    group: g, parts, bounds: null, height: 18, view: { dist: 85, tz: CZ }, light: LIGHT,
    anim: (t, dt, alive) => {
      clouds.forEach((c, i) => { if (alive) { c.position.x += dt * (0.5 + (i % 4) * 0.15); if (c.position.x > 75) c.position.x = -75; } });
      animFns.forEach(f => f(t, dt, alive));
    },
  };
}
