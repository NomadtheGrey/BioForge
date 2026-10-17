# HOW TO PLAY + THE TUTORIAL — design (Adam's ask, 2026-10-17)

Status: DESIGN for Adam's ratification. Drafted by the background chat
(the words + the step logic); the HUD lane owns the button, the modal
shell, and the highlight chrome. Nothing here is built yet.

Adam's framing, verbatim in substance: a "How to Play" button in the
top-right HUD, obvious, glowing, pulsing. It opens a modal of basic
instructions — filled out and player friendly. The modal carries a
"Show Tutorial" button starting a guided walk: highlight the HUD's
important elements, have the player harvest and craft at the BioForge,
and teach the habit of following the mini-quests to craft their way
forward. The Quest Log and the bigger quests must be one obvious
button away. A first-time player is overwhelmed without this.

---

## 1. THE BUTTON (HUD lane)

- Label: **HOW TO PLAY**, with a ❓ or book glyph. Placement: the
  top-right HUD element (the session bar cluster), always on screen.
- Obvious by design: an emerald glow + a gentle pulse animation.
  The pulse QUIETS once the player has opened the modal once
  (per-device memory, §5) — it should invite, not nag forever.
- **NOT a hideable panel** (HUD lane's refinement, accepted): a
  first-time player's lifeline can't sit behind a ✕ and an
  Options screen they don't know exists. The button lives FIXED
  in the top-right utility cluster, LABELED (never icon-only).
  If it ever needs an off switch, HUD Options carries a
  toggle-only entry (the reticle precedent) — a display
  setting, never a panel hide.
- **The Quests button is strengthened in the same pass**: the
  two cluster together in that corner, both labeled — How to
  Play and Quests, the two doors a lost player needs, in one
  glanceable place. (A Quests door already exists in the
  quicknav; this makes it first-class.)
- Keyboard: **H** opens it too (free key; the Controls Guide gains
  the row).

## 2. THE MODAL (HUD shell; the words below are the build text)

Title: **How to Play BioForge**
Footer buttons: **Show Tutorial** (primary) · **Open the Quest Log** ·
**Close**.

Boundary with the Game Info screen (HUD lane's refinement,
accepted): Game Info stays WHAT THE WORLD IS (the primer's
copy); How to Play is HOW TO PLAY — verbs, controls, first-hour
grammar, the tutorial door. No copied overlap. The modal
carries one small **"About this world"** link that opens Game
Info for players who want the why. Two doors, two jobs.

### The words (drafted for the build; Adam edits freely)

**Welcome, grower.**
Nothing here is built — everything is grown. You are standing in a
living world with a gauntlet on one hand and a pouch at your belt.
This page is the whole game in five minutes.

**The loop, in one breath.**
Harvest what grows → carry it home → grow what you need at the
Bio-Forge → graft it onto your gear → walk further out, where
stranger country grows stranger things. Every new tool opens a
new verb, and every verb opens new country.

**Your hands.**
- **Harvest Glove [1]** — gathers ripe plants. Walk up, click.
- **Bio-Scanner [2]** — reads creatures, plants, and ruins into
  your Codex. Knowledge is gear here.
- **Planter Trowel [3]** — grafted, not given (see the Forge). It
  does two jobs: it plants seeds, and it applies fertilizer —
  the same trowel sows and feeds.
- **Solvent Sprayer [4]** — un-grows things gently: plants give
  back their seed, structures give back their kit, whole.
- **Taming Lure [5]** — calls the wild to you, and leads the
  tame: a creature following your lure can be told to stay,
  to guard, or — kindly, and by name — to go free.
- **Bio-Builder [6]** — places what the Forge grows: walls,
  hearths, storage, tunnels.
- **Striker [7]** — your grown weapons, if you grow them. Tap 7
  again (or the mouse wheel) to swap between your close and
  ranged strikers.
- **Your Left Hand** — holds one instrument: the Hand
  Lantern-Fern's light, or a grown shield. **Alt + wheel** or
  **Alt + ↑/↓** cycles it; tapping its tile works too.

**The Bio-Forge [B].**
Your homestead's forge grows everything: tools, modules,
furniture, weapons, shields, whole structures. Stand near it —
or graft the **Field Synthesizer** onto your gauntlet and craft
tier 1–2 recipes anywhere. Recipes that consume what you already
carry say so; one-time crafts lock once they're yours.

**Quests — the game teaches in quests.**
Press **Q** (or the Quests button) for the Quest Log. Three
kinds live there:
- **Mini-quests** — the crafting chain. Each one names what to
  gather and what it grows into: a pouch, a scanner, a trowel.
  Following them IS the tutorial the world gives you; the
  tracker card on your HUD follows the one you've pinned.
- **Ask the World** — questions the land answers as you explore:
  ruins, glyphs, strange meetings. No fetch lists; go and see.
- **The World Asks Back** — in time, the country starts asking
  things of YOU. Watch the tracker.

**Your three platforms.**
Everything you wear is one of three grown platforms, and each
verb belongs to one: the **Gauntlet** DOES (its modules and
grafts), the **Helmet** KNOWS (radar, lenses, creature sight),
the **Quicksteps** GO (waders, stillsteps, soles that walk on
lava). Your shield rides the Left Hand. Upgrades are grown at
the Forge and owned for good — owning one is wearing it.

**The world.**
One zone is 100 paces across; the country changes as you walk
out — meadows first, then wetlands, fungal dark, ember fields,
saltglass, stranger things. Danger and wonder both rise with
distance. Days turn on a ten-minute sky; your zone panel reads
the day and hour. Death is real but not theft: you wake at your
**Heart Tile** with everything you carried still in your
pouch. The walk back is yours to make — the land remembers
where you fell, even if your hands come back full.

**Creatures are people.**
They court, negotiate, hoard, and decide. Some can be fed,
lured, and tamed into companions; the Culture Vat can regrow
the lost from a saved sample. A guardian at your side is worth
two strikers.

**Saving & company.**
The game autosaves at your homestead world; the session bar
(top-right) holds Save and Co-Op. A friend can join your world —
you stay the host, your world is the world.

*Stuck? Follow the tracker. The next mini-quest is always the
way forward.*

## 3. THE TUTORIAL (interactive; HUD chrome, this chat's logic)

Started from the modal's **Show Tutorial** (and offered once,
gently, on a brand-new world's first spawn — see §5). A step
card sits bottom-center: a title, one or two plain sentences,
and **Next / Skip step / End tutorial**. The current step's
target HUD element wears a pulsing highlight ring. Steps that
ask for an action complete when the game sees it done (the
signal map, §4); pure-reading steps complete on Next.

Chrome rules (HUD lane's, accepted): the ring is
pointer-events-none; steps whose target is the WORLD, not the
glass (step 5's harvest) run in a no-target center-card mode
with no ring; Skip / Exit are present on every step and answer
to KEYS as well as clicks (signal-advanced steps need no
clicks while pointer-locked). **Hard rule: the tutorial never
traps the player** — exitable at any moment, and every gated
step has a manual beat.

The player can end the tutorial at any step; progress is
remembered per device, and "Show Tutorial" restarts or resumes.

### The step script (12 steps)

**The words of record live in `src/hooks/tutorialSteps.ts`**
(landed with the engine, wip d9728f0) — written at Adam's
12-year-old bar: plain words, short sentences, every step
doable by following the card. This table is the map; edit the
words in the file, not here.

| # | Step | Highlight | Ends |
|---|---|---|---|
| 1 | Welcome — you grow things here | none | Next |
| 2 | Your health bars (green/yellow/blue) | vitals | Next |
| 3 | Where you are — land, day, hour; farther = stranger | zone | Next |
| 4 | Your tools 1–7 + the Left Hand and its Alt grammar | hotbar | Next |
| 5 | Pick your first plant | none (world) | the harvest itself |
| 6 | Your pouch — open it, see the small stacks | quicknav | pouch opens |
| 7 | Meet the Bio-Forge — find the Woven Pouch recipe | quicknav | forge opens |
| 8 | Quests tell you what is next — the tracker card | tracker | Next |
| 9 | The Quest Log — Q or the QUESTS button | quests-btn (the cluster) | log opens |
| 10 | Three things you'll grow — Gauntlet / Helmet / Quicksteps | hotbar | Next |
| 11 | One trowel, two jobs — sows and feeds | none | Next |
| 12 | You are ready — lost? follow the tracker | howto-btn (the cluster) | Finish |

Targets resolve as HUD_PANELS ids or the cluster's DOM ids
('howto-cluster' / 'howto-btn' / 'quests-btn') — Slice A moves
the Quests button out of the session panel into the fixed
top-right cluster beside How to Play, so steps 9 and 12 point
at the cluster, not a panel.

Gated steps (5, 6, 7, 9) also answer Next/Skip at all times —
the tutorial never traps. The engine is
`src/hooks/useTutorial.ts`: App feeds it four facts (harvested /
pouch open / forge open / quests open), it advances gated steps
600 ms after their fact stands, and it keeps the per-device
record (resume, completion, modal-seen, offered).

## 4. THE SIGNAL MAP (why this is cheap)

Every action step completes on a fact the game already keeps:

| Step | Completes on | Existing source |
|---|---|---|
| 5 Harvest | first flora harvest | the App harvest callback (onFloraHarvest) + q_first_harvest completion |
| 6 Pouch | pouch/inventory modal opens | App modal state (activeModal) |
| 7 Forge | BioForge modal opens | App modal state |
| 9 Quest Log | quest log opens | App modal state / onOpenQuests |

Reading steps need no signals. The step engine is one hook
(useTutorial) holding the step index + completion flags,
composed in App (wiring only, per the APP RULE) and fed the
same refs the quest system already reads. **One new wire, the
established pattern:** none strictly — modal-open states and
the harvest callback already reach App. (If the harvest
callback proves awkward to tap, the fallback is questProgress:
q_first_harvest landing in completedIds.)

The tracker-following steps assume the chapter-1 chain as
shipped: First Harvest → Room to Breathe → Bound for More →
A Place for Things → Eyes Open → Sow the Future → Raise the
Walls → Nothing Wasted → Make a Friend.

## 5. MEMORY & FIRST-RUN BEHAVIOR

- Tutorial state is PER-DEVICE, never in the save (the
  hudLayout precedent): localStorage `bioforge.tutorial.v1`
  = { modalSeen, stepIndex, completed, skipped }.
- The button's pulse quiets once modalSeen. The tutorial is
  offered automatically ONCE: the first time a player enters a
  world on a device with no tutorial record, a single toast —
  "New here? The glowing How to Play button (top-right)
  teaches the game in three minutes." — never a forced modal.
- Resume: reopening Show Tutorials resumes at stepIndex
  unless completed, in which case it restarts (asking nothing).

## 6. LANES & SLICES

- **Slice A (HUD lane):** the fixed How to Play button + the
  strengthened Quests button clustered with it (both labeled,
  top-right) + the modal with §2's words and its "About this
  world" link into Game Info.
- **Slice B (this chat's logic, HUD chrome):** useTutorial +
  the step card + the highlight ring keyed to HUD panel ids
  (vitals / zone / hotbar / quicknav / tracker / session) +
  App wiring. Panel ids above are the registry's own.
- **Slice C (polish, if wanted):** first-run toast, H key,
  Controls Guide row, resume polish.

Open for Adam: the modal words' length (full, as drafted, vs
a shorter cut), and whether the tutorial should also walk the
player out to their first zone border (a 13th step) or stay a
homestead lesson.
