// =====================================================================
// THE WORLD ASKS BACK — step latching (S3, 2026-10-16)
// =====================================================================
//
// The evaluator that makes offered sagas PLAYABLE. It reads active
// sagas against the S1/S2 event ledger and advances (or completes)
// them — pure, cheap (active sagas only, ≤ MAX_ACTIVE_SAGAS), called
// on ledger/day/zone changes, never per frame.
//
// THE BASELINE CONTRACT: a step latches on what happened DURING the
// step, not before it. When a step becomes current, the evaluator
// snapshots the counters its goal reads (the stepStart record);
// the next evaluation compares. Day-keyed signals (surveyed spaces,
// weather stamps, zone visits) need no snapshot — the step's start
// day is the baseline. A step is baselined on one tick and can latch
// on the next, so no single evaluation both starts and finishes a
// step: at most one advance per saga per call.
//
// LATCH SOURCES per goal:
//   PROPOSED counters (witness/tame/feed/cull/sample/harvest/plant/
//   build)  → event-counter deltas since the step started.
//   surveyPoints → surveyedSpaces with firstDay >= step start day.
//   weatherWitness → weatherWitnessed[offer zone].mode matches AND
//     the stamp's day >= step start day ("stood in it" must happen
//     during the step).
//   revisitZone → zoneVisits[key].lastDay >= stepDay + afterDays
//     (the player's current zone counts as visited today — the
//     spawn zone never gets a crossing stamp).
//   itemCount → the pouch right now (having the items IS the goal).
//   chooseBranch → the choice recorded in events.choices.
//   resolveBranch → the chosen branch's observed action: cull of
//     the named hunter, or witnessing the anchor species after the
//     choice ("stand with the herd" = be there with them).
//   echoResolve → the consumed echo's asked action at its anchor:
//     neglected/other = went back; deadAnchor = came back a LATER
//     day (slept on it); released_settled = witnessed the settled
//     species since the step started.
//   KNOWN (ruinEnter/glyphRuins/heart/zoneHybrid/zoneTier3) → the
//   authored QuestSignals lists/flags, delta'd like counters.
//   KNOWN itemCount → the pouch.
//
// COMPLETION: the final step's latch marks the saga complete —
// rewards grant through the ordinary gain (App applies them, so
// pouch caps and overflow drops apply as anywhere else), the
// resolution writes into events.resolutions, zone consequences go
// through zoneState's helpers (S4 applies them at generation), and
// an echo-consumed saga writes an 'answered' echo so the ledger
// closes honestly. A dead anchor (the anchor species culled
// mid-saga) fails the saga into a 'deadAnchor' memorial echo
// instead of completing it.

import {
  type AsksBackState,
  type AsksInstance,
  type AsksStep,
  asksGameDay,
} from '../asksBackState';
import type { QuestSignals } from '../../types/game';
import { writeEcho } from './echoes';
import { shiftAbundance, zoneConsequences } from './zoneState';
import { MAX_ACTIVE_SAGAS } from './director';

/** What the evaluator needs from App — the world outside the record. */
export interface LatchContext {
  worldSeed: string;
  /** Current surface zone key ("zx,zz") — for revisit honesty. */
  zoneKey: string;
  signals?: QuestSignals;
  /** Flat pouch counts (itemId → count). */
  inventory: Record<string, number>;
  /** Display names for item ids (the modal/tracker line). */
  itemName?: (id: string) => string;
}

/** Resolve the signal's ledger map + id from its detail. */
function counterTarget(
  signal: string,
  detail: Record<string, unknown>,
): { map: 'witnessed' | 'tamed' | 'fed' | 'culled' | 'sampled' | 'harvestedFlora' | 'plantedFlora'; id: string } | null {
  const id = (detail.species ?? detail.flora) as string | undefined;
  if (!id) return null;
  switch (signal) {
    case 'witnessFauna':
    case 'witnessFlora':
      return { map: 'witnessed', id };
    case 'tameFauna':
      return { map: 'tamed', id };
    case 'feedFauna':
      return { map: 'fed', id };
    case 'cullFauna':
      return { map: 'culled', id };
    case 'sampleFauna':
      return { map: 'sampled', id };
    case 'harvestFlora':
      return { map: 'harvestedFlora', id };
    case 'plantFlora':
      return { map: 'plantedFlora', id };
    default:
      return null;
  }
}

function baseKey(signal: string, map: string, id: string): string {
  return `ev:${map}:${id}`;
}

/** The baseline snapshot a step's goal needs at step start. */
function baselinesFor(
  step: AsksStep,
  inst: AsksInstance,
  state: AsksBackState,
  signals: QuestSignals | undefined,
  choice: string | undefined,
): Record<string, number> {
  const base: Record<string, number> = {};
  const g = step.goal;
  if (g.kind === 'PROPOSED') {
    const { signal, detail } = g;
    if (signal === 'resolveBranch' && choice) {
      const [kind, id] = choice.split(':');
      if (kind === 'cull' && id) base[`ev:culled:${id}`] = state.events.culled[id] ?? 0;
      else {
        const anchorId = id === 'herd' || !id ? ((detail.anchor as string) ?? step.target.id) : id;
        base[`ev:witnessed:${anchorId}`] = state.events.witnessed[anchorId] ?? 0;
      }
      return base;
    }
    if (signal === 'echoResolve') {
      // A released_settled echo's asked action is witnessing the
      // settled species again — baseline it so only sightings
      // during the step count. (released_settled echoes arrive
      // in S4; the key is dormant until then.)
      const echo = state.echoes.find((e) => e.id === inst.echoUsed?.echoId);
      if (echo?.species)
        base[`ev:witnessed:${echo.species}`] = state.events.witnessed[echo.species] ?? 0;
      return base;
    }
    const t = counterTarget(signal, detail);
    if (t) base[baseKey(signal, t.map, t.id)] = (state.events[t.map] as Record<string, number>)[t.id] ?? 0;
    if (signal === 'buildStructure')
      base['ev:build:any'] = Object.values(state.events.builtStructures).reduce((s, n) => s + n, 0);
    return base;
  }
  const goal = g.goal as Record<string, unknown>;
  switch (goal.kind) {
    case 'ruinEnter':
      base['sig:ruins'] = signals?.ruins?.length ?? 0;
      break;
    case 'glyphRuins':
      base['sig:glyphRuins'] = signals?.glyphRuins?.length ?? 0;
      break;
    // heart / zoneHybrid / zoneTier3 are STICKY booleans — once the
    // player has stood there, the goal state holds. They latch on
    // true with no baseline (the Ask the World line's own rule:
    // "the latch still honors a goal met early"). Counters and
    // lists stay step-relative; states do not.
  }
  return base;
}

/** A goal's latch state: done/need for the progress line. */
export interface GoalStatus {
  satisfied: boolean;
  done: number;
  need: number;
  unit: string;
}

function status(satisfied: boolean, done: number, need: number, unit: string): GoalStatus {
  return { satisfied, done, need, unit };
}

function checkGoal(
  step: AsksStep,
  inst: AsksInstance,
  state: AsksBackState,
  ctx: LatchContext,
  base: Record<string, number>,
  stepDay: number,
): GoalStatus {
  const day = asksGameDay(state);
  const g = step.goal;
  // ── PROPOSED signals ──
  if (g.kind === 'PROPOSED') {
    const { signal, detail } = g;
    const need = (detail.count as number | undefined) ?? 1;
    const counter = counterTarget(signal, detail);
    if (counter) {
      const map = state.events[counter.map] as Record<string, number>;
      const done = (map[counter.id] ?? 0) - (base[baseKey(signal, counter.map, counter.id)] ?? 0);
      return status(done >= need, Math.max(0, done), need, step.target.name || 'done');
    }
    switch (signal) {
      case 'buildStructure': {
        const have = Object.values(state.events.builtStructures).reduce((s, n) => s + n, 0);
        const done = have - (base['ev:build:any'] ?? 0);
        return status(done >= 1, Math.max(0, done), 1, 'grown');
      }
      case 'surveyPoints': {
        const walked = Object.values(state.events.surveyedSpaces ?? {}).filter(
          (d) => d >= stepDay,
        ).length;
        return status(walked >= need, walked, need, 'spaces walked');
      }
      case 'weatherWitness': {
        const mode = detail.mode as string | undefined;
        const w = (state.events.weatherWitnessed ?? {})[inst.zoneKey];
        const ok = !!mode && !!w && w.mode === mode && w.day >= stepDay;
        return status(ok, ok ? 1 : 0, 1, `${mode ?? 'named'} weather`);
      }
      case 'revisitZone': {
        const after = (detail.afterDays as number | undefined) ?? 0;
        const key = `${detail.zx},${detail.zz}`;
        const v = state.events.zoneVisits[key];
        // The player is HERE now: the current zone counts as visited
        // today (the spawn zone never gets a crossing stamp).
        const last = Math.max(v?.lastDay ?? -1, key === ctx.zoneKey ? day : -1);
        const done = Math.max(0, Math.min(after, last - stepDay));
        return status(last >= stepDay + after, done, after, 'days');
      }
      case 'chooseBranch': {
        const made = state.events.choices[inst.id] !== undefined;
        return status(made, made ? 1 : 0, 1, 'choice');
      }
      case 'resolveBranch': {
        const choice = state.events.choices[inst.id];
        if (!choice) return status(false, 0, 1, 'resolved');
        const [kind, id] = choice.split(':');
        if (kind === 'cull' && id) {
          const done = (state.events.culled[id] ?? 0) - (base[`ev:culled:${id}`] ?? 0);
          return status(done >= 1, Math.max(0, done), 1, `${step.target.name || 'hunter'} culled`);
        }
        const anchorId = id === 'herd' || !id ? ((detail.anchor as string) ?? step.target.id) : id;
        const done = (state.events.witnessed[anchorId] ?? 0) - (base[`ev:witnessed:${anchorId}`] ?? 0);
        return status(done >= 1, Math.max(0, done), 1, 'stood with them');
      }
      case 'echoResolve': {
        const used = inst.echoUsed;
        if (!used) return status(false, 0, 1, 'answered');
        const echo = state.echoes.find((e) => e.id === used.echoId);
        if (!echo) return status(false, 0, 1, 'answered');
        const v = state.events.zoneVisits[echo.zoneKey];
        const last = Math.max(v?.lastDay ?? -1, echo.zoneKey === ctx.zoneKey ? day : -1);
        switch (echo.kind) {
          case 'deadAnchor':
            // Slept on it: back on a LATER day than the step began.
            return status(last > stepDay, last > stepDay ? 1 : 0, 1, 'marked');
          case 'released_settled': {
            if (!echo.species) return status(last >= stepDay, last >= stepDay ? 1 : 0, 1, 'answered');
            const done =
              (state.events.witnessed[echo.species] ?? 0) -
              (base[`ev:witnessed:${echo.species}`] ?? 0);
            return status(done >= 1, Math.max(0, done), 1, 'seen again');
          }
          default:
            // neglected / other: going back, on purpose, is the answer.
            return status(last >= stepDay, last >= stepDay ? 1 : 0, 1, 'answered');
        }
      }
      default:
        return status(false, 0, 1, 'done');
    }
  }
  // ── KNOWN goal kinds (the authored vocabulary, via QuestSignals) ──
  const goal = g.goal as Record<string, unknown>;
  switch (goal.kind) {
    case 'ruinEnter': {
      const done = (ctx.signals?.ruins?.length ?? 0) - (base['sig:ruins'] ?? 0);
      return status(done >= 1, Math.max(0, done), 1, 'ruin entered');
    }
    case 'glyphRuins': {
      const need = (goal.count as number | undefined) ?? 1;
      const done = (ctx.signals?.glyphRuins?.length ?? 0) - (base['sig:glyphRuins'] ?? 0);
      return status(done >= need, Math.max(0, done), need, 'glyphs read');
    }
    case 'heart': {
      const ok = ctx.signals?.heart === true;
      return status(ok, ok ? 1 : 0, 1, 'heart reached');
    }
    case 'zoneHybrid': {
      const ok = ctx.signals?.hybrid === true;
      return status(ok, ok ? 1 : 0, 1, 'margin stood in');
    }
    case 'zoneTier3': {
      const ok = ctx.signals?.tier3 === true;
      return status(ok, ok ? 1 : 0, 1, 'far country');
    }
    case 'itemCount': {
      const itemId = goal.itemId as string;
      const need = (goal.count as number | undefined) ?? 1;
      const have = ctx.inventory[itemId] ?? 0;
      return status(have >= need, Math.min(have, need), need, ctx.itemName?.(itemId) ?? itemId);
    }
    default:
      return status(false, 0, 1, 'done');
  }
}

/**
 * The human progress line for a step — the SAME math the latch
 * uses, so the card and the tracker never lie about the goal.
 */
export function goalProgressText(
  step: AsksStep,
  inst: AsksInstance,
  state: AsksBackState,
  ctx: LatchContext,
): string {
  const ss = inst.stepStart;
  const stepDay = ss && ss.n === inst.currentStep ? ss.day : inst.startDay;
  const st = checkGoal(step, inst, state, ctx, ss?.base ?? {}, stepDay);
  const g = step.goal;
  if (g.kind === 'PROPOSED') {
    switch (g.signal) {
      case 'surveyPoints':
        return `${st.done}/${st.need} spaces walked`;
      case 'weatherWitness':
        return st.satisfied ? `Stood in ${st.unit} ✓` : `Be out in ${st.unit}`;
      case 'revisitZone': {
        const after = (g.detail.afterDays as number | undefined) ?? 0;
        return st.satisfied
          ? 'Returned ✓'
          : `Return to ${inst.zoneName} on day ${stepDay + after} or later`;
      }
      case 'chooseBranch':
        return 'Choose — cull the hunter, or protect the herd';
      case 'resolveBranch':
        return st.satisfied ? `${st.unit} ✓` : `Do what you chose — ${st.unit}`;
      case 'echoResolve':
        return st.satisfied ? 'Answered ✓' : 'Answer it at the anchor';
      case 'buildStructure':
        return st.satisfied ? 'Grown ✓' : 'Grow a structure at home';
      default:
        return st.satisfied
          ? `${st.unit} ✓`
          : `${st.done}/${st.need} ${st.unit}`;
    }
  }
  const goal = g.goal as Record<string, unknown>;
  switch (goal.kind) {
    case 'ruinEnter':
      return st.satisfied ? 'Ruin entered ✓' : 'Step inside the ruin';
    case 'glyphRuins':
      return `${st.done}/${st.need} glyphs read`;
    case 'heart':
      return st.satisfied ? 'Heart reached ✓' : 'Find the heart room';
    case 'zoneHybrid':
      return st.satisfied ? 'Margin stood in ✓' : 'Stand in the margin';
    case 'zoneTier3':
      return st.satisfied ? 'Far country stood in ✓' : 'Stand in tier-3 country';
    case 'itemCount':
      return st.satisfied ? `${st.unit} ✓` : `${st.done}/${st.need} ${st.unit}`;
    default:
      return st.satisfied ? 'Done ✓' : 'In progress';
  }
}

/** Choice buttons for a choice step: the option value + its face. */
export function choiceLabels(
  inst: AsksInstance,
  step: AsksStep,
): { value: string; label: string }[] {
  const g = step.goal;
  if (g.kind !== 'PROPOSED' || g.signal !== 'chooseBranch') return [];
  const options = (g.detail.options as string[] | undefined) ?? [];
  const anchorName =
    inst.steps.find((s) => s.beat === 'anchor')?.target.name ?? 'the herd';
  return options.map((opt) => {
    const [kind, id] = opt.split(':');
    if (kind === 'cull')
      return { value: opt, label: `Cull the ${step.target.name || 'hunter'}` };
    return {
      value: opt,
      label: id === 'herd' || !id ? `Protect ${anchorName}` : `Protect the ${anchorName}`,
    };
  });
}

/** Can the player take up another offer right now? */
export function canAcceptSaga(state: AsksBackState): boolean {
  return state.active.filter((a) => a.status === 'active').length < MAX_ACTIVE_SAGAS;
}

/**
 * Take up an offer: it leaves the offered list and becomes the
 * current work. Pure; returns the SAME record when the offer is
 * gone or the active roster is full (App reads that as "no").
 */
export function acceptAsksOffer(
  prev: AsksBackState,
  offerId: string,
): AsksBackState {
  const offer = prev.offers.find((o) => o.id === offerId);
  if (!offer || !canAcceptSaga(prev)) return prev;
  const day = asksGameDay(prev);
  const inst: AsksInstance = {
    ...offer,
    status: 'active',
    currentStep: 0,
    startDay: day,
    stepStart: undefined, // baselined on the first evaluation
  };
  return {
    ...prev,
    offers: prev.offers.filter((o) => o.id !== offerId),
    active: [...prev.active, inst],
  };
}

/** Pin a saga to the HUD tracker (null = unpin). */
export function trackAsksSaga(prev: AsksBackState, sagaId: string | null): AsksBackState {
  if ((prev.tracked ?? null) === sagaId) return prev;
  return { ...prev, tracked: sagaId };
}

export interface LatchOutcome {
  state: AsksBackState;
  /** Rewards to grant through the ordinary gain (App applies). */
  grants: { itemId: string; count: number }[];
  advanced: { sagaId: string; title: string; stepTitle: string }[];
  completed: { sagaId: string; title: string; zoneName: string }[];
  deadAnchors: { sagaId: string; name: string; zoneName: string }[];
}

/**
 * Evaluate every active saga once. Advances at most one step per
 * saga; completes, fails (dead anchor), or re-baselines as the
 * ledger dictates. Pure and idempotent — returns the SAME record
 * reference when nothing changed, so App's setState bails out.
 */
export function evaluateAsks(
  prev: AsksBackState,
  ctx: LatchContext,
): LatchOutcome {
  const day = asksGameDay(prev);
  let active = prev.active;
  let events = prev.events;
  let echoes = prev.echoes;
  let zoneState = prev.zoneState;
  let completed = prev.completed;
  let tracked = prev.tracked ?? null;
  let changed = false;
  const grants: LatchOutcome['grants'] = [];
  const advanced: LatchOutcome['advanced'] = [];
  const finished: LatchOutcome['completed'] = [];
  const deadAnchors: LatchOutcome['deadAnchors'] = [];

  // A tracked saga that is no longer active unpins itself.
  if (tracked && !active.some((a) => a.id === tracked && a.status === 'active')) {
    tracked = null;
    changed = true;
  }

  const nextActive: AsksInstance[] = [];
  for (const inst of active) {
    if (inst.status !== 'active') {
      nextActive.push(inst);
      continue;
    }
    const step = inst.steps[inst.currentStep];

    // ── dead anchor: the anchor species was culled mid-saga ──
    // Species-level, honest: the ledger counts kills by species,
    // so "the {Species} is dead" means one of them died after the
    // saga began. The saga fails into a memorial echo — the
    // absence has a shape, and the world can ask about it later.
    const anchor = step ? inst.steps[0]?.target : undefined;
    const anchorDied =
      anchor?.domain === 'fauna' &&
      (prev.events.lastCullDay?.[anchor.id] ?? -1) >= inst.startDay;
    if (anchorDied && anchor) {
      const echo = writeEcho(ctx.worldSeed, {
        kind: 'deadAnchor',
        day,
        zx: inst.zx,
        zz: inst.zz,
        species: anchor.id,
        suffix: inst.id,
        owner: inst.owner,
      });
      echoes = [...echoes, echo];
      events = {
        ...events,
        resolutions: { ...events.resolutions, [inst.id]: 'deadAnchor' },
      };
      deadAnchors.push({ sagaId: inst.id, name: anchor.name, zoneName: inst.zoneName });
      changed = true;
      if (tracked === inst.id) tracked = null;
      continue; // the saga leaves the active list
    }

    // A step index past the end is a data bug — complete rather
    // than strand the saga (rewards still grant).
    if (!step) {
      const done = completeSaga(inst, prev, day, ctx);
      completed = [...completed, { id: inst.id, day, title: inst.title, zoneName: inst.zoneName }];
      grants.push(...done.grants);
      finished.push({ sagaId: inst.id, title: inst.title, zoneName: inst.zoneName });
      events = done.events;
      echoes = done.echoes;
      zoneState = done.zoneState;
      changed = true;
      if (tracked === inst.id) tracked = null;
      continue;
    }

    // ── baseline: the step's first evaluation snapshots counters ──
    const ss = inst.stepStart;
    if (!ss || ss.n !== inst.currentStep) {
      nextActive.push({
        ...inst,
        stepStart: {
          n: inst.currentStep,
          day,
          base: baselinesFor(step, inst, prev, ctx.signals, events.choices[inst.id]),
        },
      });
      changed = true;
      continue;
    }

    // ── latch ──
    const st = checkGoal(step, inst, prev, ctx, ss.base, ss.day);
    if (!st.satisfied) {
      nextActive.push(inst);
      continue;
    }
    if (inst.currentStep >= inst.steps.length - 1) {
      const done = completeSaga(inst, { ...prev, events, echoes, zoneState }, day, ctx);
      completed = [...completed, { id: inst.id, day, title: inst.title, zoneName: inst.zoneName }];
      grants.push(...done.grants);
      finished.push({ sagaId: inst.id, title: inst.title, zoneName: inst.zoneName });
      events = done.events;
      echoes = done.echoes;
      zoneState = done.zoneState;
      changed = true;
      if (tracked === inst.id) tracked = null;
      continue;
    }
    const next = inst.steps[inst.currentStep + 1];
    nextActive.push({ ...inst, currentStep: inst.currentStep + 1, stepStart: undefined });
    advanced.push({ sagaId: inst.id, title: inst.title, stepTitle: next?.title ?? '' });
    changed = true;
  }

  if (!changed) {
    return {
      state: prev,
      grants: [],
      advanced: [],
      completed: [],
      deadAnchors: [],
    };
  }
  return {
    state: {
      ...prev,
      active: nextActive,
      events,
      echoes,
      zoneState,
      completed,
      tracked,
    },
    grants,
    advanced,
    completed: finished,
    deadAnchors,
  };
}

/** Complete a saga: rewards, resolution record, consequences. */
function completeSaga(
  inst: AsksInstance,
  state: AsksBackState,
  day: number,
  ctx: LatchContext,
): {
  grants: { itemId: string; count: number }[];
  events: AsksBackState['events'];
  echoes: AsksBackState['echoes'];
  zoneState: AsksBackState['zoneState'];
} {
  const grants = inst.reward.items.map((i) => ({ itemId: i.itemId, count: i.count }));
  const events: AsksBackState['events'] = {
    ...state.events,
    resolutions: { ...state.events.resolutions, [inst.id]: 'completed' },
  };
  let echoes = state.echoes;
  let zoneState = state.zoneState;

  // Zone consequences, through the S2 write helpers (S4 applies
  // them where zones generate). Keyed on the resolution beat's
  // goal, plus the pack_pressure branch choice.
  const res = inst.steps.find((s) => s.beat === 'resolution');
  if (res) {
    const zc = zoneConsequences({ ...state, zoneState }, inst.zoneKey);
    let next = zc;
    const g = res.goal;
    if (g.kind === 'PROPOSED') {
      if (g.signal === 'plantFlora' && typeof g.detail.flora === 'string') {
        next = shiftAbundance(next, g.detail.flora, 1.5);
      } else if (g.signal === 'resolveBranch') {
        const choice = state.events.choices[inst.id];
        const [kind, id] = (choice ?? '').split(':');
        if (kind === 'cull' && id) {
          // The hunter thins — not extinct, just answered.
          next = shiftAbundance(next, id, 0.5);
        } else {
          // The herd thrives under protection.
          const anchorId =
            id === 'herd' || !id
              ? ((g.detail.anchor as string) ?? res.target.id)
              : id;
          next = shiftAbundance(next, anchorId, 1.5);
        }
      }
    }
    if (next !== zc) zoneState = { ...zoneState, [inst.zoneKey]: next };
  }

  // An echo-consumed saga closes the ledger: the 'answered' echo
  // is terminal and species-less ones never reseed ("answered
  // echoes stay answered" — the lab's degenerate-loop fix).
  if (inst.echoUsed) {
    const consumed = state.echoes.find((e) => e.id === inst.echoUsed!.echoId);
    echoes = [
      ...echoes,
      writeEcho(ctx.worldSeed, {
        kind: 'answered',
        day,
        zx: inst.zx,
        zz: inst.zz,
        species: consumed?.species,
        flora: consumed?.flora,
        suffix: inst.id,
        owner: inst.owner,
      }),
    ];
  }
  return { grants, events, echoes, zoneState };
}
