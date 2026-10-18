/**
 * creatureVoices.ts — a creature's voice is a PURE FUNCTION of
 * its data record (Adam's law, pinned 2026-10-17).
 *
 *   voiceParamsFor(speciesId, entityId) reads no audio state,
 *   touches no context, and can be unit-tested headless —
 *   the same species + the same individual produce the same
 *   voice in every world, forever.
 *
 * The three layers of the law:
 *   1. TYPE sets the band. The base animal profile (the
 *      species record's own profile — grazer, serpent, frog-
 *      kin…) fixes the pitch/depth range and the envelope
 *      character. Size is a clue, never the law: the type
 *      knows frogs are deep.
 *   2. SPECIES sets the character. The species ID — the ID,
 *      not the display name (names get renamed; a Bailiff was
 *      a Feral Warden once) — is hashed to place the species
 *      inside its band and to roll its figure: the interval
 *      its greeting rises by, and its WEIRDNESS (a falling
 *      greeting here, a grace note there). Rolled from the
 *      ID, the weirdness is the same in every world: a
 *      learnable trait of the species, never per-individual
 *      dice.
 *   3. THE INDIVIDUAL detunes. The entity's own id hashes to
 *      a few cents sharp or flat, so a herd is a near-unison
 *      chorus of itself, not a row of clones.
 *
 * Apexes (the great territorial kinds, the serpents) carry a
 * COMPOSED signature over the computed voice: a low figure
 * under the call, the same for every member of the kind —
 * authorship where the world has earned it.
 *
 * The occasions are the settled set (2026-10-17): greeting,
 * the alert tell, the Answer (social kinds reply), the vat
 * imprint chirp, and the death sound (pinned IN by Adam).
 * Idle calls and distress cries are deliberately ABSENT —
 * the noise-budget pair, to be judged by ear with this
 * engine running, not on paper.
 */

import { SPECIES, type SpeciesProfile } from '../creatures/species';
import { hash01, scheduleTone, type SynthVoice } from './synthCore';

// ---------------------------------------------------------------------------
// Layer 1 — the type's band
// ---------------------------------------------------------------------------

interface ProfileBand {
  /** Home-pitch range, Hz. The species hash places the kind
   *  somewhere inside; individuals detune around it. */
  lo: number;
  hi: number;
  voice: SynthVoice;
  alt: SynthVoice;
  /** 0..1 — how readily this kind greets and answers. */
  social: number;
  /** 0..1 — the detuned edge an alert tell carries. */
  harsh: number;
}

const PROFILE_BANDS: Record<SpeciesProfile, ProfileBand> = {
  grazer:      { lo: 160, hi: 260, voice: 'pluck',  alt: 'reed',   social: 0.7,  harsh: 0.1 },
  rodent:      { lo: 620, hi: 940, voice: 'pluck',  alt: 'knock',  social: 0.5,  harsh: 0.15 },
  predator:    { lo: 82,  hi: 130, voice: 'thrum',  alt: 'reed',   social: 0.15, harsh: 0.8 },
  drifter:     { lo: 780, hi: 1180, voice: 'breath', alt: 'glass', social: 0.3,  harsh: 0 },
  glider:      { lo: 480, hi: 760, voice: 'breath', alt: 'reed',   social: 0.45, harsh: 0.1 },
  flyer:       { lo: 380, hi: 640, voice: 'reed',   alt: 'breath', social: 0.5,  harsh: 0.3 },
  hare:        { lo: 700, hi: 1050, voice: 'knock', alt: 'pluck', social: 0.4,  harsh: 0.2 },
  insect:      { lo: 1250, hi: 1900, voice: 'glass', alt: 'knock', social: 0.2,  harsh: 0 },
  bird:        { lo: 520, hi: 880, voice: 'pluck',  alt: 'glass',  social: 0.8,  harsh: 0.25 },
  // The frog law, in a row of the table: small body, deep
  // voice — because the TYPE says so, not the mesh.
  amphibian:   { lo: 110, hi: 190, voice: 'knock',  alt: 'thrum',  social: 0.6,  harsh: 0.1 },
  slug:        { lo: 140, hi: 210, voice: 'breath', alt: 'thrum',  social: 0.1,  harsh: 0 },
  lizard:      { lo: 430, hi: 650, voice: 'knock',  alt: 'pluck',  social: 0.3,  harsh: 0.35 },
  turtle:      { lo: 95,  hi: 150, voice: 'thrum',  alt: 'knock',  social: 0.35, harsh: 0 },
  colony:      { lo: 280, hi: 430, voice: 'reed',   alt: 'pluck',  social: 0.9,  harsh: 0.1 },
  territorial: { lo: 74,  hi: 118, voice: 'thrum',  alt: 'reed',   social: 0.4,  harsh: 0.65 },
  radial:      { lo: 330, hi: 500, voice: 'glass',  alt: 'breath', social: 0.25, harsh: 0.2 },
  serpent:     { lo: 130, hi: 210, voice: 'breath', alt: 'thrum',  social: 0.1,  harsh: 0.7 },
};

/** Profiles whose kinds carry the composed apex signature. */
const APEX_PROFILES: ReadonlySet<SpeciesProfile> = new Set(['territorial', 'serpent', 'predator']);

// ---------------------------------------------------------------------------
// Layers 2 + 3 — species character, individual detune
// ---------------------------------------------------------------------------

export interface VoiceParams {
  /** This species' home pitch (Hz), inside its type's band. */
  freq: number;
  voice: SynthVoice;
  altVoice: SynthVoice;
  social: number;
  harsh: number;
  /** Cents — THIS individual's offset from the species pitch. */
  detune: number;
  /** The greeting's second note, in semitones from home.
   *  Species character: usually a rise; the weird ones fall. */
  greetingStep: number;
  /** Species character: a third, grace note after the pair. */
  graceNote: boolean;
  apex: boolean;
}

const GREETING_STEPS = [3, 4, 5, 7];

/** THE PURE FUNCTION. Same inputs, same voice, every world. */
export function voiceParamsFor(speciesId: string, entityId: string): VoiceParams {
  const def = SPECIES[speciesId as keyof typeof SPECIES];
  const profile: SpeciesProfile = def?.profile ?? 'grazer';
  const band = PROFILE_BANDS[profile];

  // Species placement inside the band — log space, because
  // pitch is.
  const place = hash01(`voice-place:${speciesId}`);
  const freq = band.lo * Math.pow(band.hi / band.lo, place);

  // Species character: the greeting figure + the weirdness.
  const charRoll = hash01(`voice-char:${speciesId}`);
  const stepPick = GREETING_STEPS[Math.floor(charRoll * GREETING_STEPS.length) % GREETING_STEPS.length];
  const falls = hash01(`voice-fall:${speciesId}`) < 0.14; // ~1 in 7 kinds greet DOWNWARD
  const graceNote = hash01(`voice-grace:${speciesId}`) < 0.22;

  // The individual: a few cents of their own (±18 — a chorus
  // width, not a different instrument).
  const detune = Math.round((hash01(`voice-detune:${entityId}`) - 0.5) * 36);

  return {
    freq,
    voice: band.voice,
    altVoice: band.alt,
    social: band.social,
    harsh: band.harsh,
    detune,
    greetingStep: falls ? -stepPick : stepPick,
    graceNote,
    apex: APEX_PROFILES.has(profile),
  };
}

// ---------------------------------------------------------------------------
// The calls themselves (rendering — the impure half)
// ---------------------------------------------------------------------------

export type CallKind = 'greeting' | 'answer' | 'alert' | 'death' | 'imprint';

export interface CallOpts {
  /** Absolute ctx time. */
  at: number;
  /** 0..1 loudness after distance — the caller computes it. */
  gain: number;
  pan: number;
  /** 0..1 brightness after distance. */
  bright: number;
}

const semis = (freq: number, n: number) => freq * Math.pow(2, n / 12);

/**
 * Render one call on the Creatures channel. Chorus discipline
 * (how many at once, how near) is the CALLER's law — this
 * function only knows how a call sounds.
 */
export function playCall(kind: CallKind, v: VoiceParams, o: CallOpts): void {
  const base = { bus: 'creatures' as const, detune: v.detune, pan: o.pan, bright: o.bright };
  const f = v.freq;

  // The apex signature: a low composed figure UNDER the call —
  // the kind clearing its throat before it speaks.
  if (v.apex && (kind === 'greeting' || kind === 'alert')) {
    scheduleTone({ ...base, voice: 'thrum', freq: f / 2, at: o.at, dur: 0.9, gain: o.gain * 0.8 });
  }

  switch (kind) {
    case 'greeting': {
      scheduleTone({ ...base, voice: v.voice, freq: f, at: o.at, dur: 0.5, gain: o.gain });
      scheduleTone({ ...base, voice: v.voice, freq: semis(f, v.greetingStep), at: o.at + 0.19, dur: 0.65, gain: o.gain * 0.9 });
      if (v.graceNote) {
        scheduleTone({ ...base, voice: v.altVoice, freq: semis(f, v.greetingStep + 3), at: o.at + 0.44, dur: 0.4, gain: o.gain * 0.55 });
      }
      break;
    }
    case 'answer': {
      // One soft note at the interval it was greeted with —
      // the same word, said back.
      scheduleTone({ ...base, voice: v.altVoice, freq: semis(f, v.greetingStep), at: o.at, dur: 0.55, gain: o.gain * 0.7 });
      break;
    }
    case 'alert': {
      for (let i = 0; i < 3; i++) {
        scheduleTone({ ...base, voice: v.voice, freq: f, at: o.at + i * 0.14, dur: 0.13, gain: o.gain });
        if (v.harsh > 0.05) {
          scheduleTone({
            ...base, voice: v.altVoice, freq: f, at: o.at + i * 0.14, dur: 0.13,
            gain: o.gain * 0.5 * v.harsh, detune: v.detune + Math.round(55 * v.harsh),
          });
        }
      }
      break;
    }
    case 'death': {
      // Down and out: the pitch lets go, and the breath leaves
      // after it. Quiet on purpose — this is not a sting.
      scheduleTone({ ...base, voice: v.voice, freq: f, glideTo: f * 0.55, at: o.at, dur: 1.15, gain: o.gain * 0.85 });
      scheduleTone({ ...base, voice: 'breath', freq: f * 2, at: o.at + 0.7, dur: 0.85, gain: o.gain * 0.45 });
      break;
    }
    case 'imprint': {
      // The vat chirp: three bright notes climbing — a small
      // life announcing it has decided who its person is.
      const voice: SynthVoice = f > 300 ? 'glass' : v.voice;
      [0, 7, 12].forEach((step, i) => {
        scheduleTone({ ...base, voice, freq: semis(f, step), at: o.at + i * 0.09, dur: 0.32, gain: o.gain * (0.7 + i * 0.15) });
      });
      break;
    }
  }
}
