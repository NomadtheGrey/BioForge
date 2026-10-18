# THE TUNES MAP — generative music, family by family

**Status: DRAFT for Adam's pin (HUD lane, 2026-10-18).** The audio
program's first deliverable: which scale, motif character, and
instrument set each biome family sings in, and how day, night,
and the sky lean on it. The synth core gets designed against
this map; nothing here is code yet.

Built on the settled pins (2026-10-17): the music is COMPUTED,
not tracked — slow motifs seeded by place; one WebAudio synth
core, no audio files, synth-only; silence is a material and the
mix's quiet end stays honest. The player-facing volume lives on
the SOUND shelf (Options → Background Music), already landed.

---

## The global grammar (true in every country)

- **Place seeds the motif.** A zone's music derives from its
  family + its coordinates: the same zone hums the same motif
  family on every visit, in every world that grows it — you can
  learn a place by ear the way you learn a species' voice.
- **The form is three layers, all slow.** A low root drone
  (barely there), a pad of two or three long tones, and a motif
  line that phrases and rests — notes every few seconds, never a
  tune you could hum against your will. Density follows the
  country's own densities: lush country phrases more often;
  sparse country leaves long, honest silences between notes.
- **Day and night are mixes, not tracks.** Night drops the
  register, thins the motif (roughly half the phrases), and
  warms the drone. The layers crossfade at dawn and dusk with
  the light; nothing ever switches.
- **Zone borders crossfade** over a few seconds — travel should
  sound like weather moving, not a record changing.
- **Hybrid country blends.** Where two families meet (the named
  hybrids), the primary family carries the scale and motif; the
  secondary lends ONE instrument — its signature voice — at low
  weight. The other country is visiting.
- **Underground is a treatment, not a family.** Below the
  surface the motif thins to single notes with long echoes, the
  pad falls away, and the drone drops an octave. Deeper strata,
  sparser still. The fifth stratum is nearly the designed
  silence's neighbor.
- **The scar-complex is silent by design.** In the Confront
  finale's scar rooms the music does not thin — it STOPS, all
  channels of the tune, so the silence lands as a place and not
  a gap. This is the mix's quiet end, spent on purpose.
- **The hearth warms the motif.** Near a kept hearth, one soft
  instrument (the family's gentlest voice) joins at low weight.
  Home sounds like itself, wherever it stands.

## The instruments (synth voices, named once)

- **reed** — filtered sawtooth, slow attack: a grown wind voice.
- **glass** — sine with harmonic pings, long release: bells that
  aren't bells.
- **thrum** — low triangle pulse: the ground's slow heartbeat.
- **breath** — filtered noise swell: wind and water's cousin.
- **pluck** — short triangle notes: fingers on a string of gut.
- **knock** — woody pitched taps: the forest keeping time.

---

## The families

### Meadow — the home key
- **Root & scale:** D, major pentatonic.
- **Motif:** open, unhurried phrases; the friendliest grammar in
  the game — this is the tune every other country modulates
  away from.
- **Instruments:** reed pad, pluck motif, thrum low.
- **Night:** pluck rests; reed carries alone, warmer.
- **Sky lean:** comet nights add a single high glass note per
  phrase — the sky signing the home key.

### Rootwood — the meadow's elder kin
- **Root & scale:** D, dorian (the home root, woodier mode).
- **Motif:** slower and lower than the meadow's; longer rests;
  phrases lean downward like branches.
- **Instruments:** knock motif over reed pad, thrum deeper.
- **Night:** knocks go sparse and irregular — things moving in
  the wood that aren't music, almost.
- **Sky lean:** none; the canopy closes the sky out. (The one
  family the sky cannot lean on — by design.)

### Wetland — bright water
- **Root & scale:** F, lydian-leaning pentatonic.
- **Motif:** rippling phrases, notes doubled as if reflected.
- **Instruments:** pluck motif, breath swells, reed pad low.
- **Night:** the pad drops deep and slow — the frog register:
  small country, deep voice, the type knowing its own law.
- **Sky lean:** moon-bright nights raise the breath layer; the
  marsh exhales.

### Fungal — the dark hollow
- **Root & scale:** C, minor pentatonic.
- **Motif:** close, woody, muffled — phrases kept short, as if
  the air itself were thick.
- **Instruments:** knock and low pluck, pad of detuned reeds.
- **Night:** barely changes — it was already dark. The detune
  widens slightly; the hollow gets stranger, not quieter.
- **Sky lean:** none reaches the floor. Spore weather (its own
  sky) thickens the pad instead.

### Ember — warm ruin country
- **Root & scale:** A, minor pentatonic.
- **Motif:** slow phrases with ember-gaps; a tune that sounds
  half-remembered.
- **Instruments:** reed (rougher filter), thrum, rare glass.
- **Night:** the thrum slows toward a heartbeat at rest; glass
  rests entirely.
- **Sky lean:** ember-bright skies (its weather) warm the reed —
  the filter opens like a coal breathed on.

### Saltglass — the sparsest country
- **Root & scale:** E-flat, major pentatonic (bright, alien).
- **Motif:** the longest rests in the game — single glass notes
  minutes apart in feel, then a small cluster, then air. The
  quiet end's showcase.
- **Instruments:** glass alone, mostly; breath for glare.
- **Night:** glass drops a register and doubles its rests.
- **Sky lean:** comet nights are this family's festival — glass
  phrases quicken, briefly, like the crystals are answering.

### Frost — the steady state
- **Root & scale:** B, minor, high register.
- **Motif:** bright and very slow; notes like light on snow —
  few, and each one placed.
- **Instruments:** glass high, breath (wind) as the pad.
- **Night:** the wind layer takes the lead; glass becomes the
  guest. It never thaws, and neither does the tune.
- **Sky lean:** clear frost nights ring the glass a touch
  brighter; storms bury it (see Storm).

### Precursor — the authored country
- **Root & scale:** G, mixolydian fragments.
- **Motif:** THE EXCEPTION. Every other family GROWS its motif;
  this one's figure was COMPOSED — a fixed eight-note phrase
  that returns with small variations, regular as something
  remembered. It should feel made, because it was — by them.
- **Instruments:** glass and reed in near-unison (a chorus of
  two), lightly detuned against each other — a tune remembered
  by two voices that almost agree.
- **Night:** the figure slows and the detune widens: memory
  tired, in the dark.
- **Sky lean:** on comet nights the figure plays WHOLE, once,
  unvaried — the only time the country remembers perfectly.

### Bone — the graveyard
- **Root & scale:** D, minor — the home root with the light out
  of it (death-fertile kin to the starter country, on purpose).
- **Motif:** a two-note sigh, long air around it. The sparsest
  phrases after the saltglass.
- **Instruments:** low reed, thrum at funeral pace, no pluck.
- **Night:** the sigh drops to one note. Some nights it doesn't
  come at all — the seed decides; absence is in this family's
  grammar.
- **Sky lean:** none. The dead don't look up.

### Storm — charged country
- **Root & scale:** E, minor.
- **Motif:** phrases ride a slow pulse, tense and regular —
  the held breath before weather.
- **Instruments:** thrum (the pulse), reed strained high,
  glass pings sparse as static.
- **Night:** the pulse quickens slightly; the country is
  deciding something.
- **Sky lean:** when the sky breaks (lightning weather), the
  tune DUCKS under it — the storm itself is the loudest
  instrument, and the music knows to get out of its way.

### Living — one organism, one valley
- **Root & scale:** C — the fundamental, the world's ground
  note — a swelling tone cluster rather than a scale walked.
- **Motif:** no phrases: a single breathing line that swells
  and settles, minutes per breath. The valley is the voice.
- **Instruments:** reed cluster, thrum at breath pace, breath
  itself woven in.
- **Night:** the breath slows; the cluster warms a step toward
  minor — content by default, moody by variant (its zones with
  the moody variant shift the cluster minor by day as well).
- **Sky lean:** the valley answers the comet with one long
  swell — the whole organism looking up at once.

---

## Build order this map implies

1. The synth core: the six voices, the layer mixer reading the
   SOUND shelf, the crossfade rules (zone, dawn/dusk, depth).
2. The family grammars above, one family at a time against the
   core — meadow first (the home key is the reference mix),
   saltglass second (the quiet end proves the silence law
   early), precursor third (the authored exception).
3. Voices (the settled creature law) plug into the same core
   on the Creatures channel; plants when their turn comes.

## Open, deliberately

- Idle calls and distress cries (creatures) — the noise budget
  pair, judged by ear once the core exists. (Settled 2026-10-17.)
- Motif density master curve — how literally flora/fauna
  density numbers map to phrase rates; tuned in the core's
  first playtest, not on paper.
