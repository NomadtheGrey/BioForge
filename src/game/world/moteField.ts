/**
 * moteField.ts — family motes: the air takes the land's
 * character (Shelf 2 of the Living World build, 2026-10-17).
 *
 * WHAT THIS IS: a sparse, always-on drift of tiny particles
 * around the player, styled per biome FAMILY — ember
 * country sheds rising sparks, fungal country hangs
 * glow-spores that brighten after dark, saltglass air
 * glitters, meadow air sheds seed-fluff at dawn. It is
 * AMBIENCE, not weather: the engine's weather field
 * (rain/snow/ash, dealt per zone by zoneWeatherAt) is a
 * separate system and is untouched by this one. A zone
 * can have both — spore-drift under falling ash is a
 * perfectly good evening in the wild country.
 *
 * SHAPE: the pure half is the spec table below — one row
 * per family, all behavior in NUMBERS (the weather field's
 * lesson: data over branches). The impure half is the
 * MoteField class, a THREE.Points cloud built on the
 * weather field's proven pattern: a fixed-capacity box
 * around the camera, per-particle seeds, local wrapping
 * so the drift never ends. The engine owns one instance:
 * it forwards the dealt biome (setZoneBiome) and ticks
 * the field beside the sky each frame.
 *
 * Families only, in v1: setZoneBiome is told the dealt
 * FAMILY (hybrids resolve to a family face upstream), so
 * motes key on the same id the ground tint does.
 */

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// The spec table — one row per family
// ---------------------------------------------------------------------------

export interface MoteSpec {
  /** Particle tint. */
  color: number;
  /** Fraction of the field's capacity aloft (0..1). */
  density: number;
  /** Point size (world-ish units, as PointsMaterial takes it). */
  size: number;
  /** Vertical drift, m/s — positive rises, negative settles. */
  rise: number;
  /** Horizontal wander: amplitude (m) and speed of the sway. */
  swayAmp: number;
  swaySpeed: number;
  /** 0..1 — how hard each mote's light pulses (glitter, flicker). */
  twinkle: number;
  /** Extra presence in the dawn band (cycle 0.19..0.33). */
  dawnBoost: number;
  /** Presence at full night relative to day (glow-spores > 1). */
  nightGlow: number;
  /** Presence at full day relative to a neutral 1. */
  dayPresence: number;
}

/**
 * The eleven families, in the air. Reading guide: ember
 * motes RISE fast and flicker (twinkle high); fungal
 * spores barely move and come alive at night (nightGlow
 * 1.6, dayPresence low — the dark is when they show);
 * saltglass glitter is nearly still and all twinkle;
 * meadow fluff is a dawn thing (dawnBoost) that settles;
 * bone country gets slow gray ash-flecks that are NOT
 * the weather ash — sparser, bigger, lazier; storm air
 * is charged: quick, jittery, bright at night; living
 * country breathes slowest of all, pink-warm, pulsing.
 */
export const MOTE_SPECS: Record<string, MoteSpec> = {
  meadow:    { color: 0xf5f0d8, density: 0.34, size: 0.16, rise: -0.05, swayAmp: 0.9, swaySpeed: 0.25, twinkle: 0.15, dawnBoost: 0.9, nightGlow: 0.4, dayPresence: 1.0 },
  wetland:   { color: 0xd8ecec, density: 0.4, size: 0.2, rise: 0.02, swayAmp: 0.6, swaySpeed: 0.18, twinkle: 0.1, dawnBoost: 0.3, nightGlow: 0.6, dayPresence: 0.9 },
  fungal:    { color: 0x9fe8c0, density: 0.52, size: 0.19, rise: 0.03, swayAmp: 0.5, swaySpeed: 0.15, twinkle: 0.35, dawnBoost: 0.0, nightGlow: 1.6, dayPresence: 0.35 },
  ember:     { color: 0xffa050, density: 0.46, size: 0.15, rise: 0.55, swayAmp: 0.7, swaySpeed: 0.5, twinkle: 0.7, dawnBoost: 0.0, nightGlow: 1.1, dayPresence: 0.9 },
  saltglass: { color: 0xffffff, density: 0.38, size: 0.13, rise: -0.01, swayAmp: 0.25, swaySpeed: 0.1, twinkle: 0.95, dawnBoost: 0.2, nightGlow: 0.9, dayPresence: 1.0 },
  frost:     { color: 0xdcefff, density: 0.42, size: 0.14, rise: -0.08, swayAmp: 0.5, swaySpeed: 0.22, twinkle: 0.6, dawnBoost: 0.1, nightGlow: 0.8, dayPresence: 1.0 },
  rootwood:  { color: 0xe8c890, density: 0.36, size: 0.17, rise: -0.12, swayAmp: 0.8, swaySpeed: 0.2, twinkle: 0.12, dawnBoost: 0.4, nightGlow: 0.35, dayPresence: 1.0 },
  precursor: { color: 0xa8e8ff, density: 0.3, size: 0.14, rise: 0.1, swayAmp: 0.3, swaySpeed: 0.12, twinkle: 0.5, dawnBoost: 0.0, nightGlow: 1.3, dayPresence: 0.5 },
  bone:      { color: 0xcfc8ba, density: 0.3, size: 0.21, rise: -0.06, swayAmp: 0.7, swaySpeed: 0.16, twinkle: 0.08, dawnBoost: 0.0, nightGlow: 0.5, dayPresence: 0.95 },
  storm:     { color: 0xd8ccff, density: 0.44, size: 0.14, rise: 0.18, swayAmp: 1.1, swaySpeed: 0.65, twinkle: 0.8, dawnBoost: 0.0, nightGlow: 1.25, dayPresence: 0.7 },
  living:    { color: 0xffc8d8, density: 0.4, size: 0.18, rise: 0.06, swayAmp: 0.55, swaySpeed: 0.14, twinkle: 0.3, dawnBoost: 0.2, nightGlow: 1.2, dayPresence: 0.6 },
};

/** What unknown country gets: quiet meadow air, thin. */
export const MOTE_FALLBACK: MoteSpec = { ...MOTE_SPECS.meadow, density: 0.2 };

export function moteSpecFor(biomeId: string | null | undefined): MoteSpec {
  if (!biomeId) return MOTE_FALLBACK;
  return MOTE_SPECS[biomeId] ?? MOTE_FALLBACK;
}

/**
 * How present the motes are at a moment: the day/night
 * blend of the spec's two presences, plus the dawn band's
 * boost (a smooth bump centered on sunrise, cycle 0.25).
 * Pure and harness-checked — the class just multiplies.
 */
export function motePresenceAt(spec: MoteSpec, cycle: number, nightF: number): number {
  const base = spec.dayPresence * (1 - nightF) + spec.nightGlow * nightF;
  // Distance from sunrise on the wrapped cycle.
  const d = Math.abs(((cycle - 0.25 + 1.5) % 1) - 0.5);
  const dawn = Math.max(0, 1 - d / 0.07);
  return Math.min(1.6, base * (1 + spec.dawnBoost * dawn * dawn));
}

// ---------------------------------------------------------------------------
// The field
// ---------------------------------------------------------------------------

/** Points capacity (the weather field's proven count). */
const MOTE_COUNT = 750;
/** The drift box around the camera (the weather field's box). */
const BOX_W = 56;
const BOX_H = 26;

/** A soft round mote sprite, drawn once (weather-field style). */
function makeMoteTexture(): THREE.CanvasTexture {
  const s = 64;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class MoteField {
  private points: THREE.Points;
  private mat: THREE.PointsMaterial;
  private seeds: Float32Array;
  private spec: MoteSpec = MOTE_FALLBACK;
  private elapsed = 0;

  constructor(scene: THREE.Scene) {
    const positions = new Float32Array(MOTE_COUNT * 3);
    this.seeds = new Float32Array(MOTE_COUNT);
    for (let i = 0; i < MOTE_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * BOX_W;
      positions[i * 3 + 1] = Math.random() * BOX_H;
      positions[i * 3 + 2] = (Math.random() - 0.5) * BOX_W;
      this.seeds[i] = Math.random();
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.mat = new THREE.PointsMaterial({
      map: makeMoteTexture(),
      color: this.spec.color,
      size: this.spec.size,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geom, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = -9;
    scene.add(this.points);
  }

  /** The dealt family changed (zone travel, world load). */
  public setBiome(biomeId: string | null): void {
    this.spec = moteSpecFor(biomeId);
    this.mat.color.set(this.spec.color);
    this.mat.size = this.spec.size;
    const active = Math.round(MOTE_COUNT * this.spec.density);
    this.points.geometry.setDrawRange(0, active);
    this.mat.needsUpdate = true;
  }

  /**
   * Per frame: the group rides the camera (weather-field
   * pattern), each mote drifts by the spec — rising or
   * settling, swaying on its own seed-phase — and wraps
   * inside the box, so the air never runs out. Presence
   * (overall opacity) comes from motePresenceAt; twinkle
   * rides it as a slow global pulse (per-point twinkle
   * would need a shader; the pulse reads as glitter
   * at this size and costs nothing).
   */
  public update(dt: number, camPos: THREE.Vector3, cycle: number, nightF: number, visible: boolean): void {
    this.points.visible = visible;
    if (!visible) return;
    this.elapsed += dt;
    this.points.position.set(camPos.x, camPos.y - 6, camPos.z);
    const presence = motePresenceAt(this.spec, cycle, nightF);
    const pulse = 1 - this.spec.twinkle * 0.35 * (0.5 + 0.5 * Math.sin(this.elapsed * 2.1));
    this.mat.opacity = Math.min(1, 0.34 * presence * pulse + 0.08 * presence);
    const pos = this.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const active = Math.round(MOTE_COUNT * this.spec.density);
    for (let i = 0; i < active; i++) {
      const seed = this.seeds[i];
      const j = i * 3;
      arr[j + 1] += this.spec.rise * dt * (0.6 + seed * 0.8);
      arr[j] += Math.sin(this.elapsed * this.spec.swaySpeed + seed * 17.0) * this.spec.swayAmp * dt;
      arr[j + 2] += Math.cos(this.elapsed * this.spec.swaySpeed * 0.83 + seed * 23.0) * this.spec.swayAmp * dt;
      // Wrap inside the box (local coords, camera-centered).
      if (arr[j + 1] > BOX_H) arr[j + 1] -= BOX_H;
      if (arr[j + 1] < 0) arr[j + 1] += BOX_H;
      if (arr[j] > BOX_W / 2) arr[j] -= BOX_W;
      if (arr[j] < -BOX_W / 2) arr[j] += BOX_W;
      if (arr[j + 2] > BOX_W / 2) arr[j + 2] -= BOX_W;
      if (arr[j + 2] < -BOX_W / 2) arr[j + 2] += BOX_W;
    }
    pos.needsUpdate = true;
  }
}
