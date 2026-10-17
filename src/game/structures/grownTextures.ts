// ============================================================================
// grownTextures.ts — the procedural "grown, not built" surface kit
// ============================================================================
// The Grown Look pass (Adam, 2026-10-17): every structure in the game was
// flat-color primitives, so grown things read as carpentry. This module is
// the shared fix — procedural canvas textures drawn ONCE and shared by
// every builder, plus a deterministic vertex-jitter helper so no grown
// edge is machine-straight. Reorg home when the taxonomy pins: structures/
// (it is born filed beside structureBuilders, per the layout ruling).
//
// Tileability: every stroke is drawn at all 9 canvas offsets (x-w,0,+w) x
// (y-h,0,+h) so patterns crossing an edge wrap seamlessly; textures use
// RepeatWrapping. Textures are cached per (kind, seed) — one canvas per
// kind ever. Builders may clone() the cached texture to set their own
// repeat; clones share the canvas image and cost nothing.
// ============================================================================

import * as THREE from 'three';
import { mulberry32 } from './lifePulse';

const TEX_SIZE = 256;

const cache = new Map<string, THREE.CanvasTexture>();

function makeCanvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('grownTextures: no 2d canvas context');
  return [canvas, ctx];
}

/** Run a draw callback at all 9 tile offsets so edge-crossing strokes wrap. */
function tiled(draw: (ox: number, oy: number) => void): void {
  for (const ox of [-TEX_SIZE, 0, TEX_SIZE]) {
    for (const oy of [-TEX_SIZE, 0, TEX_SIZE]) {
      draw(ox, oy);
    }
  }
}

function finish(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function cached(kind: string, seed: number, draw: () => THREE.CanvasTexture): THREE.CanvasTexture {
  const key = `${kind}:${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const tex = draw();
  cache.set(key, tex);
  return tex;
}

// -- root grain: branching dark root lines over bark-brown ------------------
// Reads as a root floor, a root table top — anywhere roots run together.
export function rootGrainTexture(seed = 1): THREE.CanvasTexture {
  return cached('rootgrain', seed, () => {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = '#6f4a2c';
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    const rng = mulberry32(seed * 1013 + 7);
    // Fine grain: faint vertical-ish streaks so the ground never reads flat.
    ctx.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      const x = rng() * TEX_SIZE;
      ctx.strokeStyle = `rgba(58, 40, 24, ${0.10 + rng() * 0.12})`;
      ctx.lineWidth = 0.8 + rng() * 1.2;
      tiled((ox, oy) => {
        ctx.beginPath();
        ctx.moveTo(x + ox, -4 + oy);
        ctx.quadraticCurveTo(x + (rng() - 0.5) * 30 + ox, TEX_SIZE / 2 + oy, x + (rng() - 0.5) * 24 + ox, TEX_SIZE + 4 + oy);
        ctx.stroke();
      });
    }
    // Root branches: recursive, dark, tapering, drifting downward-ish.
    const branch = (x: number, y: number, angle: number, width: number, depth: number): void => {
      if (depth <= 0 || width < 0.4) return;
      const len = 26 + rng() * 30;
      const cx = x + Math.cos(angle + 0.5) * len * 0.5;
      const cy = y + Math.sin(angle + 0.5) * len * 0.5;
      const ex = x + Math.cos(angle) * len;
      const ey = y + Math.sin(angle) * len;
      const shade = 26 + depth * 8;
      tiled((ox, oy) => {
        ctx.strokeStyle = `rgb(${shade + 18}, ${shade + 4}, ${shade - 6})`;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x + ox, y + oy);
        ctx.quadraticCurveTo(cx + ox, cy + oy, ex + ox, ey + oy);
        ctx.stroke();
      });
      const kids = depth > 1 ? 2 : 1;
      for (let k = 0; k < kids; k++) {
        branch(ex, ey, angle + (k === 0 ? -1 : 1) * (0.35 + rng() * 0.45), width * 0.62, depth - 1);
      }
    };
    for (let i = 0; i < 7; i++) {
      branch(rng() * TEX_SIZE, -6, Math.PI / 2 + (rng() - 0.5) * 0.9, 3.2, 3);
    }
    return finish(canvas);
  });
}

// -- bark: vertical fibrous streaks with a few knots ------------------------
// The grown world's "lumber" — frames, posts, the pod collar's cousins.
export function barkTexture(seed = 2): THREE.CanvasTexture {
  return cached('bark', seed, () => {
    const [canvas, ctx] = makeCanvas();
    ctx.fillStyle = '#5d4028';
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    const rng = mulberry32(seed * 1013 + 7);
    const tones = ['#4a3220', '#6b4c30', '#3a2818', '#755636'];
    ctx.lineCap = 'round';
    for (let i = 0; i < 130; i++) {
      const x = rng() * TEX_SIZE;
      ctx.strokeStyle = tones[Math.floor(rng() * tones.length)];
      ctx.globalAlpha = 0.35 + rng() * 0.4;
      ctx.lineWidth = 0.8 + rng() * 2.4;
      tiled((ox, oy) => {
        ctx.beginPath();
        ctx.moveTo(x + ox, -6 + oy);
        ctx.bezierCurveTo(
          x + (rng() - 0.5) * 26 + ox, TEX_SIZE * 0.33 + oy,
          x + (rng() - 0.5) * 26 + ox, TEX_SIZE * 0.66 + oy,
          x + (rng() - 0.5) * 18 + ox, TEX_SIZE + 6 + oy,
        );
        ctx.stroke();
      });
    }
    ctx.globalAlpha = 1;
    // Knots: dark ellipses with a lighter rim — where branches left.
    for (let i = 0; i < 3; i++) {
      const x = 30 + rng() * (TEX_SIZE - 60);
      const y = 30 + rng() * (TEX_SIZE - 60);
      const r = 5 + rng() * 7;
      tiled((ox, oy) => {
        ctx.strokeStyle = 'rgba(150, 108, 66, 0.55)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(x + ox, y + oy, r + 2, r * 1.5 + 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(38, 24, 14, 0.85)';
        ctx.beginPath();
        ctx.ellipse(x + ox, y + oy, r, r * 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    return finish(canvas);
  });
}

// -- woven fiber: an over-under checker in fiber tones ----------------------
// The rug's whole identity; warp and weft alternate row by row.
export function wovenTexture(seed = 3): THREE.CanvasTexture {
  return cached('woven', seed, () => {
    const [canvas, ctx] = makeCanvas();
    const cell = TEX_SIZE / 8; // integer cells — seamless by construction
    const rng = mulberry32(seed * 1013 + 7);
    const toneA = '#97783f';
    const toneB = '#7a5f2e';
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const over = (i + j) % 2 === 0;
        ctx.fillStyle = over ? toneA : toneB;
        ctx.fillRect(i * cell, j * cell, cell, cell);
        // Thread direction follows the weave row (warp rows horizontal,
        // weft rows vertical), with slight seeded wobble.
        ctx.strokeStyle = 'rgba(60, 44, 22, 0.5)';
        ctx.lineWidth = 1;
        for (let t = 1; t < 4; t++) {
          const off = (t / 4) * cell + (rng() - 0.5) * 2;
          ctx.beginPath();
          if (i % 2 === 0) {
            ctx.moveTo(i * cell + off, j * cell);
            ctx.lineTo(i * cell + off, (j + 1) * cell);
          } else {
            ctx.moveTo(i * cell, j * cell + off);
            ctx.lineTo((i + 1) * cell, j * cell + off);
          }
          ctx.stroke();
        }
        // Over cells catch the light; under cells sink — one pass each.
        if (over) {
          ctx.fillStyle = 'rgba(255, 240, 200, 0.14)';
          ctx.fillRect(i * cell, j * cell, cell, 3);
          ctx.fillStyle = 'rgba(40, 28, 12, 0.28)';
          ctx.fillRect(i * cell, (j + 1) * cell - 3, cell, 3);
        } else {
          ctx.fillStyle = 'rgba(40, 28, 12, 0.30)';
          ctx.fillRect(i * cell, j * cell, cell, cell);
        }
      }
    }
    return finish(canvas);
  });
}

// -- vertex jitter: no grown edge is machine-straight ------------------------
// Displaces each vertex by a seeded offset keyed on its POSITION (not its
// index), so duplicated vertices on box seams move together and no cracks
// open. Amount is in world units — 0.01 is a whisper, 0.05 a shout.
export function jitterVertices(geom: THREE.BufferGeometry, amount: number, seed: number): void {
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // Key on rounded position so seam-duplicated vertices share one offset.
    const h = Math.abs(
      Math.sin(v.x * 127.1 + v.y * 311.7 + v.z * 74.7 + seed * 17.3) * 43758.5453,
    );
    const frac = h - Math.floor(h);
    const h2 = Math.abs(Math.sin(v.y * 269.5 + v.z * 183.3 + v.x * 61.9 + seed * 5.1) * 28001.8384);
    const frac2 = h2 - Math.floor(h2);
    const h3 = Math.abs(Math.sin(v.z * 113.5 + v.x * 271.9 + v.y * 91.3 + seed * 9.7) * 19753.5453);
    const frac3 = h3 - Math.floor(h3);
    pos.setXYZ(
      i,
      v.x + (frac - 0.5) * amount,
      v.y + (frac2 - 0.5) * amount,
      v.z + (frac3 - 0.5) * amount,
    );
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
}
