"use client";
import { useEffect, useRef } from "react";
import type { MutableRefObject, PointerEvent as RPointerEvent, RefObject } from "react";
import type { Renderer3D, Sel } from "@/lib/render3d";

interface Opts {
  enabled: boolean;
  r3: MutableRefObject<Renderer3D | null>;
  canvas: RefObject<HTMLCanvasElement | null>;
  setSelection: (s: Sel | null) => void;
  getPos: (s: Sel) => { X: number; Z: number; y: number };
  onDrag: (s: Sel, X: number, Z: number) => void;
}

// One finger on an object moves it; one finger on empty space orbits the camera;
// two fingers pinch to zoom and drag to pan. Mouse: wheel zooms, right-drag pans.
export function useEditor(o: Opts) {
  const optsRef = useRef(o);
  optsRef.current = o;
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const mode = useRef<"none" | "orbit" | "drag" | "pinch" | "pan">("none");
  const drag = useRef<{ sel: Sel; ox: number; oz: number; y: number; sx: number; sy: number; moved: boolean } | null>(null);
  const last = useRef({ x: 0, y: 0 });
  const start = useRef({ x: 0, y: 0, far: false });
  const pinch = useRef({ d: 0, mx: 0, my: 0 });

  const norm = (cx: number, cy: number) => {
    const el = optsRef.current.canvas.current;
    if (!el) return { nx: 0, ny: 0 };
    const r = el.getBoundingClientRect();
    return { nx: (cx - r.left) / r.width, ny: (cy - r.top) / r.height };
  };
  const two = () => {
    const a = Array.from(pts.current.values());
    return { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1, mx: (a[0].x + a[1].x) / 2, my: (a[0].y + a[1].y) / 2 };
  };

  useEffect(() => {
    const el = o.canvas.current;
    if (!el || !o.enabled) return;
    const h = (e: WheelEvent) => { e.preventDefault(); optsRef.current.r3.current?.zoom(e.deltaY > 0 ? 1.1 : 0.9); };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, [o.enabled, o.canvas]);

  const onPointerDown = (e: RPointerEvent<HTMLCanvasElement>) => {
    const { enabled, r3, setSelection, getPos } = optsRef.current;
    const r = r3.current;
    if (!enabled || !r) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    last.current = { x: e.clientX, y: e.clientY };
    start.current = { x: e.clientX, y: e.clientY, far: false };
    if (pts.current.size >= 2) { mode.current = "pinch"; drag.current = null; pinch.current = two(); return; }
    if (e.button === 2) { mode.current = "pan"; return; }
    const { nx, ny } = norm(e.clientX, e.clientY);
    const hit = r.pick(nx, ny);
    if (hit) {
      setSelection(hit);
      const pos = getPos(hit), g = r.ground(nx, ny, pos.y);
      drag.current = { sel: hit, ox: g ? pos.X - g.X : 0, oz: g ? pos.Z - g.Z : 0, y: pos.y, sx: e.clientX, sy: e.clientY, moved: false };
      mode.current = "drag";
    } else mode.current = "orbit";
  };

  const onPointerMove = (e: RPointerEvent<HTMLCanvasElement>) => {
    const { enabled, r3, onDrag } = optsRef.current;
    const r = r3.current;
    if (!enabled || !r || mode.current === "none") return;
    if (pts.current.has(e.pointerId)) pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 5) start.current.far = true;

    if (mode.current === "pinch" && pts.current.size >= 2) {
      const n = two();
      r.zoom(pinch.current.d / n.d);
      r.pan(n.mx - pinch.current.mx, n.my - pinch.current.my);
      pinch.current = n;
      return;
    }
    const dx = e.clientX - last.current.x, dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    if (mode.current === "orbit") r.orbit(dx, dy);
    else if (mode.current === "pan") r.pan(dx, dy);
    else if (mode.current === "drag" && drag.current) {
      const d = drag.current;
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return;
      d.moved = true;
      const { nx, ny } = norm(e.clientX, e.clientY);
      const g = r.ground(nx, ny, d.y);
      if (g) onDrag(d.sel, g.X + d.ox, g.Z + d.oz);
    }
  };

  const onPointerUp = (e: RPointerEvent<HTMLCanvasElement>) => {
    pts.current.delete(e.pointerId);
    if (pts.current.size < 2 && mode.current === "pinch") mode.current = "none";
    if (pts.current.size === 0) {
      if (mode.current === "orbit" && !start.current.far) optsRef.current.setSelection(null);   // a tap on empty space deselects
      mode.current = "none"; drag.current = null;
    }
  };

  return {
    handlers: {
      onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp,
      onContextMenu: (e: { preventDefault: () => void }) => { if (optsRef.current.enabled) e.preventDefault(); },
    },
  };
}
