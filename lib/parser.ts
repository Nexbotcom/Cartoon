import { Action, Actor, CamKey, CastMember, ClipId, Expr, PropMember, Scene, SceneProp, Shot3D, View } from "./types";
import { FOOT, H, W } from "./engine";

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

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const edge = (left: boolean) => (left ? -260 : W + 260);
const hasName = (l: string, n: string) => new RegExp("\\b" + esc(n.toLowerCase()) + "\\b").test(l);

// split a line into steps on "then" / ";" but never inside quoted dialogue
const splitSegs = (body: string) => {
  const quotes: string[] = [];
  const masked = body.replace(/"[^"]*"/g, q => { quotes.push(q); return `\u0000${quotes.length - 1}\u0000`; });
  return masked
    .split(/\bthen\b|\bafter that\b|;/i)
    .map(s => s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => quotes[+i]).trim())
    .filter(Boolean);
};

export function parseScript(raw: string, cast: CastMember[], propList: PropMember[] = []): Scene {
  const text = raw.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  const actors: Actor[] = cast.map(m => ({ def: m.def, x: m.x, depth: m.depth, actions: [], keys: m.keys ?? [] }));
  const props: SceneProp[] = propList.map(p => ({ ...p, actions: [] }));
  const px = actors.map(a => a.x), pxp = props.map(p => p.x);
  const posOf = (i: number) => (i >= 1000 ? pxp[i - 1000] : px[i]);
  const cam: CamKey[] = [{ t: 0, x: W / 2, y: H / 2, zoom: 1 }];
  const shots: Shot3D[] = [];
  let beatEnd = 0, prevStart = 0, maxT = 0;

  const findNames = (l: string, skip: number) =>
    actors.map((a, i) => ({ i, n: a.def.name })).filter(q => q.i !== skip && hasName(l, q.n)).map(q => q.i);
  const findProps = (l: string) => props.map((p, i) => ({ i, n: p.name })).filter(q => hasName(l, q.n)).map(q => q.i);

  const actorSeg = (who: number, seg: string, t0: number): number => {
    const me = actors[who];
    const quoted = seg.match(/"([^"]+)"/)?.[1];
    const say = quoted ?? seg.match(/\b(?:says?|saying)\s+(.+?)(?=\s+(?:while|and|as|with)\b|[,.;]|$)/i)?.[1]?.trim();
    const l = seg.replace(/"[^"]*"/g, " ").toLowerCase();
    const explicit = l.match(/(\d+(?:\.\d+)?)\s*(?:s\b|sec)/)?.[1];
    const base = explicit ? +explicit : 0;
    const expr = EXPR.find(([r]) => r.test(l))?.[1];
    const others = findNames(l, who);
    const propHit = findProps(l)[0];

    let look: string | undefined;
    const lm = l.match(/\b(?:look|looks|looking|glance|glances|stare|stares|turn|turns|turning|face|faces|facing)\s+(?:at|to|toward|towards)?\s*(?:the\s+)?([a-z]+)/);
    if (lm && !/^(around|away|back|his|her)$/.test(lm[1])) {
      const w = lm[1];
      if (/^(camera|audience|us|viewer|viewers)$/.test(w)) look = "camera";
      else if (/^(left|right|up|down)$/.test(w)) look = w;
      else if (others.length) look = actors[others[0]].def.name;
      else if (propHit !== undefined && hasName(l, props[propHit].name)) look = props[propHit].name;
    }
    if (!look && others.length && (say || /\b(talk|speak|tell|ask|greet|wave|point|smile|laugh)/.test(l))) look = actors[others[0]].def.name;

    let view: View | undefined;
    if (/turn(s|ing)? around|back to (the )?camera|facing away|faces? away/.test(l)) view = "back";
    else if (/(face|faces|facing|turn(s)? to) (the )?camera|front view/.test(l)) view = "front";
    else if (/profile|sideways|side view/.test(l)) view = "side";

    const nod = /\bnod/.test(l), shake = /shake\w* (his |her |their )?head|disagree/.test(l);
    const exit = EXIT.test(l), enter = ENTER.test(l);
    const run = RUN.test(l);
    const walk = WALK.test(l) || exit || enter;
    const other = CLIPS.find(([r]) => r.test(l))?.[1];
    const parallelWalk = /\bwhile\b|\bas (he|she|they|it)\b|\bwalking\b|\brunning\b/.test(l);
    const talkWord = !!say || /talk|speak|chat|explain|tell/.test(l);
    const gesture: ClipId | undefined = other ?? (talkWord ? "talk" : undefined);
    const sayDur = say ? Math.max(2, say.split(/\s+/).length * 0.42 + 1.0) : 0;

    if (walk) {
      const cur = px[who], tgt = others[0];
      const dirLeft = /\bleft\b/.test(l), dirRight = /\bright\b/.test(l);
      const eSide = l.match(ENTER_SIDE)?.[1], xSide = l.match(EXIT_SIDE)?.[1];
      let tx: number, fromX: number | undefined;
      if (exit) {
        const exitLeft = xSide ? xSide === "left" : enter && eSide ? eSide !== "left" : dirLeft ? true : dirRight ? false : cur < W / 2;
        tx = edge(exitLeft);
        if (enter) fromX = edge(eSide ? eSide === "left" : !exitLeft);
      } else {
        if (tgt !== undefined && /\b(to|toward|towards|near|beside|next to|approach\w*|over)\b/.test(l)) tx = px[tgt] + (cur < px[tgt] ? -150 : 150);
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
      px[who] = tx;
      const mv = { moveTo: tx, fromX, enter: enter || undefined, exit: exit || undefined };

      if (gesture && !parallelWalk) {
        const gd = base || Math.max(sayDur, gesture === "talk" ? 2.5 : 2.2, nod || shake ? 1.3 : 0);
        if (exit && !enter) {
          // say or do the thing first, then leave
          me.actions.push({ t0, t1: t0 + gd, clip: gesture, say, expr, look, view, nod, shake });
          me.actions.push({ t0: t0 + gd, t1: t0 + gd + walkDur, clip: gait, ...mv });
        } else {
          me.actions.push({ t0, t1: t0 + walkDur, clip: gait, expr, look, view, ...mv });
          me.actions.push({ t0: t0 + walkDur, t1: t0 + walkDur + gd, clip: gesture, say, nod, shake });
        }
        return t0 + walkDur + gd;
      }
      const dur = Math.max(walkDur, base, sayDur);
      me.actions.push({ t0, t1: t0 + dur, clip: parallelWalk && other ? other : gait, say, expr, look, view, nod, shake, ...mv });
      return t0 + dur;
    }

    const dur = base || Math.max(sayDur, other ? 2.4 : 0, nod || shake ? 1.3 : 0, 1.5);
    me.actions.push({ t0, t1: t0 + dur, clip: gesture, say, expr, look, view, nod, shake });
    return t0 + dur;
  };

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
  cam.sort((a, b) => a.t - b.t);
  return { duration: Math.max(maxT, beatEnd) + 0.6, actors, props, cam, shots };
}
