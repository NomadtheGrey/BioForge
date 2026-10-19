// lightGestures.ts — every light's motion character (BioForge wave 2,
// slice 5, 2026-10-19, Adam: "glowing moss can pulsate").
//
// The pooled lighting system (threeEngine.updateLighting) gathers sources
// into grid cells and lets the nearest cells win a fixed pool of real
// PointLights. Every light previously stood perfectly still; now each
// family of light carries a GESTURE — one motion signature, read from
// the land at a glance (Adam: a week in, you navigate by them — pulse
// means the moss path home, sway means the door fern).
//
// THE MERGE RULE (pinned in the design): a merged cell takes its
// BRIGHTEST member's gesture. One cell, one gesture, no averaging.
//
// Implementation notes for the next reader:
// - The engine evaluates these per FRAME (they are closed-form curves,
//   cheap by construction — a few sins per pooled light), but the SOURCE
//   gathering still runs at 4 Hz. The pooled light's base intensity and
//   color are captured at refresh time; the gesture rides on top.
// - Every curve is STABLE per source: phase comes from a hash of the
//   cell's grid key (ripple takes its phase from world position instead).
//   There is no Math.random anywhere in the hot path — a gesture must
//   read the same every frame for the same source.
// - The multiplier is bounded by construction: never below 0.35, never
//   above 1.5. Values are modulation around the table's physical-scale
//   intensities — gestures touch nothing but the motion.
// - Instrument lights (the visor brow-glow) carry 'none' on purpose:
//   an instrument, not a creature. The chime and the slumber husk are
//   also 'none' — their own life functions already animate them.

/** One motion character for a light source. 'none' = the old stillness. */
export type LightGesture =
  | 'none' // no gesture — instruments, halos, still-born lights
  | 'pulse' // a slow heartbeat swell (glow mosses)
  | 'sway' // a flame in a draft (lantern ferns, bells)
  | 'twinkle' // individual sparkle winks (glow-spore colonies)
  | 'ripple' // the pulse TRAVELS (cave glow-fungus colonies)
  | 'gutter' // irregular surges, never even (ember flora)
  | 'still' // no intensity gesture at all — instead a minutes-long hue drift (saltglass, star glass)
  | 'thump' // a double-beat, lub-dub, rest (heart lights)
  | 'crackle' // sharp random spikes (storm-charged flora)
  | 'hue'; // slow hue rotation at steady intensity (prism family)

const TAU = Math.PI * 2;

/**
 * Deterministic hash of a string into a phase in [0, TAU). The same cell
 * key hashes the same way on every machine — the gesture's rhythm is
 * part of the world's identity, not of the session.
 */
export function gesturePhaseFor(key: string): number {
  let h = 5381;
  for (let i = 0; i < key.length; i += 1) {
    h = ((h << 5) + h + key.charCodeAt(i)) | 0;
  }
  // Unsigned, into [0, TAU).
  return ((h >>> 0) / 4294967296) * TAU;
}

/**
 * The intensity multiplier for a gesture at time tSec (the engine's
 * elapsed-time clock, which freezes under pause) and phase. Bounded to
 * [0.35, 1.5] by construction — the lab check asserts it.
 */
export function gestureIntensityMod(g: LightGesture, tSec: number, phase: number): number {
  switch (g) {
    case 'none':
    case 'still':
    case 'hue':
      return 1;
    case 'pulse': {
      // A slow heartbeat swell: ±25% over ~3.5 s.
      return 1 + 0.25 * Math.sin((TAU * tSec) / 3.5 + phase);
    }
    case 'sway': {
      // A flame in a draft: small, slightly irregular — two incommensurate
      // rhythms so it never reads as a metronome.
      return (
        1 +
        0.1 * Math.sin((TAU * tSec) / 2.3 + phase) +
        0.05 * Math.sin((TAU * tSec) / 0.87 + phase * 1.7)
      );
    }
    case 'twinkle': {
      // Mostly steady with brief winks: sharp dips and rarer peaks, each
      // spore's own rhythm from its phase.
      const dip = Math.pow(Math.max(0, Math.sin((TAU * tSec) / 1.13 + phase)), 12);
      const peak = Math.pow(Math.max(0, Math.sin((TAU * tSec) / 2.71 + phase * 2.9)), 16);
      return 1 - 0.5 * dip + 0.3 * peak;
    }
    case 'ripple': {
      // The pulse travels: phase here arrives pre-offset by world position
      // (the engine feeds (x + z) into the phase), so a colony breathes as
      // a wave passing through it.
      return 1 + 0.3 * Math.sin((TAU * tSec) / 4 + phase);
    }
    case 'gutter': {
      // Irregular surges — layered, heat thinking about itself.
      return (
        1 +
        0.2 * Math.sin((TAU * tSec) / 1.7 + phase) +
        0.12 * Math.sin((TAU * tSec) / 0.53 + phase * 2.3) +
        0.08 * Math.sin((TAU * tSec) / 3.3 + phase * 0.7)
      );
    }
    case 'thump': {
      // Lub-dub, rest: two sharp beats on a ~1.2 s heart.
      const lub = Math.pow(Math.max(0, Math.sin((TAU * tSec) / 1.2 + phase)), 16);
      const dub = Math.pow(Math.max(0, Math.sin((TAU * tSec) / 1.2 + phase + Math.PI / 4)), 16);
      return 1 + 0.35 * lub + 0.22 * dub;
    }
    case 'crackle': {
      // Miniature lightning: brief +40% flashes at hashed-random moments.
      const spike = Math.pow(Math.max(0, Math.sin((TAU * tSec) / 0.71 + phase * 3.1)), 24);
      return 1 + 0.4 * spike;
    }
  }
}

/**
 * Hue offset (in THREE.Color.offsetHSL units) for gestures whose motion
 * lives in color, not intensity. 'still' drifts prismatically over
// minutes; 'hue' rotates once a minute at steady intensity.
 */
export function gestureHueShift(g: LightGesture, tSec: number): number {
  if (g === 'hue') {
    return (tSec / 60) % 1;
  }
  if (g === 'still') {
    return (tSec / 240) % 1;
  }
  return 0;
}

// --------------------------------------------------------------------------
// THE FAMILY TABLE — which light moves how.
//
// lightSpecs.ts rows stay gesture-free (277 flora rows + the structure
// table — editing every row would be a whole-file churn for data that
// mostly says "like its family"). A row CAN carry an explicit gesture
// (LightBase.gesture) that wins over this table; otherwise the family's
// rule decides. New flora species land in the right motion by naming.
// --------------------------------------------------------------------------

const FLORA_GESTURE_FAMILIES: { match: (name: string) => boolean; gesture: LightGesture }[] = [
  // Prisms first: prism_moss is prism before it is moss.
  { match: (n) => n.includes('prism'), gesture: 'hue' },
  // Storm-charged: crackles. zot_star reads as storm, not star.
  { match: (n) => n.includes('zot') || n.includes('storm') || n === 'fulgurite', gesture: 'crackle' },
  // Ember family: gutters.
  { match: (n) => n.includes('ember') || n === 'cinder_bloom' || n.includes('flame') || n.includes('coal'), gesture: 'gutter' },
  // Saltglass and star glass: perfectly still — the stillness beside
  // living light is the point — with the slow hue drift.
  { match: (n) => n.includes('saltglass') || n.startsWith('star'), gesture: 'still' },
  // Cave glow-fungus colonies: the pulse travels.
  { match: (n) => n === 'glow_fungus' || n === 'glowcap', gesture: 'ripple' },
  // Glow-spore colonies: twinkle.
  { match: (n) => n === 'glow_spore_cluster', gesture: 'twinkle' },
  // Mosses: pulsate (Adam's seed example).
  { match: (n) => n.includes('moss'), gesture: 'pulse' },
  // Bells sway by the door — chime blooms most of all.
  { match: (n) => n.includes('bell'), gesture: 'sway' },
  // Lanterns sway like flames. (lantern_fern itself is handled by the
  // engine's growth-dynamic getter, which returns 'sway' directly.)
  { match: (n) => n.includes('lantern'), gesture: 'sway' },
  // The heart-blooms thump, gently.
  { match: (n) => n.includes('heart'), gesture: 'thump' },
];

/** The gesture for a flora species: explicit row override wins, then family. */
export function gestureForFlora(species: string, rowGesture?: LightGesture): LightGesture {
  if (rowGesture) {
    return rowGesture;
  }
  for (const f of FLORA_GESTURE_FAMILIES) {
    if (f.match(species)) {
      return f.gesture;
    }
  }
  return 'none';
}

const STRUCTURE_GESTURE_FAMILIES: { match: (name: string) => boolean; gesture: LightGesture }[] = [
  // The heart lights thump.
  { match: (n) => n === 'heart_tile' || n === 'valley_heart', gesture: 'thump' },
  // Glass holds still — grown glass, same alien calm as the saltglass panes.
  { match: (n) => n.includes('glass'), gesture: 'still' },
  // The chime and the slumber husk have their own lives (structure-life
  // functions animate them); their light stays still on purpose.
];

/** The gesture for a structure type: explicit row override wins, then family. */
export function gestureForStructure(type: string, rowGesture?: LightGesture): LightGesture {
  if (rowGesture) {
    return rowGesture;
  }
  for (const f of STRUCTURE_GESTURE_FAMILIES) {
    if (f.match(type)) {
      return f.gesture;
    }
  }
  return 'none';
}
