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
  private starPoints: THREE.Points;
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
    this.sunGlowA = disc(15, 0xffdf8a, 0.28);
    this.sunMeshA = disc(7, 0xfff3c4, 1);
    this.sunGlowB = disc(9.5, 0xffc98a, 0.24);
    this.sunMeshB = disc(4.4, 0xffe3ae, 1);
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
    // Stars: a seeded shell (identical on every client), revealed
    // by the night — opacity is driven from the engine's palette
    // pass through starMaterial.
    const starGeo = new THREE.BufferGeometry();
    const starCount = 700;
    const pos = new Float32Array(starCount * 3);
    let s = 1234567;
    const rnd = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    for (let i = 0; i < starCount; i++) {
      const az = rnd() * Math.PI * 2;
      const el = Math.asin(rnd() * 0.98 + 0.01);
      const r = 178;
      pos[i * 3] = Math.cos(az) * Math.cos(el) * r;
      pos[i * 3 + 1] = Math.sin(el) * r;
      pos[i * 3 + 2] = Math.sin(az) * Math.cos(el) * r;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.7,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      fog: false,
      depthWrite: false,
    });
    this.starPoints = new THREE.Points(starGeo, this.starMaterial);
    this.starPoints.renderOrder = -11;
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
    this.skyGroup.add(this.starPoints);
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
    // The binary pair: B trails A along the same path by a
    // fraction of the day band.
    const inDayBand = dayT >= -0.04 && dayT <= 1.04;
    const dirA = pathDir(THREE.MathUtils.clamp(dayT, 0, 1));
    const dirB = pathDir(THREE.MathUtils.clamp(dayT - 0.055, 0, 1));
    this.sunMeshA.visible = inDayBand;
    this.sunGlowA.visible = inDayBand;
    this.sunMeshB.visible = inDayBand && dayT > 0.03;
    this.sunGlowB.visible = this.sunMeshB.visible;
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
    // The star shell wheels very slowly with the cycle.
    this.starPoints.rotation.y = cycle * 0.8;
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
}
