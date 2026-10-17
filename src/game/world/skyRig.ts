/**
 * The SKY RIG (day/night build, Adam, 2026-10-16) — the visible
 * heavens of BioForge: a BINARY SUN crossing the day, a huge
 * RINGED PLANET riding the night, and a seeded star shell.
 *
 * Adam's spec: "Binary sun, ten minutes per planet rotation,
 * stars and a huge moon at night" — refined mid-build by Adam:
 * not a moon, a huge RINGED PLANET like Saturn. Its pale shine
 * is the night's light.
 *
 * The cycle PHASE itself lives outside this file: App state
 * (dayNightCycle) is host-advanced at exactly 1/600 per second,
 * saved and synced; the engine's setDayNightTime stores the
 * phase and paints palettes from it, and calls this rig's
 * update() per frame to place the bodies. Convention
 * (load-bearing, shared with the HUD and the variant effects):
 * 0.25 = sunrise, 0.5 = noon, 0.75 = sunset, 0 = midnight.
 *
 * WHY A MODULE: threeEngine.ts sits within a few KB of the
 * single-file push ceiling (the water section already moved to
 * waterField.ts for the same reason). The sky is a
 * self-contained rig — it reads the phase and the camera, and
 * moves the engine's primary light — so it lives here.
 */

import * as THREE from 'three';
import { skyRosterNow, nightSkyAt, type MeteorSpec } from './skyCalendar';

// ---------------------------------------------------------------------------
// Procedural sky textures (planet upgrade, Adam, 2026-10-16)
// ---------------------------------------------------------------------------
// The giant's face, its rings, and its moons are all PAINTED at
// runtime on canvases — no image assets anywhere in the project,
// and a canvas texture costs one draw at startup. Each painter
// uses its own seeded LCG so every client paints the identical
// sky (the same trick the star shell below already uses).

/** A tiny seeded random stream (deterministic on every client). */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * Limb shading: a radial wash that darkens toward the disc's rim
 * (and lightens a touch off-center toward the light), which is
 * what makes a flat billboarded disc read as a SPHERE. Shared by
 * the giant and its moons.
 */
function paintLimb(ctx: CanvasRenderingContext2D, size: number, lightX = 0.38, lightY = 0.34): void {
  const r = size / 2;
  const glow = ctx.createRadialGradient(size * lightX, size * lightY, r * 0.1, r, r, r * 1.05);
  glow.addColorStop(0, 'rgba(255,255,255,0.10)');
  glow.addColorStop(0.55, 'rgba(255,255,255,0)');
  glow.addColorStop(0.88, 'rgba(8,12,24,0.12)');
  glow.addColorStop(1, 'rgba(8,12,24,0.42)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
}

/**
 * The ringed giant's face: horizontal cloud bands in a pale,
 * pretty palette (pearl, cream, apricot, dusty rose, slate),
 * their edges wobbled by layered sine turbulence so nothing
 * looks ruled; one great storm oval; a fine grain over all.
 */
function makeGasGiantTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rnd = seededRandom(20261016);
  // The band stack: [startY (0..1), color] — painted as wavy
  // horizontal strips, each strip's top edge displaced by sines.
  const bands: [number, string][] = [
    [0.0, '#aebdcf'],
    [0.08, '#cfdcec'],
    [0.16, '#eee3c8'],
    [0.26, '#e6bd93'],
    [0.34, '#f0e7d3'],
    [0.43, '#dfa49b'],
    [0.5, '#f4ead6'],
    [0.58, '#c8d4e6'],
    [0.67, '#e9cfa4'],
    [0.75, '#e3b18f'],
    [0.83, '#d8e2ee'],
    [0.92, '#aebdcf'],
  ];
  for (let i = 0; i < bands.length; i++) {
    const [y0, color] = bands[i];
    const y1 = i + 1 < bands.length ? bands[i + 1][0] : 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, size);
    for (let x = 0; x <= size; x += 8) {
      // Turbulent top edge: three sine octaves, phases per band.
      const wob =
        Math.sin(x * 0.021 + i * 1.7) * 5 +
        Math.sin(x * 0.052 + i * 4.1) * 2.6 +
        Math.sin(x * 0.13 + i * 9.3) * 1.1;
      ctx.lineTo(x, y0 * size + wob);
    }
    for (let x = size; x >= 0; x -= 8) ctx.lineTo(x, y1 * size + 6);
    ctx.closePath();
    ctx.fill();
  }
  // Soft churn: translucent ellipses smeared along the bands.
  for (let i = 0; i < 260; i++) {
    const y = rnd() * size;
    const x = rnd() * size;
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(70,80,110,0.045)';
    ctx.beginPath();
    ctx.ellipse(x, y, 14 + rnd() * 42, 2 + rnd() * 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // The great storm: a rust-red oval with a cream rim, trailing
  // a pale wake — the giant's one famous feature.
  const storm = (cx: number, cy: number, rx: number, ry: number) => {
    ctx.fillStyle = 'rgba(244,234,214,0.85)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 1.25, ry * 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d96f43';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#eda26f';
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.18, cy - ry * 0.15, rx * 0.55, ry * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  storm(size * 0.63, size * 0.6, size * 0.085, size * 0.045);
  storm(size * 0.3, size * 0.3, size * 0.04, size * 0.022);
  // Fine grain over everything, so the face never looks airbrushed.
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(40,50,80,0.05)';
    ctx.fillRect(rnd() * size, rnd() * size, 1.6, 1.6);
  }
  paintLimb(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * The rings: drawn as concentric stripes on a square canvas —
 * RingGeometry's UVs map its bounding square onto the texture,
 * so canvas circles land exactly on the geometry's rings. Warm
 * ice tones, several bright/dim bands, and one clean dark gap
 * (the Cassini move) a little past halfway out.
 */
function makeRingTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rnd = seededRandom(77003);
  const c = size / 2;
  // The geometry spans radii 40..62 of a 124-wide square, i.e.
  // canvas radii 165..256. Paint many thin rings with wandering
  // brightness and alpha; outside the span stays transparent.
  for (let r = 166; r < 256; r += 2) {
    const t = (r - 166) / 90;
    const gap = t > 0.52 && t < 0.6; // the dark division
    const bright = 0.72 + Math.sin(t * 40) * 0.14 + (rnd() - 0.5) * 0.16;
    const alpha = gap ? 0.05 : 0.34 + Math.sin(t * 22 + 1) * 0.16 + rnd() * 0.14;
    ctx.strokeStyle = `rgba(${Math.round(232 * bright + 20)}, ${Math.round(220 * bright + 14)}, ${Math.round(192 * bright)}, ${alpha.toFixed(3)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * A moon's face: a tinted rocky body — mottled patches plus
 * crater speckle (dark pit, lit rim) — limb-shaded like the
 * giant. Each moon gets its own palette and seed.
 */
function makeMoonTexture(base: string, patch: string, seed: number): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rnd = seededRandom(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 46; i++) {
    ctx.fillStyle = patch;
    ctx.globalAlpha = 0.1 + rnd() * 0.16;
    ctx.beginPath();
    ctx.ellipse(rnd() * size, rnd() * size, 6 + rnd() * 20, 4 + rnd() * 12, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 52; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 1 + rnd() * 3.6;
    ctx.fillStyle = 'rgba(20,22,30,0.35)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(x, y, r, Math.PI * 1.05, Math.PI * 1.55);
    ctx.stroke();
  }
  paintLimb(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * A nebula: overlapping radial-gradient clouds in one hue
 * family, composited additively at render time. The canvas
 * itself is soft blobs with feathered edges and a few darker
 * dust lanes cut across — pretty at very low opacity, which is
 * how the dome wears them.
 */
function makeNebulaTexture(seed: number, hues: number[]): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rnd = seededRandom(seed);
  for (let i = 0; i < 9; i++) {
    const x = size * (0.3 + rnd() * 0.4);
    const y = size * (0.3 + rnd() * 0.4);
    const r = size * (0.14 + rnd() * 0.24);
    const hue = hues[i % hues.length];
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `hsla(${hue}, 85%, 68%, ${0.16 + rnd() * 0.14})`);
    g.addColorStop(0.6, `hsla(${hue}, 80%, 55%, ${0.07 + rnd() * 0.06})`);
    g.addColorStop(1, `hsla(${hue}, 80%, 50%, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  // Dust lanes: a couple of dark soft strokes across the glow.
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 3; i++) {
    const y = size * (0.32 + rnd() * 0.36);
    const g = ctx.createLinearGradient(0, y - 12, 0, y + 12);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, `rgba(0,0,0,${0.25 + rnd() * 0.2})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 12, size, 24);
  }
  ctx.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * A galaxy: a bright core and two spiral arms of star-dots on a
 * logarithmic spiral, drawn once and worn tilted and squashed,
 * so it reads as a little pinwheel of somebody else's sky.
 */
function makeGalaxyTexture(seed: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rnd = seededRandom(seed);
  const c = size / 2;
  const core = ctx.createRadialGradient(c, c, 0, c, c, size * 0.2);
  core.addColorStop(0, 'rgba(255,246,224,0.9)');
  core.addColorStop(0.4, 'rgba(240,220,180,0.35)');
  core.addColorStop(1, 'rgba(240,220,180,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);
  for (let arm = 0; arm < 2; arm++) {
    for (let i = 0; i < 340; i++) {
      const t = rnd();
      const ang = arm * Math.PI + t * 3.6 + (rnd() - 0.5) * 0.35;
      const r = 6 + t * (size * 0.44);
      const x = c + Math.cos(ang) * r + (rnd() - 0.5) * 7;
      const y = c + Math.sin(ang) * r + (rnd() - 0.5) * 7;
      const a = (1 - t) * (0.25 + rnd() * 0.5);
      ctx.fillStyle = rnd() > 0.82 ? `rgba(170,196,255,${a})` : `rgba(255,244,220,${a})`;
      ctx.fillRect(x, y, 1.6, 1.6);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * A comet: one canvas carrying the whole apparition — bright
 * head at the right, a long tapering tail streaming left with a
 * slight wave, drawn additively. The mesh rotates in its plane
 * so the tail trails the direction of travel.
 */
function makeCometTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  // Tail: layered translucent wedges, longest and faintest first.
  for (const [len, alpha, spread] of [[235, 0.1, 13], [185, 0.16, 9], [130, 0.24, 5.5]] as const) {
    const g = ctx.createLinearGradient(232, 0, 232 - len, 0);
    g.addColorStop(0, `rgba(190,220,255,${alpha})`);
    g.addColorStop(1, 'rgba(190,220,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(232, h / 2 - 1.5);
    ctx.lineTo(232 - len, h / 2 - spread);
    ctx.lineTo(232 - len, h / 2 + spread);
    ctx.lineTo(232, h / 2 + 1.5);
    ctx.closePath();
    ctx.fill();
  }
  // Head: glow + core.
  const glow = ctx.createRadialGradient(228, h / 2, 0, 228, h / 2, 17);
  glow.addColorStop(0, 'rgba(255,255,255,0.95)');
  glow.addColorStop(0.35, 'rgba(210,230,255,0.5)');
  glow.addColorStop(1, 'rgba(210,230,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(200, 0, 56, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * A meteor: a shorter, thinner streak than a comet — the
 * same construction (bright head right, tapering tail
 * left, additive), drawn slimmer so a lone shooting star
 * reads as a scratch of light, not an apparition.
 */
function makeMeteorTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 32;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  for (const [len, alpha, spread] of [[240, 0.12, 5], [180, 0.22, 3], [110, 0.34, 1.6]] as const) {
    const g = ctx.createLinearGradient(238, 0, 238 - len, 0);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(238, h / 2 - 0.8);
    ctx.lineTo(238 - len, h / 2 - spread);
    ctx.lineTo(238 - len, h / 2 + spread);
    ctx.lineTo(238, h / 2 + 0.8);
    ctx.closePath();
    ctx.fill();
  }
  const glow = ctx.createRadialGradient(234, h / 2, 0, 234, h / 2, 11);
  glow.addColorStop(0, 'rgba(255,255,255,0.95)');
  glow.addColorStop(0.4, 'rgba(230,240,255,0.45)');
  glow.addColorStop(1, 'rgba(230,240,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(212, 0, 44, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class SkyRig {
  /** The companion sun's light (no shadows; the primary keeps them). */
  public sunLightB: THREE.DirectionalLight;
  /** Star material, exposed so the engine's palette pass can fade it. */
  public starMaterial: THREE.PointsMaterial;

  private skyGroup: THREE.Group = new THREE.Group();
  private sunMeshA: THREE.Mesh;
  private sunMeshB: THREE.Mesh;
  private sunGlowA: THREE.Mesh;
  private sunGlowB: THREE.Mesh;
  private planetGroup: THREE.Group;
  /** The giant's moons (planet upgrade, 2026-10-16): each rides
   *  an inclined orbit around the planet, its angle a pure
   *  function of the shared cycle phase — so the moons wheel at
   *  whole numbers of orbits per planet rotation and every
   *  client (host and guests alike) sees the same sky. */
  private moons: { mesh: THREE.Mesh; orbitR: number; orbitsPerCycle: number; phase: number; squash: number; depth: number }[] = [];
  /** The night dome (2026-10-16 sky rebuild): field stars,
   *  constellations, nebulae, and galaxies all live in this one
   *  group so the whole firmament wheels together. */
  private starDome: THREE.Group = new THREE.Group();
  /** Night materials that fade WITH the engine-driven star
   *  signal: the engine's palette pass owns starMaterial's
   *  opacity; update() reads it and scales each entry by its max. */
  private nightMats: { mat: THREE.Material; max: number }[] = [];
  /** Comets (2026-10-16): each crosses the night on its own
   *  fixed arc during its window of the planet's transit. */
  private comets: { group: THREE.Group; plane: THREE.Mesh; mat: THREE.MeshBasicMaterial; from: THREE.Vector3; to: THREE.Vector3; start: number; span: number }[] = [];
  /** Meteors (Shelf 1, 2026-10-17): a small pool of streak
   *  planes flown from the sky calendar's nightly list —
   *  baseline shooting stars plus the shower nights. The
   *  list LATCHES when the night band is entered and holds
   *  until dawn, so a wall-clock day rolling over mid-night
   *  never swaps tonight's sky under the player. */
  private meteorPool: { group: THREE.Group; plane: THREE.Mesh; mat: THREE.MeshBasicMaterial; from: THREE.Vector3; to: THREE.Vector3; bornAt: number; lifeMs: number; active: boolean }[] = [];
  private meteorNight: { at: number; spec: MeteorSpec }[] = [];
  private meteorFired: Set<number> = new Set();
  private meteorLatched = false;
  private prevCycle = -1;
  private dirLight: THREE.DirectionalLight;

  constructor(scene: THREE.Scene, dirLight: THREE.DirectionalLight) {
    this.dirLight = dirLight;
    const disc = (radius: number, color: number, opacity: number) => {
      const m = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 40),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity,
          fog: false,
          depthWrite: false,
        }),
      );
      m.renderOrder = -10;
      return m;
    };
    // The binary: a large warm primary and its smaller companion.
    // The binary, re-cast (Adam, 2026-10-16): the primary is a
    // RED GIANT now — much larger than the old warm sun — and its
    // companion a smaller blue-white star. They no longer cross
    // as a fixed pair: update() wheels them around their shared
    // barycenter as the pair rides the day path.
    this.sunGlowA = disc(36, 0xff5a2a, 0.3);
    this.sunMeshA = disc(17, 0xff7a40, 1);
    this.sunGlowB = disc(11, 0xaac4ff, 0.22);
    this.sunMeshB = disc(5, 0xdceaff, 1);
    // The ringed giant (ENLARGED, planet upgrade, Adam,
    // 2026-10-16): once a 12-radius disc (~8 degrees of sky), now
    // a 32-radius face with rings out to 62 — over 20 degrees,
    // genuinely humongous against the suns' 7. The flat band and
    // core discs are gone: a procedural canvas paints the bands,
    // the storm, and the limb shading now, and the rings carry a
    // striped canvas of their own. A faint halo behind it all
    // sells the shine that lights the night.
    this.planetGroup = new THREE.Group();
    const planetGlow = disc(38, 0xcfe0f5, 0.13);
    planetGlow.position.z = -0.05;
    const planetFace = new THREE.Mesh(
      new THREE.CircleGeometry(32, 64),
      new THREE.MeshBasicMaterial({
        map: makeGasGiantTexture(),
        transparent: true,
        opacity: 1,
        fog: false,
        depthWrite: false,
      }),
    );
    planetFace.renderOrder = -10;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(40, 62, 96),
      new THREE.MeshBasicMaterial({
        map: makeRingTexture(),
        transparent: true,
        opacity: 0.95,
        fog: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = Math.PI / 2.35;
    ring.position.z = -0.01;
    ring.renderOrder = -10;
    this.planetGroup.add(planetGlow);
    this.planetGroup.add(planetFace);
    this.planetGroup.add(ring);
    // The moons: three little worlds on inclined orbits — one
    // inside the rings, one threading them, one well outside.
    // Inclinations squash the orbit's local Y so the wheel reads
    // tilted; the local Z swings each moon in front of the giant
    // and behind it (the transparent draw sorts by distance, so
    // occlusion comes out right on its own).
    const moonDefs: {
      radius: number; orbitR: number; orbitsPerCycle: number; phase: number;
      base: string; patch: string; seed: number; squash: number; depth: number;
    }[] = [
      { radius: 3.1, orbitR: 41, orbitsPerCycle: 5, phase: 0.12, base: '#b9c2cc', patch: '#7e8894', seed: 4401, squash: 0.42, depth: 9 },
      { radius: 4.4, orbitR: 56, orbitsPerCycle: 3, phase: 0.55, base: '#d8c9a8', patch: '#a8895c', seed: 4402, squash: 0.36, depth: 12 },
      { radius: 2.6, orbitR: 76, orbitsPerCycle: 2, phase: 0.83, base: '#cfe0e8', patch: '#8fb2c4', seed: 4403, squash: 0.5, depth: 14 },
    ];
    for (const def of moonDefs) {
      const mesh = new THREE.Mesh(
        new THREE.CircleGeometry(def.radius, 40),
        new THREE.MeshBasicMaterial({
          map: makeMoonTexture(def.base, def.patch, def.seed),
          transparent: true,
          opacity: 1,
          fog: false,
          depthWrite: false,
        }),
      );
      mesh.renderOrder = -10;
      this.moons.push({ mesh, orbitR: def.orbitR, orbitsPerCycle: def.orbitsPerCycle, phase: def.phase, squash: def.squash, depth: def.depth });
      this.planetGroup.add(mesh);
    }
    // -- The night dome (rebuilt, Adam, 2026-10-16) --------------
    // The old sky scattered 700 identical stars uniformly. This
    // one is built the way our own sky is built: a galactic BAND
    // the field crowds toward, a magnitude law (a few bright,
    // many dim — brightness rides vertex colors, size rides three
    // layers), twelve seeded CONSTELLATIONS with faint joins,
    // nebulae, and galaxies. Everything is seeded, so every
    // client under this sky sees the same firmament, and the
    // whole dome wheels slowly with the cycle as one body.
    const dome = this.starDome;
    const srnd = seededRandom(987123);
    const SHELL = 178;
    const dirFromAzEl = (az: number, el: number, r: number): THREE.Vector3 =>
      new THREE.Vector3(Math.cos(az) * Math.cos(el) * r, Math.sin(el) * r, Math.sin(az) * Math.cos(el) * r);
    // Field directions: ~55% crowd toward the galactic band (a
    // great circle whose normal is tilted), the rest go anywhere
    // in the upper dome — the repeatable "noise" Adam asked for
    // is this seeded stream plus the band geometry.
    const bandNormal = new THREE.Vector3(0.42, 1, 0.3).normalize();
    const bandU = new THREE.Vector3().crossVectors(bandNormal, new THREE.Vector3(0, 0, 1)).normalize();
    const bandV = new THREE.Vector3().crossVectors(bandNormal, bandU).normalize();
    const fieldDir = (): THREE.Vector3 => {
      if (srnd() < 0.55) {
        const a = srnd() * Math.PI * 2;
        const off = ((srnd() + srnd() + srnd()) / 1.5 - 1) * 0.21; // ~gaussian, ±12°
        const d = bandU.clone().multiplyScalar(Math.cos(a)).addScaledVector(bandV, Math.sin(a)).addScaledVector(bandNormal, off).normalize();
        if (d.y < 0.03) d.y = 0.03 + srnd() * 0.1;
        return d.normalize();
      }
      return dirFromAzEl(srnd() * Math.PI * 2, Math.asin(srnd() * 0.98 + 0.01), 1);
    };
    // The field: 950 stars under the magnitude law, dealt into
    // three size layers (dim 1.3 / mid 1.9 / bright 2.7 px).
    const buckets: { size: number; pos: number[]; col: number[] }[] = [
      { size: 1.3, pos: [], col: [] },
      { size: 1.9, pos: [], col: [] },
      { size: 2.7, pos: [], col: [] },
    ];
    for (let i = 0; i < 950; i++) {
      const d = fieldDir();
      const bright = 0.22 + 0.78 * Math.pow(srnd(), 3);
      const bucket = buckets[bright > 0.72 ? 2 : bright > 0.45 ? 1 : 0];
      bucket.pos.push(d.x * SHELL, d.y * SHELL, d.z * SHELL);
      const tint = srnd();
      const tr = tint > 0.85 ? 1 : tint > 0.7 ? 0.82 : 0.95;
      const tb = tint > 0.85 ? 0.78 : tint > 0.7 ? 1 : 0.95;
      bucket.col.push(bright * tr, bright * 0.93, bright * tb);
    }
    const layerMats = buckets.map((bucket) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(bucket.pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(bucket.col, 3));
      const mat = new THREE.PointsMaterial({
        size: bucket.size,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: 0,
        fog: false,
        depthWrite: false,
      });
      const points = new THREE.Points(geo, mat);
      points.renderOrder = -11;
      dome.add(points);
      return mat;
    });
    // The engine's palette pass drives the MID layer directly
    // (it is starMaterial); the dim and bright layers follow
    // through nightMats in update().
    this.starMaterial = layerMats[1];
    this.nightMats.push({ mat: layerMats[0], max: 0.72 });
    this.nightMats.push({ mat: layerMats[2], max: 0.95 });
    // Constellations: twelve seeded random-walk chains. Each is
    // a little figure a player can find again tomorrow night —
    // bright stars, with the joins drawn hair-faint.
    const cPos: number[] = [];
    const cCol: number[] = [];
    const linePos: number[] = [];
    for (let c = 0; c < 12; c++) {
      const center = dirFromAzEl((c / 12) * Math.PI * 2 + srnd() * 0.7, 0.35 + srnd() * 0.75, 1);
      const u = new THREE.Vector3().crossVectors(center, new THREE.Vector3(0, 1, 0)).normalize();
      const v = new THREE.Vector3().crossVectors(center, u).normalize();
      let p = center.clone();
      let heading = srnd() * Math.PI * 2;
      const steps = 4 + Math.floor(srnd() * 4);
      let prev: THREE.Vector3 | null = null;
      for (let sIdx = 0; sIdx <= steps; sIdx++) {
        const pt = p.clone().multiplyScalar(SHELL);
        cPos.push(pt.x, pt.y, pt.z);
        const b = 0.85 + srnd() * 0.15;
        cCol.push(b, b * 0.95, b);
        if (prev) linePos.push(prev.x, prev.y, prev.z, pt.x, pt.y, pt.z);
        prev = pt;
        heading += (srnd() - 0.5) * 0.95;
        const step = 0.055 + srnd() * 0.05;
        p = p.addScaledVector(u, Math.cos(heading) * step).addScaledVector(v, Math.sin(heading) * step).normalize();
      }
    }
    const cGeo = new THREE.BufferGeometry();
    cGeo.setAttribute('position', new THREE.Float32BufferAttribute(cPos, 3));
    cGeo.setAttribute('color', new THREE.Float32BufferAttribute(cCol, 3));
    const cMat = new THREE.PointsMaterial({
      size: 3.0,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      fog: false,
      depthWrite: false,
    });
    const cPoints = new THREE.Points(cGeo, cMat);
    cPoints.renderOrder = -11;
    dome.add(cPoints);
    this.nightMats.push({ mat: cMat, max: 0.95 });
    const lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
    const lMat = new THREE.LineBasicMaterial({
      color: 0x87a6d8,
      transparent: true,
      opacity: 0,
      fog: false,
      depthWrite: false,
    });
    const cLines = new THREE.LineSegments(lGeo, lMat);
    cLines.renderOrder = -11;
    dome.add(cLines);
    this.nightMats.push({ mat: lMat, max: 0.14 });
    // Nebulae: five soft clouds in their own hue families,
    // worn additively and dim — color you notice after a moment,
    // not signage.
    const nebulaDefs: { az: number; el: number; r: number; hues: number[]; seed: number; max: number }[] = [
      { az: 0.9, el: 0.62, r: 30, hues: [268, 288, 318], seed: 5101, max: 0.8 },
      { az: 2.5, el: 0.95, r: 23, hues: [174, 196, 160], seed: 5102, max: 0.65 },
      { az: 3.9, el: 0.5, r: 35, hues: [330, 288, 24], seed: 5103, max: 0.75 },
      { az: 5.1, el: 1.05, r: 20, hues: [214, 250, 190], seed: 5104, max: 0.6 },
      { az: 5.9, el: 0.72, r: 26, hues: [288, 330, 200], seed: 5105, max: 0.7 },
    ];
    for (const def of nebulaDefs) {
      const mat = new THREE.MeshBasicMaterial({
        map: makeNebulaTexture(def.seed, def.hues),
        transparent: true,
        opacity: 0,
        fog: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(def.r, 40), mat);
      mesh.position.copy(dirFromAzEl(def.az, def.el, SHELL - 8));
      mesh.lookAt(0, 0, 0);
      mesh.renderOrder = -12;
      dome.add(mesh);
      this.nightMats.push({ mat, max: def.max });
    }
    // Galaxies: three little pinwheels, tilted and squashed.
    const galaxyDefs: { az: number; el: number; r: number; tilt: number; seed: number }[] = [
      { az: 1.8, el: 0.85, r: 10.5, tilt: 0.7, seed: 6101 },
      { az: 4.4, el: 0.66, r: 8, tilt: 2.2, seed: 6102 },
      { az: 5.6, el: 1.15, r: 6.5, tilt: 1.4, seed: 6103 },
    ];
    for (const def of galaxyDefs) {
      const mat = new THREE.MeshBasicMaterial({
        map: makeGalaxyTexture(def.seed),
        transparent: true,
        opacity: 0,
        fog: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(def.r, 40), mat);
      mesh.position.copy(dirFromAzEl(def.az, def.el, SHELL - 6));
      mesh.lookAt(0, 0, 0);
      mesh.rotateZ(def.tilt);
      mesh.scale.set(1, 0.48, 1);
      mesh.renderOrder = -12;
      dome.add(mesh);
      this.nightMats.push({ mat, max: 0.85 });
    }
    this.skyGroup.add(dome);
    // Comets: two apparitions a night (built here, flown in
    // update). Each rides the skyGroup, NOT the dome — their
    // arcs are their own, not the firmament's wheel.
    const cometDefs: { from: THREE.Vector3; to: THREE.Vector3; start: number; span: number }[] = [
      { from: dirFromAzEl(0.6, 0.95, 172), to: dirFromAzEl(2.5, 0.32, 172), start: 0.08, span: 0.72 },
      { from: dirFromAzEl(3.7, 1.08, 172), to: dirFromAzEl(5.4, 0.48, 172), start: 0.34, span: 0.6 },
    ];
    for (const def of cometDefs) {
      const mat = new THREE.MeshBasicMaterial({
        map: makeCometTexture(),
        transparent: true,
        opacity: 0,
        fog: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(36, 9), mat);
      plane.renderOrder = -10;
      const group = new THREE.Group();
      group.add(plane);
      group.visible = false;
      this.skyGroup.add(group);
      this.comets.push({ group, plane, mat, from: def.from, to: def.to, start: def.start, span: def.span });
    }
    // Meteor pool (Shelf 1): two dozen streak planes, built
    // once, hidden until the calendar deals them a flight.
    // Same construction as the comets — billboarded group,
    // additive plane, roll set from the velocity in flight.
    for (let i = 0; i < 24; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: makeMeteorTexture(),
        transparent: true,
        opacity: 0,
        fog: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      plane.renderOrder = -10;
      const group = new THREE.Group();
      group.add(plane);
      group.visible = false;
      this.skyGroup.add(group);
      this.meteorPool.push({
        group,
        plane,
        mat,
        from: new THREE.Vector3(),
        to: new THREE.Vector3(),
        bornAt: 0,
        lifeMs: 1,
        active: false,
      });
    }
    // The companion sun gets its own light; both lights aim
    // through the primary's target, which rides the camera (added
    // to the scene here so its matrix updates).
    this.sunLightB = new THREE.DirectionalLight(0xffd9a0, 0);
    scene.add(this.sunLightB);
    scene.add(dirLight.target);
    this.skyGroup.add(this.sunGlowA);
    this.skyGroup.add(this.sunMeshA);
    this.skyGroup.add(this.sunGlowB);
    this.skyGroup.add(this.sunMeshB);
    this.skyGroup.add(this.planetGroup);
    scene.add(this.skyGroup);
  }

  /**
   * Per-frame placement: the dome follows the camera so it is
   * never approached; the suns cross the day band as a pair (B
   * trailing A), the ringed giant crosses the night band on the
   * mirrored path, and the lights ride their bodies. At night
   * the primary light repositions to the giant — planetshine.
   * Underground (cavern/ruin), the sky simply isn't.
   */
  public update(cycle: number, camPos: THREE.Vector3, underground: boolean): void {
    this.skyGroup.visible = !underground;
    if (underground) return;
    this.skyGroup.position.copy(camPos);
    // Signed sun elevation over the whole cycle: +1 at noon, -1
    // at midnight, zero at both horizons.
    const sunSigned = Math.sin((Math.PI * (cycle - 0.25)) / 0.5);
    const dayT = (cycle - 0.25) / 0.5;
    const pathDir = (t: number) => {
      const el = Math.sin(Math.PI * t);
      const az = Math.PI * (1 - t);
      return new THREE.Vector3(Math.cos(az) * 0.92, el, 0.38).normalize();
    };
    const R = 165;
    // The binary in MUTUAL ORBIT (Adam, 2026-10-16): the pair's
    // barycenter rides the day path as before, and the two stars
    // wheel around it — one full revolution per planet rotation
    // (600 s), slow enough to feel stately, fast enough that the
    // giant and its companion have visibly swapped sides between
    // sunrise and sunset. The heavier red giant hugs the center
    // (7.5 units); the lighter companion swings wider (13). The
    // orbit is inclined (vertical squash 0.7) so the wheel reads
    // as a wheel, not a seesaw. Angles derive from the shared
    // cycle, so every client sees the same configuration.
    const inDayBand = dayT >= -0.04 && dayT <= 1.04;
    const bary = pathDir(THREE.MathUtils.clamp(dayT, 0, 1));
    const side = new THREE.Vector3().crossVectors(bary, new THREE.Vector3(0, 1, 0)).normalize();
    const upv = new THREE.Vector3().crossVectors(side, bary).normalize();
    const orbA = Math.PI * 2 * (cycle + 0.13);
    const off = side
      .multiplyScalar(Math.cos(orbA))
      .addScaledVector(upv, Math.sin(orbA) * 0.7);
    const dirA = bary.clone().multiplyScalar(R).addScaledVector(off, 7.5).normalize();
    const dirB = bary.clone().multiplyScalar(R).addScaledVector(off, -13).normalize();
    this.sunMeshA.visible = inDayBand;
    this.sunGlowA.visible = inDayBand;
    this.sunMeshB.visible = inDayBand;
    this.sunGlowB.visible = inDayBand;
    this.sunMeshA.position.copy(dirA).multiplyScalar(R);
    this.sunGlowA.position.copy(dirA).multiplyScalar(R + 1);
    this.sunMeshB.position.copy(dirB).multiplyScalar(R);
    this.sunGlowB.position.copy(dirB).multiplyScalar(R + 1);
    this.sunMeshA.lookAt(camPos);
    this.sunGlowA.lookAt(camPos);
    this.sunMeshB.lookAt(camPos);
    this.sunGlowB.lookAt(camPos);
    // The giant: rises as the suns set, on the mirrored path.
    const planetT =
      cycle >= 0.75 ? (cycle - 0.75) / 0.5 : cycle < 0.25 ? (cycle + 0.25) / 0.5 : -1;
    const planetUp = planetT >= 0;
    this.planetGroup.visible = planetUp;
    let dirP: THREE.Vector3 | null = null;
    if (planetUp) {
      dirP = pathDir(THREE.MathUtils.clamp(planetT, 0, 1));
      this.planetGroup.position.copy(dirP).multiplyScalar(R);
      this.planetGroup.lookAt(camPos);
      // The moons wheel around the giant (planet upgrade,
      // 2026-10-16): each angle is a pure function of the shared
      // cycle — whole orbits per planet rotation, so the
      // configuration repeats at midnight and agrees on every
      // client. Squash inclines the wheel; depth carries each
      // moon in front of the face and behind it in turn.
      for (const moon of this.moons) {
        const a = Math.PI * 2 * (cycle * moon.orbitsPerCycle + moon.phase);
        moon.mesh.position.set(
          Math.cos(a) * moon.orbitR,
          Math.sin(a) * moon.orbitR * moon.squash,
          Math.sin(a) * moon.depth,
        );
      }
    }
    // The whole night dome wheels very slowly with the cycle.
    this.starDome.rotation.y = cycle * 0.8;
    // Night fades: the engine's palette pass sets starMaterial's
    // opacity from dayness; everything else nocturnal follows
    // that one signal, scaled by its own max.
    const nightF = THREE.MathUtils.clamp(this.starMaterial.opacity / 0.95, 0, 1);
    for (const nm of this.nightMats) {
      (nm.mat as THREE.Material & { opacity: number }).opacity = nm.max * nightF;
    }
    // Comets (2026-10-16): each crosses on its fixed arc during
    // its window of the planet's transit, fading in and out at
    // the ends of the run. The tail trails the travel direction:
    // the plane billboards to the camera, then rolls in its own
    // plane until the streak points back along the velocity.
    for (const comet of this.comets) {
      const p = planetUp ? (planetT - comet.start) / comet.span : -1;
      if (p < 0 || p > 1) {
        comet.group.visible = false;
        continue;
      }
      comet.group.visible = true;
      const pos = comet.from.clone().lerp(comet.to, p).normalize().multiplyScalar(172);
      const ahead = comet.from.clone().lerp(comet.to, Math.min(1, p + 0.02)).normalize().multiplyScalar(172);
      const vel = ahead.sub(pos);
      comet.group.position.copy(pos);
      comet.group.lookAt(camPos);
      const viewDir = camPos.clone().sub(pos).normalize();
      const right = new THREE.Vector3().crossVectors(viewDir, new THREE.Vector3(0, 1, 0)).normalize();
      const up2 = new THREE.Vector3().crossVectors(right, viewDir).normalize();
      comet.plane.rotation.z = Math.atan2(vel.dot(up2), vel.dot(right));
      comet.mat.opacity = Math.sin(Math.PI * p) * 0.95 * nightF;
    }
    // Meteors (Shelf 1): the calendar's night, flown.
    this.updateMeteors(cycle, camPos, nightF, underground);
    // Lights ride their bodies; one shared target at the camera
    // keeps the direction honest in every zone.
    const target = this.dirLight.target;
    target.position.copy(camPos);
    target.updateMatrixWorld();
    if (sunSigned >= -0.12) {
      this.dirLight.position.copy(camPos).addScaledVector(dirA, 70);
      this.sunLightB.position.copy(camPos).addScaledVector(dirB, 70);
      this.sunLightB.target = target;
    } else {
      // Night: the giant's shine takes the primary light.
      const p = dirP ?? pathDir(0.5);
      this.dirLight.position.copy(camPos).addScaledVector(p, 70);
      this.sunLightB.intensity = 0;
    }
  }

  /**
   * Meteors (Shelf 1, 2026-10-17). Reads the sky clock
   * (skyCalendar's singleton): when the phase enters the
   * night band (cycle ≥ 0.75 or < 0.25), tonight's list —
   * baseline stars plus any shower — latches from the
   * calendar for the wall-clock day at that moment and
   * each spec fires as the phase crosses its spawn point
   * (nightT mapped into the band). Flights animate on
   * real time, billboarded and rolled along their fall
   * exactly like the comets. Underground or daylight:
   * nothing fires, and dawn ends flights where they are
   * (a streak lives about a second; the cut is invisible).
   */
  private updateMeteors(cycle: number, camPos: THREE.Vector3, nightF: number, underground: boolean): void {
    const inNight = cycle >= 0.75 || cycle < 0.25;
    if (!inNight) {
      this.meteorLatched = false;
      this.meteorNight = [];
      for (const u of this.meteorPool) {
        u.active = false;
        u.group.visible = false;
      }
      this.prevCycle = cycle;
      return;
    }
    const now = Date.now();
    const sky = skyRosterNow(now);
    if (sky && !this.meteorLatched) {
      const night = nightSkyAt(sky.roster, Math.floor(sky.tDays));
      this.meteorNight = [...night.baseline, ...(night.shower ? night.shower.meteors : [])]
        .map((spec) => ({ spec, at: (0.75 + spec.nightT * 0.5) % 1 }))
        .sort((a, b) => a.at - b.at);
      this.meteorFired = new Set();
      this.meteorLatched = true;
    }
    if (sky && !underground && this.prevCycle >= 0) {
      for (let i = 0; i < this.meteorNight.length; i++) {
        if (this.meteorFired.has(i)) continue;
        const at = this.meteorNight[i].at;
        const crossed =
          this.prevCycle <= cycle
            ? at > this.prevCycle && at <= cycle
            : at > this.prevCycle || at <= cycle;
        if (crossed) {
          this.meteorFired.add(i);
          this.spawnMeteor(this.meteorNight[i].spec, now);
        }
      }
    }
    this.prevCycle = cycle;
    // Animate the live flights.
    for (const u of this.meteorPool) {
      if (!u.active) continue;
      const k = (now - u.bornAt) / u.lifeMs;
      if (k >= 1) {
        u.active = false;
        u.group.visible = false;
        continue;
      }
      const pos = u.from.clone().lerp(u.to, k).normalize().multiplyScalar(172);
      const ahead = u.from.clone().lerp(u.to, Math.min(1, k + 0.05)).normalize().multiplyScalar(172);
      const vel = ahead.sub(pos);
      u.group.position.copy(pos);
      u.group.lookAt(camPos);
      const viewDir = camPos.clone().sub(pos).normalize();
      const right = new THREE.Vector3().crossVectors(viewDir, new THREE.Vector3(0, 1, 0)).normalize();
      const up2 = new THREE.Vector3().crossVectors(right, viewDir).normalize();
      u.plane.rotation.z = Math.atan2(vel.dot(up2), vel.dot(right));
      u.mat.opacity = Math.sin(Math.PI * k) * nightF;
    }
  }

  /** Deals one calendar spec to a free pool unit. */
  private spawnMeteor(spec: MeteorSpec, now: number): void {
    const unit = this.meteorPool.find((u) => !u.active);
    if (!unit) return; // a crowded second in a heavy shower — the sky forgives
    // The constructor's dirFromAzEl formula (az/el in
    // radians), local here because spawns happen per frame.
    const dir = (azDeg: number, elDeg: number): THREE.Vector3 => {
      const az = (azDeg * Math.PI) / 180;
      const el = (elDeg * Math.PI) / 180;
      return new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
    };
    unit.from.copy(dir(spec.azimuthDeg, spec.elevationDeg));
    // The fall: down by the spec's drop, skewed sideways by
    // a fraction of it so streaks rake rather than rain.
    const skew = ((spec.nightT * 7.31) % 1) - 0.5;
    unit.to.copy(dir(spec.azimuthDeg + spec.dropDeg * 0.45 * skew, spec.elevationDeg - spec.dropDeg));
    unit.bornAt = now;
    unit.lifeMs = spec.bolide ? 1150 : 520 + spec.size * 200;
    const length = 8 + spec.size * 7.5;
    unit.plane.scale.set(length, length * 0.14, 1);
    unit.mat.color.set(spec.hue);
    unit.active = true;
    unit.group.visible = true;
  }
}
