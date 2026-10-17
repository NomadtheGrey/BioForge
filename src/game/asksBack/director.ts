// =====================================================================
// THE WORLD ASKS BACK — the Director (S2, ported from the lab's
// journey.mts Director, 2026-10-16)
// =====================================================================
//
// The generator writes sagas; the Director decides WHICH saga is
// offered, WHEN, and ABOUT WHAT. It is not an AI and not an NPC —
// deterministic rules evaluated when the day rolls or the player
// enters a new zone, never per frame. In co-op the host's Director
// runs once for everyone (the record already carries owner ids).
//
// The Director's jobs (the lab's round-3 config I_all, its best):
//   FIT — only what is true in this zone's census and reachable;
//         completability lives here (the writer registry in
//         generator.ts refuses unwritable beats).
//   RESTRAINT — offer + anchor cooldowns (15d / 10d), persisted in
//         the record so they survive save/load.
//   MEMORY — prefers anchors the player has history with (tamed
//         species), and settled individuals BY NAME (the round-3
//         rider: consequences come back as named anchors, not only
//         through echoes).
//   RHYTHM — pacing: length mixing, family anti-clustering, and the
//         personal/echo share cap (see PERSONAL_ECHO_CAP).
//   HOUSEKEEPING — ignored offers expire into 'neglected' echoes;
//         answered echoes stay answered (never re-offered).
//   RARITY — Precursor-flavored arcs capped at a small share.
//
// Tuning knobs are named constants below. PERSONAL_ECHO_CAP = 0.35
// is the lab's pick, explicitly NOT gospel — the lab's own note:
// playtest 35 vs 40 before pinning.

import { Dice, hashStringToSeed } from './rng';
import { zoneFacts, speciesFamily } from './catalog';
import { generateSaga, nearKey, type SagaOpts } from './generator';
import {
  SAGA_ARCS,
  isPrecursorArc,
  type GameProfile,
} from './templates';
import { writeEcho, echoForZone, echoAnchorFor, ECHO_ARC, applyEchoOverlay } from './echoes';
import { removedSet, abundanceMap, settledIn } from './zoneState';
import { zoneHops } from '../zones';
import {
  asksGameDay,
  type AsksBackState,
  type AsksOffer,
  type AsksEcho,
} from '../asksBackState';

// ── tuning knobs (lab round-3 config I_all) ────────────────────────

/** Max sagas the player can hold at once. */
export const MAX_ACTIVE_SAGAS = 3;
/** At most one new offer per game day. */
export const OFFER_COOLDOWN_DAYS = 15;
/** Per (arc, anchor) cooldown, in days. */
export const ANCHOR_COOLDOWN_DAYS = 10;
/** Precursor-flavored arcs: max share of the rolling 20 offers. */
export const PRECURSOR_SHARE_CAP = 0.1;
/** Personal/echo-anchored offers: max share of the rolling 20.
 *  STARTING VALUE — playtest 0.35 vs 0.40 before pinning. */
export const PERSONAL_ECHO_CAP = 0.35;
/** An unoffered... unaccepted offer expires into a neglect echo. */
export const NEGLECT_DAYS = 2;
/** Record-growth bounds (the lab's "echo aging" follow-up, first cut). */
export const MAX_OFFERS_KEPT = 40;
export const MAX_ECHOES_KEPT = 60;
export const COOLDOWN_PRUNE_DAYS = 30;

// ── small helpers ──────────────────────────────────────────────────

type LenClass = 'short' | 'long';
const lenClassOf = (o: AsksOffer): LenClass =>
  o.steps.length <= 3 ? 'short' : 'long';

/** The anchor's biome family — the pacing anti-cluster key. */
function offerFamily(worldSeed: string, o: AsksOffer): string {
  const t = o.steps[0]?.target;
  if (t && t.domain === 'fauna') {
    const f = speciesFamily(t.id);
    if (f !== 'all') return f;
  }
  return zoneFacts(worldSeed, o.zx, o.zz).families[0];
}

function anchorTag(o: AsksOffer): string {
  const t = o.steps[0]?.target ?? { domain: 'none', id: 'none' };
  return `anchor:${nearKey(o.arc, t)}`;
}

/**
 * The player's questing profile. gearTier is EXPLORATION-gated, not
 * gear-gated: how far the player's zone visits have reached (0 while
 * in the hearthlands, 1 at 3+ hops out, 2 at 6+, 3 at 9+). It answers
 * the arcs' minGearTier honestly — "far country" sagas wait until
 * the player has actually walked far.
 */
export function profileForState(state: AsksBackState): GameProfile {
  let maxHops = 0;
  for (const key of Object.keys(state.events.zoneVisits)) {
    const [zx, zz] = key.split(',').map(Number);
    if (Number.isFinite(zx) && Number.isFinite(zz)) {
      maxHops = Math.max(maxHops, zoneHops(zx, zz));
    }
  }
  return {
    tag: state.owner || 'local',
    gearTier: Math.min(3, Math.floor(maxHops / 3)),
  };
}

/** Species the player has tamed that live in this zone's census —
 *  the Director's personal-anchor pool. */
function personalAnchors(
  state: AsksBackState,
  censusFauna: string[],
): Set<string> {
  const out = new Set<string>();
  for (const [sp, n] of Object.entries(state.events.tamed)) {
    if (n > 0 && censusFauna.includes(sp)) out.add(sp);
  }
  return out;
}

// ── the Director ───────────────────────────────────────────────────

export interface DirectorArgs {
  worldSeed: string;
  zx: number;
  zz: number;
  state: AsksBackState;
}

interface SelectedOffer {
  offer: AsksOffer;
  /** All cooldown tags to stamp (arc tags + the per-anchor tag). */
  cooldownTags: string[];
  /** The echo this offer consumed, if any. */
  echo: AsksEcho | null;
}

/**
 * Run the Director once. Pure: (worldSeed, zone, day, record) → the
 * next record, or the SAME record reference when nothing is owed —
 * so App's setState bails out and no render happens. Called on game-
 * day roll and zone entry, never per frame.
 */
export function runDirector(args: DirectorArgs): AsksBackState {
  const { worldSeed, zx, zz, state } = args;
  const day = asksGameDay(state);
  let offers = state.offers;
  let echoes = state.echoes;
  let cooldowns = state.cooldowns;
  let changed = false;

  // ── 1. housekeeping: ignored offers expire into neglect echoes ──
  // An offer the player never took up is not deleted — it becomes a
  // memory the world can ask about later (saga_echo_return, S3).
  const kept: AsksOffer[] = [];
  const freshEchoes: AsksEcho[] = [];
  for (const o of offers) {
    if (day - o.day >= NEGLECT_DAYS) {
      freshEchoes.push(
        writeEcho(worldSeed, {
          kind: 'neglected',
          day,
          zx: o.zx,
          zz: o.zz,
          suffix: o.id,
          owner: o.owner,
        }),
      );
    } else {
      kept.push(o);
    }
  }
  if (freshEchoes.length > 0) {
    echoes = [...echoes, ...freshEchoes];
    changed = true;
  }
  offers = kept;

  // ── 2. offer gates ──
  const activeCount = state.active.length;
  const offeredToday = offers.some((o) => o.day === day);
  if (activeCount < MAX_ACTIVE_SAGAS && !offeredToday) {
    const sel = selectOffer(worldSeed, zx, zz, day, state, offers);
    if (sel) {
      offers = [...offers, sel.offer];
      const stamped = sel.cooldownTags.map((tag) => ({ tag, day }));
      cooldowns = [...cooldowns, ...stamped];
      if (sel.echo) {
        echoes = echoes.map((e) =>
          e.id === sel.echo!.id
            ? { ...e, consumedBy: [...e.consumedBy, sel.offer.id] }
            : e,
        );
      }
      changed = true;
    }
  }

  if (!changed) return state;

  // ── 3. compaction: bound the record's growth ──
  if (offers.length > MAX_OFFERS_KEPT) offers = offers.slice(-MAX_OFFERS_KEPT);
  if (echoes.length > MAX_ECHOES_KEPT) echoes = echoes.slice(-MAX_ECHOES_KEPT);
  const pruned = cooldowns.filter((c) => day - c.day < COOLDOWN_PRUNE_DAYS);
  if (pruned.length !== cooldowns.length) cooldowns = pruned;

  return { ...state, offers, echoes, cooldowns };
}

function selectOffer(
  worldSeed: string,
  zx: number,
  zz: number,
  day: number,
  state: AsksBackState,
  offers: AsksOffer[],
): SelectedOffer | null {
  const zone = zoneFacts(worldSeed, zx, zz);
  const profile = profileForState(state);
  const zkey = `${zx},${zz}`;
  const removed = removedSet(state, zkey);
  const abundance = abundanceMap(state, zkey);
  const recent = offers.slice(-20);

  // ── pacing state from the offer history ──
  const last2 = offers.slice(-2);
  let forbidLen: LenClass | null = null;
  let forbidFam: string | null = null;
  if (last2.length === 2) {
    if (lenClassOf(last2[0]) === lenClassOf(last2[1]))
      forbidLen = lenClassOf(last2[0]);
    const f0 = offerFamily(worldSeed, last2[0]);
    if (f0 === offerFamily(worldSeed, last2[1])) forbidFam = f0;
  }
  let forceGeneric = false;
  if (recent.length >= 10) {
    const share =
      recent.filter((o) => o.echoUsed || o.personalUsed).length / recent.length;
    if (share >= PERSONAL_ECHO_CAP) forceGeneric = true;
  }
  const excludeArcs: string[] = [];
  if (recent.length > 0) {
    const share = recent.filter((o) => isPrecursorArc(o.arc)).length / recent.length;
    if (share >= PRECURSOR_SHARE_CAP) {
      for (const a of SAGA_ARCS) if (a.precursor) excludeArcs.push(a.id);
    }
  }

  const baseOpts: SagaOpts = {
    removed,
    abundance,
    excludeArcs,
    noAbstract: true,
  };
  const blocked = (tags: string[]): boolean =>
    tags.some((t) => {
      const window = t.startsWith('anchor:') ? ANCHOR_COOLDOWN_DAYS : OFFER_COOLDOWN_DAYS;
      return state.cooldowns.some((c) => c.tag === t && day - c.day < window);
    });
  const finalize = (
    offer: AsksOffer,
    echo: AsksEcho | null,
    personal: boolean,
  ): SelectedOffer => {
    if (personal) offer.personalUsed = true;
    if (echo) offer.echoUsed = { kind: echo.kind, echoId: echo.id };
    return {
      offer,
      cooldownTags: [...offer.cooldownTags, anchorTag(offer)],
      echo,
    };
  };
  const passes = (cand: AsksOffer): boolean => {
    if (blocked([...cand.cooldownTags, anchorTag(cand)])) return false;
    if (forbidFam && offerFamily(worldSeed, cand) === forbidFam) return false;
    return true;
  };
  const wantLen: 'short' | 'long' | undefined = forbidLen
    ? forbidLen === 'short'
      ? 'long'
      : 'short'
    : undefined;

  // ── (a) settled individuals anchor BY NAME ──
  // The round-3 rider: a released creature that settled in this zone
  // can come back as a named anchor without waiting for the echo
  // machinery. One attempt per evaluation; failure falls through to
  // the normal rotation.
  if (!forceGeneric) {
    const settled = settledIn(state, zkey).filter((s) => !removed.has(s.species));
    if (settled.length > 0) {
      const dice = new Dice(
        hashStringToSeed(`asks-settled-pick|${worldSeed}|${zkey}|${day}`),
      );
      for (const s of dice.shuffled(settled)) {
        const arcs = dice.shuffled(
          SAGA_ARCS.filter(
            (a) =>
              a.anchor.domain === 'fauna' &&
              !a.echoOnly &&
              !excludeArcs.includes(a.id),
          ),
        );
        for (const arc of arcs) {
          const cand = generateSaga(worldSeed, zx, zz, day, profile, state.owner, {
            ...baseOpts,
            arcId: arc.id,
            echoAnchor: {
              domain: 'fauna',
              id: s.species,
              name: s.name,
              individual: s.name,
            },
            salt: `settled-${s.id}`,
            forceSize: wantLen,
          });
          if (cand && passes(cand)) return finalize(cand, null, false);
        }
        break; // one settled individual attempted per evaluation
      }
    }
  }

  // ── (b) echo-first: an unconsumed memory in this zone ──
  // S3: the channel is live — echo_return passes the writer
  // registry now (chooseBranch/resolveBranch/echoResolve all
  // latch in latch.ts), so echoes written since S2 start are
  // eligible, and the offer wears its echo face via
  // applyEchoOverlay before it is stored.
  if (!forceGeneric) {
    const echo = echoForZone(state, zx, zz, day);
    if (echo) {
      const arcId = ECHO_ARC[echo.kind];
      if (arcId && !excludeArcs.includes(arcId)) {
        const ed = new Dice(hashStringToSeed(`asks-echochance|${echo.id}|${day}`));
        if (ed.chance(0.65)) {
          const ea = echoAnchorFor(echo);
          // A species-less echo anchors on the zone itself — by NAME,
          // not the raw "zx,zz" key, so the saga's faces read like
          // places, not coordinates. 'zone' is a concrete domain for
          // the abstract-anchor ban (the saga is about THIS place).
          if (ea.domain === 'zone') ea.name = zone.name;
          const inCensus =
            ea.domain === 'zone' ||
            ((zone.censusFauna.includes(ea.id) || zone.censusFlora.includes(ea.id)) &&
              !removed.has(ea.id));
          if (inCensus) {
            const raw = generateSaga(worldSeed, zx, zz, day, profile, state.owner, {
              ...baseOpts,
              arcId,
              echoAnchor: ea,
              salt: `echo-${echo.id}`,
              forceSize: wantLen,
            });
            // The overlay is pure and pre-pacing: the offer stored
            // is the echo-skinned one, so the log and tracker read
            // it exactly as the player will see it.
            const cand = raw ? applyEchoOverlay(worldSeed, raw, echo) : null;
            if (cand && passes(cand)) return finalize(cand, echo, false);
          }
        }
      }
    }
  }

  // ── (c) rotation with personal weighting ──
  const personal = personalAnchors(state, zone.censusFauna);
  const cands: AsksOffer[] = [];
  for (let i = 0; i < 6 && cands.length < 3; i++) {
    const cand = generateSaga(worldSeed, zx, zz, day, profile, state.owner, {
      ...baseOpts,
      salt: `saga-${i}`,
      forceSize: wantLen,
    });
    if (!cand || !passes(cand)) continue;
    cands.push(cand);
  }
  const pick =
    !forceGeneric && personal.size > 0
      ? cands.find((c) => {
          const t = c.steps[0]?.target;
          return t !== undefined && t.domain === 'fauna' && personal.has(t.id);
        })
      : undefined;
  const winner = pick ?? cands[0] ?? null;
  if (!winner) return null;
  return finalize(winner, null, winner === pick);
}
