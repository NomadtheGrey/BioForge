// =====================================================================
// THE WORLD ASKS BACK — world memory and echo records (S2, ported
// from the lab's echoes.mts, 2026-10-16)
// =====================================================================
//
// Completed (or neglected, or interrupted) saga outcomes are WRITTEN
// to a persistent world memory as "echoes", and later saga
// generation can CONSUME them as anchors: a released creature that
// settled anchors a new saga; an unanswered call from a zone comes
// back as a saga about the absence.
//
// S2 writes exactly one echo kind: 'neglected' (an offered saga the
// player never took up, expired after NEGLECT_DAYS). The consumption
// machinery (echoForZone, echoAnchorFor, the ECHO_ARC map) ports now
// so S3's echo-return arc and S4's consequence echoes plug into a
// working channel. The beat-text overlays (lab's ECHO_OVERLAYS /
// applyEchoOverlay) are S3's slice — they only matter once an
// echo-consumed arc is offerable, and none is in S2 (echo_return's
// resolution needs the S3 echoResolve signal).
//
// Every echo description is an AUTHORED fragment with slots — the
// same no-AI-generation guarantee as the sagas.

import { Dice, hashStringToSeed } from './rng';
import {
  zoneFacts,
  faunaName,
  floraName,
  familyLabel,
  type ZoneFacts,
} from './catalog';
import { fill, wherePhrases } from './templates';
import { cap } from './generator';
import {
  type AsksBackState,
  type AsksEcho,
  type AsksOffer,
  type AsksOwner,
} from '../asksBackState';

/** Echo kinds the channel knows. S2 writes 'neglected'; S3/S4 add the
 *  rest as their resolutions come online. */
export const ECHO_KINDS = [
  'neglected', // an offered saga was never taken up
  'deadAnchor', // a saga's anchor creature died mid-saga (S3)
  'released_settled', // a released creature settled in a zone (S4)
  'answered', // an echo-return saga completed; the ledger closed (S3)
  'other', // forward-compatible bucket
] as const;
export type EchoKind = (typeof ECHO_KINDS)[number];

// ── authored echo fragments ────────────────────────────────────────
// One honest paragraph each. Written by a person, filled by machine.
// Only 'neglected' is written in S2; the rest ship with the channel
// so S3/S4 don't re-author the tone.

const ECHO_FRAGMENTS: Record<string, string[]> = {
  neglected: [
    'You never answered {Zone}. Whatever waited there went on without you — or it did not. The not-knowing is yours now.',
    'The call from {Zone} expired unanswered. The world does not sulk; it simply files you under "busy" and moves on. Mostly.',
  ],
  deadAnchor: [
    'The {Species} in {Zone} is dead. The world does not keep that ledger — it keeps the absence, and the absence has a shape.',
    'Something ended in {Zone} before you finished with it: the {Species}. Permanent, the way the wild means it. What you do with the ending is the quest now.',
  ],
  released_settled: [
    'The {Species} you released in {Zone} has settled — {where}, if the signs read true. It is wilder now, and it is alive. That was the whole of the bargain.',
    'Word travels the way animals travel: the {Species} you let go in {Zone} is still there, still free. You did one true thing, and the zone kept the receipt.',
  ],
  answered: ['You answered {Zone}. The ledger is balanced — for now. But ledgers reopen.'],
  other: ['Something in {Zone} is unresolved. The world remembers; it will ask again.'],
};

/** Which arc an echo kind feeds when consumed. */
export const ECHO_ARC: Record<string, string> = {
  neglected: 'saga_echo_return',
  deadAnchor: 'saga_echo_return',
  released_settled: 'saga_lost_one',
  answered: 'saga_lost_one',
  other: 'saga_echo_return',
};

/** Deterministic echo id. */
export function echoId(
  worldSeed: string,
  kind: string,
  zx: number,
  zz: number,
  day: number,
  suffix: string,
): string {
  const h = hashStringToSeed(
    `asks-echo|${worldSeed}|${kind}|${zx}|${zz}|${day}|${suffix}`,
  );
  return `echo_${h.toString(16).padStart(8, '0')}`;
}

function echoSlots(
  e: { zx: number; zz: number; zoneName: string; species?: string; flora?: string },
  worldSeed: string,
  seedSalt: string,
): Record<string, string | number> {
  const zone: ZoneFacts = zoneFacts(worldSeed, e.zx, e.zz);
  const dice = new Dice(hashStringToSeed(`asks-echoslots|${worldSeed}|${seedSalt}`));
  const w = zone.weather;
  const s: Record<string, string | number> = {
    Zone: e.zoneName,
    zone: e.zoneName.toLowerCase(),
    family: familyLabel(zone.families[0]),
    weather: w,
    Weather: w.charAt(0).toUpperCase() + w.slice(1),
    hops: zone.hops === 1 ? '1 zone' : `${zone.hops} zones`,
  };
  if (e.species) {
    const n = faunaName(e.species);
    s['Species'] = cap(n);
    s['species'] = n;
  }
  if (e.flora) {
    const n = floraName(e.flora);
    s['Flora'] = cap(n);
    s['flora'] = n;
  }
  return s;
}

export interface WriteEchoArgs {
  kind: string;
  day: number;
  zx: number;
  zz: number;
  species?: string;
  flora?: string;
  /** A settled creature's given name, when the echo is about one. */
  individual?: string;
  sourceSaga?: string;
  suffix?: string;
  owner?: AsksOwner;
}

/** Write an echo record to world memory. */
export function writeEcho(worldSeed: string, args: WriteEchoArgs): AsksEcho {
  const zone = zoneFacts(worldSeed, args.zx, args.zz);
  const dice = new Dice(
    hashStringToSeed(
      `asks-echotext|${worldSeed}|${args.kind}|${args.zx}|${args.zz}|${args.day}|${args.suffix ?? ''}`,
    ),
  );
  const frags = ECHO_FRAGMENTS[args.kind] ?? ECHO_FRAGMENTS.other;
  const text = fill(
    dice.pick(frags),
    echoSlots(
      { zx: args.zx, zz: args.zz, zoneName: zone.name, species: args.species, flora: args.flora },
      worldSeed,
      args.kind,
    ),
  );
  return {
    id: echoId(worldSeed, args.kind, args.zx, args.zz, args.day, args.suffix ?? ''),
    kind: args.kind as AsksEcho['kind'],
    zoneKey: `${args.zx},${args.zz}`,
    species: args.species,
    flora: args.flora,
    individual: args.individual,
    day: args.day,
    text,
    consumedBy: [],
  };
}

/**
 * Earliest-written unconsumed echo for this exact zone. Species-less
 * 'answered' echoes are terminal ("answered echoes stay answered") —
 * the lab found that letting them seed echo-return sagas produced a
 * degenerate infinite go-back loop.
 */
export function echoForZone(
  state: AsksBackState,
  zx: number,
  zz: number,
  day: number,
): AsksEcho | null {
  const key = `${zx},${zz}`;
  let best: AsksEcho | null = null;
  for (const e of state.echoes) {
    if (e.zoneKey !== key) continue;
    if (e.day >= day) continue; // written today: not yet a memory
    if (e.consumedBy.length > 0) continue;
    if (e.kind === 'answered' && !e.species) continue; // terminal
    if (!best || e.day < best.day) best = e;
  }
  return best;
}

/** Build the forced anchor for an echo-consumed saga. */
export function echoAnchorFor(e: AsksEcho): {
  domain: 'fauna' | 'flora' | 'zone';
  id: string;
  name: string;
  individual?: string;
} {
  if (e.species)
    return {
      domain: 'fauna',
      id: e.species,
      name: e.individual ?? faunaName(e.species),
      individual: e.individual,
    };
  if (e.flora)
    return { domain: 'flora', id: e.flora, name: floraName(e.flora) };
  return { domain: 'zone', id: e.zoneKey, name: e.zoneKey };
}

// ── echo overlays: authored beat text for consumed echoes ────────
// S3. When an echo feeds saga_echo_return, the generic base beats
// ("Go Back", "Answer It") are re-skinned with echo-aware authored
// fragments — fixed pools, slots filled from the echo record. Steps
// keep their order, targets, and goals; only the prose changes.
// Overlays exist for every echo kind the game writes today
// (neglected, deadAnchor, other); kinds S4 adds get their own here.

interface OverlayBeat {
  titles: string[];
  texts: string[];
}

interface EchoReturnOverlay {
  quest: { titles: string[]; texts: string[] };
  beats: Record<string, OverlayBeat>;
}

const ECHO_RETURN_OVERLAYS: Record<string, EchoReturnOverlay> = {
  neglected: {
    quest: {
      titles: ['The Unanswered', 'An Unkept Appointment'],
      texts: [
        'You let {Zone} go unanswered once. The world filed it under "busy" — and now it is asking again. Go back. See what the days did with the waiting.',
      ],
    },
    beats: {
      anchor: {
        titles: ['Walk It Back'],
        texts: [
          'The way back is the quest now — {Zone}, on foot, like it matters. Whatever waited is still waiting, or it is not. Either answer is an answer.',
        ],
      },
      resolution: {
        titles: ['Answer It This Time'],
        texts: [
          'Do what the unanswered call asked. Feed it, mark it, carry it, or let it go — but do it on purpose, now, in {Zone}. Unanswered twice is a habit.',
        ],
      },
    },
  },
  deadAnchor: {
    quest: {
      titles: ['What the {Species} Left', 'The Absence'],
      texts: [
        'The {species} in {Zone} is dead — you left a quest half-done and the wild finished it its own way. Go back. The absence has a shape; learn it.',
      ],
    },
    beats: {
      anchor: {
        titles: ['The Last Visit'],
        texts: [
          'Return to {Zone}. Not to finish — to witness what finished without you. Walk it slowly; the dead do not hurry, and neither should you.',
        ],
      },
      resolution: {
        titles: ['Mark It'],
        texts: [
          'There is no fixing a death, only marking it. Stand where the {species} stood in {Zone} and let the ledger close. Then come back in a few days and see what the zone kept.',
        ],
      },
    },
  },
  other: {
    quest: {
      titles: ['Something Unresolved', 'The Open Ledger'],
      texts: [
        'Something in {Zone} never settled. The world remembers what you left open — go and close it, or look it in the eye and name why you will not.',
      ],
    },
    beats: {
      anchor: {
        titles: ['Back Again'],
        texts: [
          'Return to {Zone}. The way back is part of the quest — walk it like it matters, because the world is keeping score on this one.',
        ],
      },
      resolution: {
        titles: ['Close It'],
        texts: [
          'Do the thing the open ledger asks. Feed it, mark it, carry it, or let it go — but do it on purpose, and do it now, in {Zone}.',
        ],
      },
    },
  },
};

/**
 * Apply an echo overlay to a generated saga: swap the quest title/
 * text and the named beats' titles/texts for echo-aware authored
 * variants, slot-filled from the echo record. Pure — returns a new
 * offer; the Director calls it at consumption time so the stored
 * offer already wears its echo face.
 */
export function applyEchoOverlay(
  worldSeed: string,
  offer: AsksOffer,
  echo: AsksEcho,
): AsksOffer {
  const ov = ECHO_RETURN_OVERLAYS[echo.kind];
  if (!ov || offer.arc !== 'saga_echo_return') return offer;
  const dice = new Dice(hashStringToSeed(`asks-overlay|${offer.id}|${echo.id}`));
  const [ezx, ezz] = echo.zoneKey.split(',').map(Number);
  const slots: Record<string, string | number> = {
    ...echoSlots(
      {
        zx: Number.isFinite(ezx) ? ezx : offer.zx,
        zz: Number.isFinite(ezz) ? ezz : offer.zz,
        zoneName: offer.zoneName,
        species: echo.species,
        flora: echo.flora,
      },
      worldSeed,
      'overlay',
    ),
    where: wherePhrases(dice),
  };
  if (echo.individual) {
    slots['Individual'] = cap(echo.individual);
    slots['individual'] = echo.individual;
  }
  const steps = offer.steps.map((s) => {
    const b = ov.beats[s.beat];
    if (!b) return s;
    // Slot-safety: if the echo lacks a species/flora the overlay's
    // fragment names, the filled text keeps a raw {slot} — in that
    // case the base beat text stands (the generator's own
    // assertOfferable proved it filled).
    const title = fill(dice.pick(b.titles), slots);
    const text = fill(dice.pick(b.texts), slots);
    if (/\{(\w+)\}/.test(title) || /\{(\w+)\}/.test(text)) return s;
    return { ...s, title, text };
  });
  const title = fill(dice.pick(ov.quest.titles), slots);
  const text = fill(dice.pick(ov.quest.texts), slots);
  if (/\{(\w+)\}/.test(title) || /\{(\w+)\}/.test(text))
    return { ...offer, steps };
  return { ...offer, title, text, steps };
}
