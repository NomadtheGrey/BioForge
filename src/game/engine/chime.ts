/**
 * THE BONE CHIME — a garden instrument's voice (Wave 2, the
 * Bone Chime Sentinel; the background lane wires the trigger,
 * this module is the sound it calls).
 *
 * The ask, in the designer's words: ONE note — bone-and-straw,
 * soft, unmistakably a warning but not an alarm: a hollow knock
 * and a straw shimmer, about a second long. It sounds when a
 * hunt-profile creature crosses ~25 m of a placed chime.
 *
 * Built from the synth's own voices, the way creatureVoices is:
 *   knock  — the bone: a pitch-dropping sine, hollowed by its
 *            fall (glideTo below the strike pitch);
 *   glass  — ONE faint inharmonic partial, rung at the strike:
 *            the family resemblance. The sentinel SPECIES' bell
 *            lives in this voice family — the chime is its
 *            cousin, a different instrument (quieter, duller,
 *            with straw on it), never its twin;
 *   breath — the straw: a filtered-noise shimmer that outlasts
 *            the knock, ~1 s in all.
 * It rides the PLANTS shelf: a grown thing of the garden, not a
 * creature and not interface chrome.
 *
 * The spec is a PURE function of the chime's key (its structure
 * id): every placed chime has its own pitch, the way every
 * creature has its own detune — two chimes in one garden do not
 * sound like one chime twice. Same key, same note, every world.
 */
import { audioCtx, hash01, scheduleTone } from './synthCore';

export interface ChimeSpec {
  /** The strike pitch (Hz) — bone's home, mid-low and woody. */
  freq: number;
  /** The straw shimmer's band center (Hz). */
  shimmerHz: number;
  /** Cents — this chime's offset from its own pitch class. */
  detune: number;
}

/** THE PURE FUNCTION. Same key, same chime, every world. */
export function chimeSpecFor(chimeKey: string): ChimeSpec {
  // Pitch placement across about a minor third of woody
  // territory (log space, because pitch is): low enough to
  // knock, high enough to carry across a garden.
  const place = hash01(`chime-place:${chimeKey}`);
  const freq = 392 * Math.pow(494 / 392, place);
  return {
    freq,
    shimmerHz: freq * 5.1,
    detune: Math.round((hash01(`chime-detune:${chimeKey}`) - 0.5) * 24),
  };
}

export interface ChimeOpts {
  /** Absolute ctx time; omit for "now" (the caller's clock is
   *  the audio clock — scheduleTone no-ops before the context
   *  exists, so an early call is safe and silent). */
  at?: number;
  /** 0..1 loudness after distance — chimeGainAt computes it. */
  gain: number;
  /** −1 (left) … 1 (right). */
  pan?: number;
  /** 0 = far/muffled, 1 = near/bright. */
  bright?: number;
}

/**
 * Distance → loudness for a chime event, in the audio engine's
 * own spirit: full voice inside its ring (the crossing radius
 * is ~25 m), gone by ~32 m. The peak is deliberately modest —
 * a warning you notice, not an alarm you flinch at.
 */
export function chimeGainAt(dist: number): number {
  const t = Math.max(0, Math.min(1, 1 - dist / 32));
  return Math.pow(t, 1.5) * 0.55;
}

/** Render the note. Fire and forget, like every call. */
export function playBoneChime(chimeKey: string, o: ChimeOpts): void {
  if (o.gain <= 0) return;
  const spec = chimeSpecFor(chimeKey);
  const at = o.at ?? audioCtx()?.currentTime ?? 0;
  const base = {
    bus: 'plants' as const,
    detune: spec.detune,
    pan: o.pan ?? 0,
    bright: o.bright ?? 0.8,
  };
  const f = spec.freq;
  // The bone: one hollow knock, the pitch letting go downward.
  scheduleTone({
    ...base,
    voice: 'knock',
    freq: f,
    glideTo: f * 0.78,
    at,
    dur: 0.5,
    gain: o.gain,
  });
  // The family: a glass partial, faint and brief — kinship,
  // not imitation.
  scheduleTone({
    ...base,
    voice: 'glass',
    freq: f * 2.76,
    at,
    dur: 0.85,
    gain: o.gain * 0.16,
  });
  // The straw: the shimmer that outlasts the strike.
  scheduleTone({
    ...base,
    voice: 'breath',
    freq: spec.shimmerHz,
    at: at + 0.03,
    dur: 1.0,
    gain: o.gain * 0.32,
  });
}
