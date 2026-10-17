/**
 * questStyles — the playstyle lens on the quest log (Adam, 2026-10-16).
 *
 * Adam asked for TABS in the Quest Log, one per playstyle, and for
 * thought about populating each. The standing law from
 * ReadMeFiles/PLAYER_STYLES.md still holds in full: NO lanes, no
 * tracks, no classes. Nobody picks a playstyle, ever. The tabs are
 * a LENS — seven ways of looking at the same quest list — and every
 * quest stays runnable, trackable, and completable from every tab
 * it appears in. A player can run all of them, or none.
 *
 * THE SEVEN (approved in PLAYER_STYLES.md): Green Thumb, Animal
 * Lovers, Explorers, Hunters, Builders, Socializers,
 * Completionists. The five brainstorm candidates (Xenobiologists,
 * Engineers, Homesteaders, Survivalists, Chroniclers) are NOT tabs
 * — they were never approved. Adding one later is one entry in
 * PLAYSTYLE_TABS plus map lines below; the door is built, it is
 * just not open.
 *
 * POPULATION MODEL: every quest has ONE primary style (the verb it
 * teaches, in its home tab) and may CROSS-LIST into others via
 * `also`. Completionists is not in the map at all: it is the
 * master ledger and shows every quest by definition — that IS the
 * playstyle.
 *
 * THE GAPS ARE CONTENT DIRECTION (for the dev lane's quest
 * brainstorming): today's 26 quests are gear-progression, so they
 * skew Explorers-heavy (Chapter 3 is literally "Eyes & Feet").
 * Animal Lovers has one quest, Hunters and Socializers none as
 * primary — the tabs make the skew visible on purpose. Their feeds
 * are known: the Culture Vat and companion quests grow Animal
 * Lovers; striker/weapon quests open the Hunters; co-op quests
 * open the Socializers. Per Adam, new quests should carry
 * precursor clues in their flavor — the Field Notes are the deep
 * layer; a quest's blurb can tease the fates before a note ever
 * unlocks.
 *
 * This file is the HUD lane's side of the contract: the dev lane
 * authors quests in quests.ts; a new quest joins a tab by adding
 * ONE line to QUEST_STYLE below (quest ids are the stable keys).
 */

export type PlayStyleId =
  | 'all'
  | 'green-thumb'
  | 'animal-lovers'
  | 'explorers'
  | 'hunters'
  | 'builders'
  | 'socializers'
  | 'completionists';

export interface PlayStyleTab {
  id: PlayStyleId;
  label: string;
  icon: string;
  /** The style's promise, in PLAYER_STYLES.md's own terms — shown
   *  under the tab bar so a tab reads as an invitation, not a lane. */
  promise: string;
  /** For tabs the current content barely feeds: an honest line
   *  naming what grows this tab, shown with its list (or alone,
   *  when the list is still empty). */
  comingSoon?: string;
}

export const PLAYSTYLE_TABS: PlayStyleTab[] = [
  {
    id: 'all',
    label: 'All Quests',
    icon: '📜',
    promise: 'The whole chain, in the order the game deepens.',
  },
  {
    id: 'green-thumb',
    label: 'Green Thumb',
    icon: '🌱',
    promise: 'Growing, fertilizing, and harvesting — the farming loop.',
  },
  {
    id: 'animal-lovers',
    label: 'Animal Lovers',
    icon: '🐾',
    promise: 'Taming, naming, and keeping companions.',
    comingSoon: 'The Culture Vat and the companion quests will grow this tab.',
  },
  {
    id: 'explorers',
    label: 'Explorers',
    icon: '🧭',
    promise: 'Seeing the world — eyes, feet, and the wild country.',
  },
  {
    id: 'hunters',
    label: 'Hunters',
    icon: '🎯',
    promise: 'Tracking and taking down creatures.',
    comingSoon: 'The hunt opens with the striker quests — they are being grown now.',
  },
  {
    id: 'builders',
    label: 'Builders',
    icon: '🏗️',
    promise: 'Raising a base — structures, storage, and the forge in your hand.',
  },
  {
    id: 'socializers',
    label: 'Socializers',
    icon: '👥',
    promise: 'Playing together — co-op sessions and shared building.',
    comingSoon: 'Co-op quests arrive with the multiplayer quest line.',
  },
  {
    id: 'completionists',
    label: 'Completionists',
    icon: '🏆',
    promise: 'Every quest, every note — the master ledger.',
  },
];

/**
 * The population map: quest id → its primary style tab, plus any
 * cross-listings. Chapter 1 teaches verbs, Chapter 2 the forge and
 * the far eye, Chapter 3 is eyes & feet — so the traversal and
 * vision gear lands in Explorers, the pack line rides with them
 * (a pack is journey gear), and the crafting heartlands sit with
 * Builders and Green Thumb.
 */
export const QUEST_STYLE: Record<string, { primary: PlayStyleId; also?: PlayStyleId[] }> = {
  // Chapter 1 — the verbs
  q_first_harvest: { primary: 'green-thumb' },
  q_pouch: { primary: 'explorers' },
  q_satchel: { primary: 'explorers' },
  q_storage: { primary: 'builders' },
  q_scanner: { primary: 'explorers', also: ['green-thumb'] },
  q_planter: { primary: 'green-thumb' },
  q_builder: { primary: 'builders' },
  q_solvent: { primary: 'green-thumb' },
  q_lure: { primary: 'animal-lovers' },
  // Chapter 2 — the forge and the far eye
  q_field_synthesis: { primary: 'builders' },
  q_radar: { primary: 'explorers' },
  q_lifefinder: { primary: 'explorers', also: ['hunters'] },
  q_rucksack: { primary: 'explorers' },
  // Chapter 3 — eyes & feet
  q_helm: { primary: 'explorers' },
  q_trail_lens: { primary: 'explorers' },
  q_quicksteps: { primary: 'explorers' },
  q_waders: { primary: 'explorers' },
  q_stillsteps: { primary: 'explorers' },
  q_webfoots: { primary: 'explorers' },
  q_ember_soles: { primary: 'explorers' },
  q_spore_filter: { primary: 'explorers' },
  q_biolume_visor: { primary: 'explorers' },
  q_shade_visor: { primary: 'explorers' },
  q_identifier: { primary: 'explorers' },
  q_glyph_lens: { primary: 'explorers' },
  q_charge_sight: { primary: 'explorers' },
};

/** Does this quest appear under this style tab? 'all' and
 *  'completionists' are the whole ledger; anything else is the
 *  primary tab plus cross-listings. A quest missing from the map
 *  appears only in the ledger tabs until it is assigned — visible
 *  everywhere it matters, filed nowhere wrong. */
export const questInStyle = (questId: string, style: PlayStyleId): boolean => {
  if (style === 'all' || style === 'completionists') return true;
  const entry = QUEST_STYLE[questId];
  if (!entry) return false;
  return entry.primary === style || (entry.also?.includes(style) ?? false);
};
