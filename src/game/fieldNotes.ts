// =====================================================================
// FIELD NOTES — the discovery layer for the one-offs
// (creature slice 46, 2026-10-16; Adam's discoverability concern)
// =====================================================================
//
// THE PROBLEM THIS FILE EXISTS TO SOLVE: the bespoke one-off
// behaviors — the hermit's dawn gift, the bear's rent, the wisp's
// certification — are invisible to a player who doesn't already
// know them. A mechanic nobody can discover is a rumor, not a
// feature. Adam's idea (2026-10-16): a category in the quest log
// carrying a little italic clue per unique being. This file is
// the DATA for that category; the wiring (quest-log UI, scan
// unlock, witness stamps) is the dev chat's lane, specced at the
// bottom of this header.
//
// THE SHAPE OF A NOTE:
//   - `species` — the 1:1 key for most notes. A note UNLOCKS the
//     first time the player SCANS that species (the bio-scanner
//     is the game's discovery verb; the codex's `discovered`
//     flag flips on the same event, so the wiring can key off
//     it).
//   - `anyOf` — for GROUP notes: one note shared by a set of
//     species (the oversize tier), unlocked by scanning ANY of
//     them. Exactly one of `species` / `anyOf` is set.
//   - `clue` — the italic text. Clue voice, by house rule: it
//     TEACHES without spoiling. It tells you what to try and
//     what to watch for; it never names timers, percentages, or
//     mechanics. If a clue reads like a wiki, rewrite it.
//   - `witness` — what marks the note WITNESSED: the behavior
//     happening near the player (the gift appearing, the cache
//     collected, the dog deciding). A record, not an objective:
//     no rewards hang off it. The string names the event for
//     the wiring spec; the UI may show it or not.
//
// The notes are ordered roughly by how hidden their behavior
// is — the ones no player could ever guess come first.

export interface FieldNote {
  /** Stable id for save/witness bookkeeping. */
  id: string;
  /** The species this note keys to (scan unlock). */
  species?: string;
  /** Group notes: unlocked by scanning ANY listed species. */
  anyOf?: string[];
  /** 'fauna' | 'flora' — which codex the species lives in. */
  kind: 'fauna' | 'flora';
  /** The clue, in-world voice. Teaches; never spoils. */
  clue: string;
  /** The witness event, named for the wiring. */
  witness: string;
}

export const FIELD_NOTES: FieldNote[] = [
  // -----------------------------------------------------------------
  // The truly hidden — no player finds these unaided.
  // -----------------------------------------------------------------
  {
    id: 'note_hollow_hermit',
    species: 'hollow_hermit',
    kind: 'fauna',
    clue: 'It walks only at night, and it is always watching back. Be near it in the dark. Be still. Be patient. What the colony thinks of your manners, it leaves at its feet at dawn.',
    witness: 'A Hollow Heart Spore appears at a hermit\'s base at dawn.',
  },
  {
    id: 'note_hearth_dog',
    species: 'hearth_dog',
    kind: 'fauna',
    clue: 'This one is not caught. It comes to a home with a heart tile and watches how you live. Feed it, space the feedings, and let it take its thirty days.',
    witness: 'The Dog Has Decided.',
  },
  {
    id: 'note_rootfall_bear',
    species: 'rootfall_bear',
    kind: 'fauna',
    clue: 'The hollow has a landlord. He leaves his rent at the door and takes offense only at hands. What a landlord accepts, a tenant returns.',
    witness: 'Tenancy Agreed — the bear accepts returned rent.',
  },
  {
    id: 'note_hearth_wisp',
    species: 'hearth_wisp',
    kind: 'fauna',
    clue: 'It visits; it does not keep. Give it a hearthpod worth sitting on — and see what fruits in the ash of a fire it approves.',
    witness: 'A wisp takes up over your hearthpod.',
  },
  {
    id: 'note_hearth_cap',
    species: 'hearth_cap',
    kind: 'flora',
    clue: 'It fruits only in reviewed ash. No wisp on the hearth, no fruiting — the fungus seconds the wisp\'s motion, never its own.',
    witness: 'A Hearth Cap fruits beside a wisp-kept hearthpod.',
  },

  // -----------------------------------------------------------------
  // The half-hidden — findable, but only if you know to look.
  {
    id: 'note_gladhand',
    species: 'gladhand',
    kind: 'fauna',
    clue: 'In a glad valley, something many-handed meets you at the edge and takes your gauntlet gently, to walk you the pleasant way in. Where no usher waits at a valley\'s edge, ask what the valley is instead.',
    witness: 'Walked in by the usher, the pleasant way.',
  },
  {
    id: 'note_threshold_hound',
    species: 'threshold_hound',
    kind: 'fauna',
    clue: 'At a valley\'s edge a long hound falls in at your heel. Where the valley is glad, it walks you in. Where the valley is hungry, it walks you out — unhurried, tireless, and the courtesy is the warning.',
    witness: 'Escorted by the hound, the valley\'s way.',
  },
  {
    id: 'note_taster',
    species: 'taster',
    kind: 'fauna',
    clue: 'A low taster on many legs samples the air of guests for a hungry valley, and where it lingers, the valley is deciding. If it turns away, you were filed kindly. If it keeps your pace at tasting distance, be somewhere else.',
    witness: 'Stood for the tasting, and read the verdict.',
  },
  // -----------------------------------------------------------------
  {
    id: 'note_root_otter',
    species: 'root_otter',
    kind: 'fauna',
    clue: 'It banks bright things in the roots by its pools and pays them out like dividends. What an otter considers payment is a logic of its own.',
    witness: 'You pick up a treasure from an otter\'s cache.',
  },
  {
    id: 'note_moon_moth',
    species: 'moon_moth',
    kind: 'fauna',
    clue: 'Every flame-shaped flower in three families has an appointment with it, nightly. Plant a Night Candle and wait for dark: the road it flies is made of scent.',
    witness: 'A moth changes course for a candle at night.',
  },
  {
    id: 'note_drift_krill',
    species: 'drift_krill',
    kind: 'fauna',
    clue: 'By day the school hangs deep and dim. At night it rises to the surface and burns faintly blue — the pond, briefly, full of slow stars.',
    witness: 'The krill seen risen after dark.',
  },
  {
    id: 'note_window_meltcap',
    species: 'meltcap',
    kind: 'flora',
    clue: 'Some things keep an hour the way others keep a place. This one opens at midnight and only then; the glove learns the hours by being refused.',
    witness: 'Harvested inside its hour.',
  },
  {
    id: 'note_window_night_cap',
    species: 'night_cap',
    kind: 'flora',
    clue: 'Some things keep an hour the way others keep a place. This one opens at midnight and only then; the glove learns the hours by being refused.',
    witness: 'Harvested inside its hour.',
  },
  {
    id: 'note_window_night_candle',
    species: 'night_candle',
    kind: 'flora',
    clue: 'Some things keep an hour the way others keep a place. This one opens at midnight and only then — and its blooms are a road, for whoever flies by scent.',
    witness: 'Harvested inside its hour.',
  },
  {
    id: 'note_window_sun_cap',
    species: 'sun_cap',
    kind: 'flora',
    clue: 'Some things keep an hour the way others keep a place. This one opens at noon and only then; the glove learns the hours by being refused.',
    witness: 'Harvested inside its hour.',
  },
  {
    id: 'note_window_noonflower',
    species: 'noonflower',
    kind: 'flora',
    clue: 'Some things keep an hour the way others keep a place. This one opens at noon and only then; the glove learns the hours by being refused.',
    witness: 'Harvested inside its hour.',
  },

  // -----------------------------------------------------------------
  // The shown — the behavior is visible; the note names it, so
  // the player knows what they are looking at.
  // -----------------------------------------------------------------
  {
    id: 'note_blink_hare',
    species: 'blink_hare',
    kind: 'fauna',
    clue: 'It is, briefly, elsewhere. The hare does not run from you; it simply stops being where you were looking.',
    witness: 'Seen mid-blink.',
  },
  {
    id: 'note_plunge_duck',
    species: 'plunge_duck',
    kind: 'fauna',
    clue: 'It feeds below on a schedule of breaths — down, under, up, shake. Count its dives and you can set a watch by it.',
    witness: 'Seen completing a dive.',
  },
  {
    id: 'note_boiler_crab',
    species: 'boiler_crab',
    kind: 'fauna',
    clue: 'The hiss is information, not warning. It vents its pool\'s heat on its own schedule; the warning is standing in the pool a shadow too long.',
    witness: 'Seen venting steam.',
  },
  {
    id: 'note_gloom_slug',
    species: 'gloom_slug',
    kind: 'fauna',
    clue: 'A slug is a gel it makes, not a gel it is. Follow the faint-lit trail in the Underroot and gather what the crawling leaves behind.',
    witness: 'Gloom Gel picked up.',
  },
  {
    id: 'note_mulch_beetle',
    species: 'mulch_beetle',
    kind: 'fauna',
    clue: 'A working colony is an engine: trimmings in, finished compost out, at the burrow mouth. Farmers understand offerings — and supplies.',
    witness: 'Compost collected at a burrow mouth.',
  },
  {
    id: 'note_tumble_sage',
    species: 'tumble_sage',
    kind: 'flora',
    clue: 'Harvest it rooted, or don\'t — a sage left ripe too long lets go of the ground entirely and goes traveling, shedding leaf at every bounce.',
    witness: 'Seen rolling.',
  },
  {
    id: 'note_puffbell',
    species: 'puffbell',
    kind: 'flora',
    clue: 'The grove keeps the hour so the valley doesn\'t have to. Watch a mature bell at the turn of any hour: the swell, then the ring of spores — all the bells together.',
    witness: 'Seen puffing on the hour.',
  },
  {
    id: 'note_silverfin',
    species: 'silverfin',
    kind: 'fauna',
    clue: 'It sheds silver the way other fish shed nothing at all: constantly, carelessly, in small bright scales. The storm country\'s contact metal, free to a patient shore.',
    witness: 'A Silver Scale collected.',
  },
  {
    id: 'note_shard_grazer',
    species: 'shard_grazer',
    kind: 'fauna',
    clue: 'It eats resonance country and wears the results: glass plates, shed in the singing grass for whoever gathers without grabbing.',
    witness: 'A shed plate collected.',
  },
  {
    id: 'note_fen_lurker',
    species: 'fen_lurker',
    kind: 'fauna',
    clue: 'The pond has a landlord too, and this one is all mouth and patience. The still ring on still water is not the water.',
    witness: 'An ambush survived — or seen.',
  },
  {
    id: 'note_pool_snapper',
    species: 'pool_snapper',
    kind: 'fauna',
    clue: 'The pond has a landlord too, and this one is all mouth and patience. The still ring on still water is not the water.',
    witness: 'An ambush survived — or seen.',
  },
  {
    id: 'note_feral_warden',
    species: 'feral_warden',
    kind: 'fauna',
    clue: 'The Bailiff keeps the Living\'s garden and audits what walks in it. Kill it — if you can — and it leaves paperwork.',
    witness: 'A Requisition drops.',
  },
  {
    id: 'note_oversize_tier',
    anyOf: [
      'grass_leviathan', 'cloud_whale', 'storm_leviathan',
      'garden_colossus', 'sleeping_mountain', 'glass_behemoth',
      'old_marrow', 'winter_mother', 'dune_whale', 'great_hermit',
      'tempest_worm', 'lake_leviathan',
    ],
    kind: 'fauna',
    clue: 'They are chill until messed with, every one of them — and they mean it when they stop being chill. What they carry is worth a fortune. What they cost is the fight.',
    witness: 'One of the great ones, provoked.',
  },
];

// =====================================================================
// WIRING SPEC (for the dev chat — the creatures lane ships data
// only):
//   1. Quest log gains a category (Adam's name for it: his call —
//      drafted as FIELD NOTES; his alternative was "Unique
//      Entities"). Entries render name + italic clue; locked
//      notes are simply ABSENT (a rumor you haven't heard is
//      not a greyed-out box).
//   2. Unlock: the scanner's codex-discover event for a species
//      unlocks its note (and any group note listing it).
//   3. Witness stamps: the moments already exist — item spawns
//      (dawn gift, caches), pickups (gel, scales, compost),
//      state changes (dog decided, wisp anchored, bear tamed),
//      harvests in-window. The witness strings above name each
//      event; stamp on the nearest matching occurrence.
//   4. Nothing goes on the HUD tracker. Field Notes are a book
//      you consult, not a chore you chase.
// =====================================================================
