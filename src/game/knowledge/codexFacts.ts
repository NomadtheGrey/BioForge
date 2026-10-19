/**
 * CODEX FACTS — the numbers, derived (the reconciliation's
 * structural cure, Adam's ruling 2026-10-19; census:
 * goals/bioforge-debugging/files/codex-prose-census.md).
 *
 * The disease this cures: codex prose used to RE-TYPE the defs'
 * numbers (~360 hand-copied figures across tamingOrCraftNotes —
 * tame %, bite damage, baits, yields). The census found every one
 * of the 127 numbered entries maps 1:1 to a def carrying the same
 * numbers as FIELDS, and zero disagreements today: the twins are
 * healthy but guaranteed to drift on the next balance edit.
 *
 * So the actionable numbers are no longer typed anywhere. This
 * pure derivation reads them from the defs of record at render:
 *   fauna — SPECIES ∪ SPECIES_LATE (creatures/species*.ts):
 *           tameChance, bait, hunt (damage/ranges), byproduct,
 *           killLoot.
 *   flora — FLORA (flora/flora.ts): the harvest table, and the
 *           propagation route via flora/propagation.ts (itself
 *           the one derivation the planter/solvent/harvest read).
 * The prose keeps its VOICE (behavior, story, where the supply
 * begins); this strip carries the FIGURES. The prose diet that
 * follows this landing removes the re-typed numbers from the
 * notes, and from then on a balance edit changes the codex the
 * moment it changes the def — there is no twin left to stale.
 *
 * Wording follows the tutorial bar: plain words a 12-year-old
 * can act on. Facts the def doesn't carry are simply absent —
 * the strip never invents.
 */
import type { CodexEntry, FloraSpecies, ItemId } from '../../types/game';
import { ITEMS } from '../items/constants';
import { SPECIES, type SpeciesDef } from '../creatures/species';
import { SPECIES_LATE } from '../creatures/speciesLate';
import { FLORA, type FloraDef } from '../flora/flora';
import { propaguleItemOf, propagatesBySeed } from '../flora/propagation';

export interface CodexFact {
  label: string;
  value: string;
}

const itemName = (id: ItemId): string => ITEMS[id]?.name ?? id;

/**
 * BESPOKE TAMING — flows the def fields cannot express (the
 * verify-pass correction, 2026-10-19). Some courtships are wired
 * OUTSIDE tameChance/bait: the Hearth Dog's is a bespoke branch
 * in useToolInteractions (slice 39's hearthFeed) — three meals on
 * the lure, at the dog's pace — while its def fields read null.
 * The null default below ("Cannot be lured") is the truth for
 * everything else, but printing it for the dog was the strip's
 * one false statement: the dog is the game's most winnable
 * heart. So species with a bespoke flow are keyed here, and this
 * map is consulted BEFORE the field derivation. Texts are
 * certified by the creatures chair (the truth source for what
 * is wired); this map is where future bespoke flows (the
 * census's mouse/bear class) get their honest line the day
 * they wire.
 */
const BESPOKE_TAMING: Record<string, string> = {
  hearth_dog:
    'Won by offerings — three meals on the lure, at its pace; then it decides',
};

/** The fauna def of record for a species id, across both tables. */
export function faunaDefOf(species: string): SpeciesDef | null {
  return (
    (SPECIES as Record<string, SpeciesDef>)[species] ??
    SPECIES_LATE[species] ??
    null
  );
}

/** The flora def of record for a species id. */
export function floraDefOf(species: string): FloraDef | null {
  return FLORA[species] ?? null;
}

/** Bait, in the words the player acts on. The bespoke flows are
 *  named as what they are — never dressed as an item. */
function baitWords(def: SpeciesDef): string | null {
  switch (def.bait) {
    case 'nectar':
      return 'Sweet Nectar, on the lure';
    case 'heart_sap':
      return 'an offering of Heart Sap';
    case 'predator':
      return "a stalker's own offering — the notes tell it";
    default:
      return null;
  }
}

function faunaFacts(def: SpeciesDef): CodexFact[] {
  const facts: CodexFact[] = [];
  // Taming — the chance and the bait are the two facts a tamer
  // plans around. A bespoke flow (above) speaks first; then the
  // fields; an unlureable species says so plainly.
  const bespoke = BESPOKE_TAMING[def.id];
  if (bespoke) {
    facts.push({ label: 'Taming', value: bespoke });
  } else if (def.tameChance != null) {
    const pct = Math.round(def.tameChance * 100);
    const bait = baitWords(def);
    facts.push({
      label: 'Taming',
      value: `${pct}% per offering${bait ? ` · bait: ${bait}` : ''}`,
    });
  } else {
    facts.push({ label: 'Taming', value: 'Cannot be lured' });
  }
  // Danger — the hunt spec, where one exists.
  if (def.hunt) {
    facts.push({
      label: 'Danger',
      value:
        `Bite ${def.hunt.damage}` +
        (def.hunt.provokedOnly ? ' · strikes only when provoked' : ''),
    });
    facts.push({
      label: 'Reach',
      value: `notices you at ${def.hunt.aggroRange} m · bites inside ${def.hunt.biteRange} m`,
    });
  }
  // The shed — what it leaves, how often, and whose it is.
  if (def.byproduct) {
    facts.push({
      label: 'Sheds',
      value:
        `${itemName(def.byproduct.item)} · every ~${def.byproduct.seconds} s` +
        (def.byproduct.tamedOnly ? ' · tamed only' : ' · wild and tamed'),
    });
  }
  // Fell drops — on top of the universal sample (the def's own
  // contract), so the strip says "beside its sample".
  if (def.killLoot && def.killLoot.length > 0) {
    facts.push({
      label: 'When felled',
      value:
        def.killLoot.map(([id, n]) => `${itemName(id)} ×${n}`).join(' · ') +
        ' · beside its sample',
    });
  }
  return facts;
}

function floraFacts(def: FloraDef, species: string): CodexFact[] {
  const facts: CodexFact[] = [];
  // The harvest — what a glove takes, and what feeding adds.
  if (def.harvest) {
    const h = def.harvest;
    let value = `${itemName(h.item)} ×${h.count}`;
    if (h.fertilizedCount !== h.count) {
      value += ` · ×${h.fertilizedCount} when fed`;
    }
    if (h.extras && h.extras.length > 0) {
      value +=
        ' · also ' +
        h.extras.map(([id, n]) => `${itemName(id)} ×${n}`).join(', ');
    }
    facts.push({ label: 'Harvest', value });
  }
  // The planting route — read through flora/propagation.ts, the
  // one reader every other surface (planter, solvent, harvest
  // roll) already trusts; this strip joins them rather than
  // re-interpreting the field.
  if (propagatesBySeed(species as FloraSpecies)) {
    facts.push({
      label: 'Planting',
      value: 'By seed — a glove harvest rolls 0–2 seeds',
    });
  } else {
    const piece = propaguleItemOf(species as FloraSpecies);
    if (piece) {
      facts.push({
        label: 'Planting',
        value: `By a piece of itself — ${itemName(piece)}; dissolve a plant to take the piece`,
      });
    } else if (def.propagation === null) {
      facts.push({
        label: 'Planting',
        value: 'Wild only — it cannot be planted',
      });
    }
  }
  return facts;
}

/**
 * The derived facts for one codex entry, in display order.
 * Composite (structure) entries carry no def — no facts.
 * An entry whose species has no def (should not happen; the
 * census found no ghosts) yields an empty strip, never a guess.
 */
export function codexFactsFor(entry: CodexEntry): CodexFact[] {
  if (entry.type === 'fauna') {
    const def = faunaDefOf(entry.species);
    return def ? faunaFacts(def) : [];
  }
  if (entry.type === 'flora') {
    const def = floraDefOf(entry.species);
    return def ? floraFacts(def, entry.species) : [];
  }
  return [];
}
