import { Action, Actor, CamKey, CastMember, ClipId, Expr, Hold, PropMember, Scene, SceneProp, Shot3D, View } from "./types";
import { FOOT, H, W } from "./engine";
import { SEATS, SURFACE } from "./props";

const EXPR: [RegExp, Expr][] = [
  [/smil|happy|laugh|cheer|excited|grin/, "happy"],
  [/\bsad|cry|upset|disappoint/, "sad"],
  [/angry|\bmad\b|furious|annoyed/, "angry"],
  [/surpris|shock|gasp|amaz/, "surprised"],
  [/neutral|calm/, "neutral"],
];
const CLIPS: [RegExp, ClipId][] = [
  [/laptop|typing|\btype\b|computer/, "type"],
  [/jump|\bhop|leap/, "jump"],
  [/\bwav(e|es|ing)\b/, "wave"],
  [/point/, "point"],
  [/shrug/, "shrug"],
];
const WALK = /\bwalk|\brun|\bsprint|\bdash|\bjog|\bgo(es)?\b|approach|\bmoves?\b|\bsteps?\b|\bcomes? (over|closer|here|in)|\bheads? (to|over|toward|out)|\bleave|\bexit/;
const RUN = /\brun|\bsprint|\bdash|\bjog|\bhurr|\brush|\bflee/;
const EXIT = /(walk|run|go|head|step|leave|move|drive|exit|sprint|dash)\w*\s+(out|off|away)\b|\bexits?\b|\bexiting\b|\bleaves?\b|\bleaving\b|out of (the )?(scene|frame|room|shot|stage)|off (the )?(screen|scene|stage|frame)/;
const ENTER = /\benters?\b|\bentering\b|\bcomes? in\b|\b(walks?|runs?|drives?) in\b|\bappears?\b|\barrives?\b|from (the )?(left|right)/;
const ENTER_SIDE = /(?:enter\w*|comes? in|arrives?|appears?|from)\s+(?:the\s+)?(?:from\s+)?(?:the\s+)?(left|right)/;
const EXIT_SIDE = /(?:exit\w*|leave\w*|out|off|away)\b[^,.]*?\b(left|right)/;

const HOLDABLE: string[] = ["box", "cake", "bag", "ball"];
const SIT = /\b(sit|sits|sitting|seated)\b|\btakes? a seat\b/;
const STAND = /\b(stands?|standing|gets? up|rises?)\b/;
const PICK = /\b(pick|picks|grab|grabs|take|takes|lift|lifts|carry|carries|bring|brings|hold|holds)\b/;
const GIVE = /\b(give|gives|hand|hands|pass|passes|offer|offers|deliver|delivers)\b/;
const PUT = /\b(put|puts|place|places|set|sets|drop|drops|lay|lays)\b/;
const OUT_CAR = /\b(get|gets|getting|step|steps|climb|climbs|come|comes|hop|hops|jump|jumps)\s+out\b|\bout of\b|\bexits?\b|\bleaves?\b|\bdisembark/;
const NEAR_ONLY = /\b(in front|next to|beside|near|behind|toward|towards)\b/;

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const edge = (left: boolean) => (left ? -260 : W + 260);
const hasName = (l: string, n: string) => new RegExp("\\b" + esc(n.toLowerCase()) + "\\b").test(l);
const sayTime = (s?: string) => (s ? Math.max(2, s.split(/\s+/).length * 0.42 + 1.0) : 0);
const boarding = (l: string, carName: string) =>
  /\b(get|gets|getting|climb|climbs|hop|hops|step|steps|jump|jumps|go|goes)\s+(in|into|inside|on|onto|aboard)\b/.test(l) ||
  /\b(board|boards|boarding|drive|drives|driving|ride|rides|riding)\b/.test(l) ||
  new RegExp("\\benters?\\s+(the\\s+|a\\s+|his\\s+|her\\s+)?" + esc(carName.toLowerCase()) + "\\b").test(l);

// split a line into steps on "then" / ";" but never inside quoted dialogue
const splitSegs = (body: string) => {
  const quotes: string[] = [];
  const masked = body.replace(/"[^"]*"/g, q => { quotes.push(q); return `\u0000${quotes.length - 1}\u0000`; });
  return masked
    .split(/\bthen\b|\bafter that\b|;/i)
    .map(s => s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => quotes[+i]).trim())
    .filter(Boolean);
};

export function parseScript(
  raw: string, cast: CastMember[], propList: PropMember[] = [],
  durOf?: (who: number, text: string) => number | undefined
): Scene {
  const text = raw.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  const actors: Actor[] = cast.map(m => ({ def: m.def, x: m.x, depth: m.depth, actions: [], keys: m.keys ?? [] }));
  const props: SceneProp[] = propList.map(p => ({ ...p, actions: [], holds: [] }));
  const px = actors.map(a => a.x), pxp = props.map(p => p.x);
  const pdepth = actors.map(a => a.depth), pdepthP = props.map(p => p.depth);
  const posOf = (i: number) => (i >= 1000 ? pxp[i - 1000] : px[i]);
  const cam: CamKey[] = [{ t: 0, x: W / 2, y: H / 2, zoom: 1 }];
  const shots: Shot3D[] = [];
  const seatedOn: (number | undefined)[] = actors.map(() => undefined);
  const occ: Record<number, number> = {};
  const holdingOf: ({ pi: number; hold: Hold } | undefined)[] = actors.map(() => undefined);
  const rideOpen: (Action | undefined)[] = actors.map(() => undefined);
  const rideCar: number[] = actors.map(() => -1);
  let beatEnd = 0, prevStart = 0, maxT = 0;

  const findNames = (l: string, skip: number) =>
    actors.map((a, i) => ({ i, n: a.def.name })).filter(q => q.i !== skip && hasName(l, q.n)).map(q => q.i);
  const findProps = (l: string) => props.map((p, i) => ({ i, n: p.name })).filter(q => hasName(l, q.n)).map(q => q.i);

  // ---------- small building blocks ----------
  const leaveSeat = (who: number, t: number): number => {
    const pi = seatedOn[who];
    if (pi === undefined) return t;
    actors[who].actions.push({ t0: t, t1: t + 0.7, posture: "stand" });
    occ[pi] = Math.max(0, (occ[pi] ?? 1) - 1);
    seatedOn[who] = undefined;
    return t + 0.7;
  };
  const walkTo = (who: number, tx: number, td: number, t0: number, run = false): number => {
    const t = leaveSeat(who, t0);
    const dist = Math.abs(tx - px[who]);
    if (dist < 8 && Math.abs(td - pdepth[who]) < 0.02) return t;
    const dur = cl(dist / (run ? 300 : 130), 0.6, 8);
    actors[who].actions.push({ t0: t, t1: t + dur, clip: run ? "run" : "walk", moveTo: tx, toDepth: td });
    px[who] = tx; pdepth[who] = td;
    return t + dur;
  };
  const placeProp = (pi: number, x: number, d: number, lift: number, t: number) => {
    props[pi].actions.push({ t0: t, t1: t, moveTo: x, toDepth: d, lift });
    pxp[pi] = x; pdepthP[pi] = d;
  };
  const pickUp = (who: number, pi: number, t0: number): number => {
    const side = px[who] < pxp[pi] ? -1 : 1;
    const t = walkTo(who, pxp[pi] + side * 60, pdepthP[pi], t0);
    const hold: Hold = { t0: t + 0.5, t1: 1e9, by: who };
    props[pi].holds.push(hold);
    holdingOf[who] = { pi, hold };
    return t + 0.8;
  };
  const release = (who: number, t: number, x: number, d: number, lift: number) => {
    const h = holdingOf[who];
    if (!h) return;
    h.hold.t1 = t;
    placeProp(h.pi, x, d, lift, t);
    holdingOf[who] = undefined;
  };
  const rideIn = (who: number, ci: number, t0: number): number => {
    const side = px[who] < pxp[ci] ? -1 : 1;
    const t = walkTo(who, pxp[ci] + side * 110, pdepthP[ci], t0);
    const ride: Action = { t0: t, t1: 1e9, ride: ci };
    actors[who].actions.push(ride);
    rideOpen[who] = ride; rideCar[who] = ci;
    px[who] = pxp[ci];
    return t + 0.3;
  };
  const rideOut = (who: number, t: number): number => {
    const r = rideOpen[who];
    if (!r) return t;
    r.t1 = t; rideOpen[who] = undefined;
    const ci = rideCar[who];
    px[who] = pxp[ci] + 110; pdepth[who] = pdepthP[ci];
    return t + 0.2;
  };

  // ---------- one step of an actor's line ----------
  const actorSeg = (who: number, seg: string, t0: number): number => {
    const me = actors[who];
    const quoted = seg.match(/"([^"]+)"/)?.[1];
    let say = quoted ?? seg.match(/\b(?:says?|saying)\s+(.+?)(?=\s+(?:while|and|as|with)\b|[,.;]|$)/i)?.[1]?.trim();
    const l = seg.replace(/"[^"]*"/g, " ").toLowerCase();
    const explicit = l.match(/(\d+(?:\.\d+)?)\s*(?:s\b|sec)/)?.[1];
    const base = explicit ? +explicit : 0;
    const expr = EXPR.find(([r]) => r.test(l))?.[1];
    const others = findNames(l, who);
    const propHits = findProps(l);
    const holdable = propHits.find(i => HOLDABLE.includes(props[i].kind));
    const carHit = propHits.find(i => props[i].kind === "car");
    const doorHit = propHits.find(i => props[i].kind === "door");
    const run = RUN.test(l);
    const sayLen = (s?: string) => {
      if (!s) return 0;
      const d = durOf?.(who, s);
      return d !== undefined ? d + 0.3 : sayTime(s);
    };
    const sayKnown = !!say && durOf?.(who, say) !== undefined;

    let look: string | undefined;
    const lm = l.match(/\b(?:look|looks|looking|glance|glances|stare|stares|turn|turns|turning|face|faces|facing)\s+(?:at|to|toward|towards)?\s*(?:the\s+)?([a-z]+)/);
    if (lm && !/^(around|away|back|his|her)$/.test(lm[1])) {
      const w = lm[1];
      if (/^(camera|audience|us|viewer|viewers)$/.test(w)) look = "camera";
      else if (/^(left|right|up|down)$/.test(w)) look = w;
      else if (others.length) look = actors[others[0]].def.name;
      else if (propHits.length && hasName(l, props[propHits[0]].name)) look = props[propHits[0]].name;
    }
    if (!look && others.length && (say || /\b(talk|speak|tell|ask|greet|wave|point|smile|laugh)/.test(l))) look = actors[others[0]].def.name;

    let view: View | undefined;
    if (/turn(s|ing)? around|back to (the )?camera|facing away|faces? away/.test(l)) view = "back";
    else if (/(face|faces|facing|turn(s)? to) (the )?camera|front view/.test(l)) view = "front";
    else if (/profile|sideways|side view/.test(l)) view = "side";

    const nod = /\bnod/.test(l), shake = /shake\w* (his |her |their )?head|disagree/.test(l);

    let t = t0, moveDone = false;

    // ----- cars: get in, drive off, get out -----
    if (rideOpen[who] && OUT_CAR.test(l)) {
      t = rideOut(who, t);
    } else if (carHit !== undefined && !rideOpen[who] && !NEAR_ONLY.test(l) && !OUT_CAR.test(l) && boarding(l, props[carHit].name)) {
      t = rideIn(who, carHit, t);
      if (/\b(drive|drives|driving|off|away)\b/.test(l)) {
        const xs = l.match(EXIT_SIDE)?.[1];
        const left = xs ? xs === "left" : /\bleft\b/.test(l) ? true : /\bright\b/.test(l) ? false : pxp[carHit] > W / 2;
        const tx = edge(left);
        const dur = Math.max(0.8, Math.abs(tx - pxp[carHit]) / 360);
        props[carHit].actions.push({ t0: t, t1: t + dur, moveTo: tx, exit: true });
        pxp[carHit] = tx; px[who] = tx;
        t += dur;
      }
      moveDone = true;
    }

    // ----- doors: come in through, go out through -----
    if (!moveDone && doorHit !== undefined) {
      const dx = pxp[doorHit], dd = pdepthP[doorHit];
      const leaving = /\b(leave|leaves|leaving|exit|exits|exiting|go out|goes out|walk out|walks out|run out|runs out|step out|steps out|out through|out of)\b/.test(l);
      const entering = !leaving && (ENTER.test(l) || /\b(come|comes|walk|walks|run|runs|step|steps|go|goes)\s+(in|into|through)\b|\bthrough\b/.test(l));
      if (leaving) {
        t = leaveSeat(who, t);
        if (say) {
          const gd = Math.max(sayLen(say), sayKnown ? 0.8 : 2.4);
          me.actions.push({ t0: t, t1: t + gd, clip: "talk", say, expr, look, view });
          t += gd; say = undefined;
        }
        const dur = cl(Math.abs(dx - px[who]) / (run ? 300 : 130), 0.6, 8);
        props[doorHit].actions.push({ t0: t + Math.max(0, dur - 0.5), t1: t + dur + 1.0, open: true });
        me.actions.push({ t0: t, t1: t + dur, clip: run ? "run" : "walk", moveTo: dx, toDepth: dd, exit: true });
        px[who] = dx; pdepth[who] = dd;
        t += dur; moveDone = true;
      } else if (entering) {
        t = leaveSeat(who, t);
        const tgt = others[0];
        let tx: number, td = me.depth;
        if (tgt !== undefined && /\b(to|toward|towards|near|beside|next to|approach\w*|over)\b/.test(l)) { tx = px[tgt] + (dx < px[tgt] ? -150 : 150); td = pdepth[tgt]; }
        else if (/cent(er|re)|middle/.test(l)) tx = W / 2;
        else tx = me.x;
        tx = cl(tx, 60, W - 60);
        const dur = cl(Math.abs(tx - dx) / (run ? 300 : 130), 0.8, 8);
        if (me.actions.length === 0) me.startHidden = true;
        props[doorHit].actions.push({ t0: t, t1: t + 0.35 + 1.4, open: true });
        me.actions.push({ t0: t + 0.35, t1: t + 0.35 + dur, clip: run ? "run" : "walk", moveTo: tx, fromX: dx, fromDepth: dd, toDepth: td, enter: true, expr, look, view });
        px[who] = tx; pdepth[who] = td;
        t += 0.35 + dur; moveDone = true;
      }
    }

    // ----- sit and stand -----
    if (!moveDone && !rideOpen[who]) {
      if (STAND.test(l) && seatedOn[who] !== undefined) {
        t = leaveSeat(who, t);
      } else if (SIT.test(l)) {
        let pi: number | undefined = propHits.find(i => SEATS[props[i].kind] !== undefined);
        if (pi === undefined) {
          let best = 1e9;
          for (let i = 0; i < props.length; i++) {
            if (!SEATS[props[i].kind]) continue;
            const dd = Math.abs(pxp[i] - px[who]);
            if (dd < best) { best = dd; pi = i; }
          }
        }
        if (pi !== undefined && seatedOn[who] !== pi) {
          t = leaveSeat(who, t);
          const seats = SEATS[props[pi].kind] as number[];
          const slot = (occ[pi] ?? 0) % seats.length;
          t = walkTo(who, pxp[pi] + seats[slot], pdepthP[pi], t, run);
          me.actions.push({ t0: t, t1: t + 0.6, posture: "sit" });
          occ[pi] = (occ[pi] ?? 0) + 1; seatedOn[who] = pi;
          t += 0.6; moveDone = true;
        }
      }
    }

    // ----- pick up, carry, put down, give -----
    if (!moveDone) {
      const hn = holdingOf[who];
      if (GIVE.test(l) && others.length && (hn || holdable !== undefined)) {
        let cur = hn;
        if (!cur && holdable !== undefined) { t = pickUp(who, holdable, t); cur = holdingOf[who]; }
        if (cur) {
          const tg = others[0];
          t = walkTo(who, px[tg] + (px[who] < px[tg] ? -90 : 90), pdepth[tg], t);
          cur.hold.t1 = t + 0.4;
          const h2: Hold = { t0: t + 0.4, t1: 1e9, by: tg };
          props[cur.pi].holds.push(h2);
          holdingOf[who] = undefined; holdingOf[tg] = { pi: cur.pi, hold: h2 };
          t += 0.8; moveDone = true;
        }
      } else if (hn && PUT.test(l)) {
        const surf = propHits.find(i => SURFACE[props[i].kind] !== undefined && i !== hn.pi);
        if (surf !== undefined) {
          t = walkTo(who, pxp[surf] + (px[who] < pxp[surf] ? -90 : 90), pdepthP[surf], t);
          release(who, t + 0.4, pxp[surf], pdepthP[surf] - 0.002, SURFACE[props[surf].kind] as number);
        } else {
          release(who, t + 0.4, px[who] + 50, pdepth[who] - 0.002, 0);
        }
        t += 0.8; moveDone = true;
      } else if (holdable !== undefined && !hn && PICK.test(l)) {
        t = pickUp(who, holdable, t);
      }
    }

    // ----- ordinary actions -----
    const exit = !moveDone && EXIT.test(l), enter = !moveDone && ENTER.test(l);
    const carryWalk = !moveDone && /\b(carry|carries|bring|brings|take|takes)\b/.test(l) && others.length > 0 && !GIVE.test(l);
    const walk = !moveDone && (WALK.test(l) || exit || enter || carryWalk);
    const other = CLIPS.find(([r]) => r.test(l))?.[1];
    const parallelWalk = /\bwhile\b|\bas (he|she|they|it)\b|\bwalking\b|\brunning\b/.test(l);
    const talkWord = !!say || /talk|speak|chat|explain|tell/.test(l);
    const gesture: ClipId | undefined = other ?? (talkWord ? "talk" : undefined);
    const sayDur = sayLen(say);
    const something = walk || !!say || !!other || nod || shake || !!expr || !!look || !!view;
    if (!something && t !== t0) return t;

    if (walk) {
      t = leaveSeat(who, t);
      const cur = px[who], tgt = others[0];
      const propTgt = propHits.find(i => i !== holdable && i !== holdingOf[who]?.pi);
      const dirLeft = /\bleft\b/.test(l), dirRight = /\bright\b/.test(l);
      const eSide = l.match(ENTER_SIDE)?.[1], xSide = l.match(EXIT_SIDE)?.[1];
      let tx: number, fromX: number | undefined, wd = me.depth;
      if (exit) {
        const exitLeft = xSide ? xSide === "left" : enter && eSide ? eSide !== "left" : dirLeft ? true : dirRight ? false : cur < W / 2;
        tx = edge(exitLeft);
        if (enter) fromX = edge(eSide ? eSide === "left" : !exitLeft);
      } else {
        if (tgt !== undefined && /\b(to|toward|towards|near|beside|next to|approach\w*|over)\b/.test(l)) { tx = px[tgt] + (cur < px[tgt] ? -150 : 150); wd = pdepth[tgt]; }
        else if (propTgt !== undefined && /\b(to|toward|towards|near|beside|next to|at|by|over)\b/.test(l)) { tx = pxp[propTgt] + (cur < pxp[propTgt] ? -130 : 130); wd = pdepthP[propTgt]; }
        else if (/cent(er|re)|middle/.test(l)) tx = W / 2;
        else if (/(left|right) side|far (left|right)/.test(l)) tx = /left/.test(l) ? 260 : 1020;
        else if (enter) tx = me.x;
        else if (/\bleft\b|\bback(ward)?s?\b/.test(l)) tx = cur - 300;
        else if (/\bright\b|forward/.test(l)) tx = cur + 300;
        else tx = tgt !== undefined ? px[tgt] + (cur < px[tgt] ? -150 : 150) : cur + 300;
        tx = cl(tx, 60, W - 60);
        if (enter) fromX = edge(eSide ? eSide === "left" : dirLeft ? true : dirRight ? false : tx < W / 2);
      }
      if (enter && me.actions.length === 0) me.startHidden = true;
      const speed = run ? 300 : 130;
      const walkDur = cl(Math.abs(tx - (fromX ?? cur)) / speed, 0.6, 8);
      const gait: ClipId = run ? "run" : "walk";
      px[who] = tx; pdepth[who] = wd;
      const mv = { moveTo: tx, fromX, toDepth: wd, enter: enter || undefined, exit: exit || undefined };

      if (gesture && !parallelWalk) {
        const gd = base || Math.max(sayDur, gesture === "talk" ? (sayKnown ? 0.8 : 2.5) : (sayKnown ? 1.6 : 2.2), nod || shake ? 1.3 : 0);
        if (exit && !enter) {
          me.actions.push({ t0: t, t1: t + gd, clip: gesture, say, expr, look, view, nod, shake });
          me.actions.push({ t0: t + gd, t1: t + gd + walkDur, clip: gait, ...mv });
        } else {
          me.actions.push({ t0: t, t1: t + walkDur, clip: gait, expr, look, view, ...mv });
          me.actions.push({ t0: t + walkDur, t1: t + walkDur + gd, clip: gesture, say, nod, shake });
        }
        return t + walkDur + gd;
      }
      const dur = Math.max(walkDur, base, sayDur);
      me.actions.push({ t0: t, t1: t + dur, clip: parallelWalk && other ? other : gait, say, expr, look, view, nod, shake, ...mv });
      return t + dur;
    }

    const dur = base || Math.max(sayDur, other ? (sayKnown ? 1.6 : 2.4) : 0, nod || shake ? 1.3 : 0, sayKnown ? 0.6 : 1.5);
    me.actions.push({ t0: t, t1: t + dur, clip: gesture, say, expr, look, view, nod, shake });
    return t + dur;
  };

  // ---------- one step of a prop's line ----------
  const propSeg = (pi: number, seg: string, t0: number): number => {
    const pr = props[pi];
    const l = seg.toLowerCase();
    const cur = pxp[pi];
    const exit = EXIT.test(l), enter = ENTER.test(l);
    const dirLeft = /\bleft\b/.test(l), dirRight = /\bright\b/.test(l);
    const eSide = l.match(ENTER_SIDE)?.[1], xSide = l.match(EXIT_SIDE)?.[1];
    const others = findNames(l, -1);
    const speed = pr.kind === "car" ? 360 : 130;
    let tx: number, fromX: number | undefined;
    if (exit) {
      const exitLeft = xSide ? xSide === "left" : enter && eSide ? eSide !== "left" : dirLeft ? true : dirRight ? false : cur < W / 2;
      tx = edge(exitLeft);
      if (enter) fromX = edge(eSide ? eSide === "left" : !exitLeft);
    } else {
      if (others.length && /\b(to|toward|towards|near|beside|next to|stop\w*|over)\b/.test(l)) tx = px[others[0]] + (cur < px[others[0]] ? -280 : 280);
      else if (/cent(er|re)|middle/.test(l)) tx = W / 2;
      else if (enter) tx = pr.x;
      else if (dirLeft) tx = cur - 500;
      else if (dirRight) tx = cur + 500;
      else return t0;
      if (enter) fromX = edge(eSide ? eSide === "left" : dirLeft ? true : dirRight ? false : tx < W / 2);
    }
    if (enter && pr.actions.length === 0) pr.startHidden = true;
    const dur = Math.max(0.8, Math.abs(tx - (fromX ?? cur)) / speed);
    pr.actions.push({ t0, t1: t0 + dur, moveTo: tx, fromX, enter: enter || undefined, exit: exit || undefined });
    pxp[pi] = tx;
    return t0 + dur;
  };

  // ---------- one step of a camera line ----------
  const camSeg = (seg: string, t0: number): number => {
    const l = seg.toLowerCase();
    const explicit = l.match(/(\d+(?:\.\d+)?)\s*(?:s\b|sec)/)?.[1];
    const orbit = /\b(360|orbit\w*|spin\w*|revolv\w*|rotate\w* around|circl\w* around)\b/.test(l);
    const dur = explicit ? +explicit : orbit ? 5 : 2;
    const last = cam[cam.length - 1];
    cam.push({ ...last, t: t0 });
    const tg = findNames(l, -1)[0], tp = findProps(l)[0];
    const named = tg ?? (tp !== undefined ? 1000 + tp : undefined);
    if (orbit) {
      const dm = l.match(/(\d+)\s*(?:°|deg)/);
      const deg = dm ? +dm[1] : /half/.test(l) ? 180 : 360;
      shots.push({ t0, t1: t0 + dur, deg: /counter|anti|\bleft\b/.test(l) ? -deg : deg, target: named });
      cam.push({ ...last, t: t0 + dur });
      return t0 + dur;
    }
    let next: CamKey = { ...last, t: t0 + dur };
    const closeUp = /close.?up|tight/.test(l);
    if (/zoom in|push in|close.?up|tight|closer/.test(l)) {
      const idx = named ?? last.follow;
      const hgt = idx === undefined ? 300 : idx >= 1000 ? 170 : actors[idx].def.height;
      next = { ...next, zoom: closeUp ? 2.1 : 1.6, y: FOOT - hgt * (closeUp ? 0.8 : 0.55), follow: idx, x: idx !== undefined ? posOf(idx) : last.x };
    } else if (/zoom out|wide|establish|pull back/.test(l)) {
      next = { ...next, zoom: 1, y: H / 2, x: W / 2, follow: undefined };
    } else if (/pan left/.test(l)) next = { ...next, x: last.x - 350, follow: undefined };
    else if (/pan right/.test(l)) next = { ...next, x: last.x + 350, follow: undefined };
    else if (/stop follow|static|lock/.test(l)) next = { ...next, follow: undefined };
    else if (/follow|track/.test(l) && named !== undefined) next = { ...next, follow: named, x: posOf(named) };
    cam.push(next);
    return t0 + dur;
  };

  for (const rawLine of text.split(/\n+/)) {
    let line = rawLine.trim();
    if (!line) continue;
    let parallel = false;
    if (/^[&+]/.test(line)) { parallel = true; line = line.replace(/^[&+]\s*/, ""); }
    const m = line.match(/^([^:"]{1,30}):\s*(.*)$/);
    let who = -1, pwho = -1, isCam = false, body = line;
    if (m) {
      const nm = m[1].trim().toLowerCase();
      if (nm === "camera" || nm === "cam") { isCam = true; body = m[2]; }
      else {
        const i = actors.findIndex(a => a.def.name.toLowerCase() === nm);
        if (i >= 0) { who = i; body = m[2]; }
        else {
          const pi = props.findIndex(p => p.name.toLowerCase() === nm);
          if (pi >= 0) { pwho = pi; body = m[2]; }
        }
      }
    }
    if (!isCam && who < 0 && pwho < 0) { if (!actors.length) continue; who = 0; }
    if (/\b(meanwhile|at the same time|simultaneously)\b/i.test(body.replace(/"[^"]*"/g, " "))) parallel = true;

    const free = isCam || pwho >= 0;   // camera and prop lines run alongside the previous line
    const start = parallel || free ? prevStart : beatEnd;
    if (!parallel && !free) prevStart = start;
    let tl = start;
    for (const seg of splitSegs(body)) {
      const wm = seg.match(/^(?:wait|pause|hold)\D*(\d+(?:\.\d+)?)/i);
      if (wm) { tl += +wm[1]; continue; }
      tl = isCam ? camSeg(seg, tl) : pwho >= 0 ? propSeg(pwho, seg, tl) : actorSeg(who, seg, tl);
    }
    maxT = Math.max(maxT, tl);
    if (!free) beatEnd = Math.max(beatEnd, tl);
  }

  for (const a of actors) for (const k of a.keys) maxT = Math.max(maxT, k.t1);
  const total = Math.max(maxT, beatEnd) + 0.6;
  rideOpen.forEach(r => { if (r) r.t1 = total; });   // anyone still in a car stays there to the end
  cam.sort((a, b) => a.t - b.t);
  return { duration: total, actors, props, cam, shots };
}
