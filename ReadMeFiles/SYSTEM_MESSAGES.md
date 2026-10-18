# SYSTEM MESSAGES — the operator→player channel

Adam's design, 2026-10-18. Built the same day in three
slices: the feed contract + game reader, the surfaces, and
this record + the stamp runbook (the runbook itself lives
in the feed repo's README, beside the thing it operates).

## Purpose

Two kinds of messages reach every player, wherever they
play (the Workers site now, itch/portal embeds later):

1. **New-build announcements — automated.** Every build
   announces itself; nobody writes a post per release.
2. **Adam's personal broadcasts — hand-made, rare.** He
   dictates; Marlowe drafts for his approval; the approved
   text is written to the feed.

## The feed

A tiny JSON document in Cloudflare KV, served by a separate
minimal Worker (repo: `NomadtheGrey/bioforge-feed`) with
CORS open and a ~60 s cache. It lives OUTSIDE the game
build: editing it never needs a game deploy. Shape:

    { latestBuild: string,                    // a build stamp
      action: 'none' | 'refresh' |
              'refresh-required' | 'new-game',
      broadcasts: [{ id, date, title, body,
                     priority: 'panel' | 'notice',
                     expires? }] }

The game polls (~5 min + on tab refocus), never blocks, and
treats any failure as silence.

## Build identity and the automation

- Every build bakes a **stamp**: the minute it was built,
  carried two ways from one value in `vite.config.ts` — a
  define the running game reads as `BUILD_ID`
  (`src/game/buildNotes.ts`), and a static **`/build.txt`**
  emitted beside the bundle. The merge flow reads the stamp
  from the deployed build.txt: a bundle grep does NOT
  survive minification (esbuild constant-folds the labeled
  string down to the bare date — the dev lane's correction,
  2026-10-18), while the file is exactly what was written.
  Zero manual steps; the stamp changes on every build
  because the clock does.
- Every build also bakes **its own release notes**
  (`BUILD_NOTES` in the same file), player voice,
  spoiler-safe. Notes are part of each landing's review
  surface; a landing without notes gets the honest default
  ("a new build, with fixes and polish") — merges never
  block on missing notes.
- The **old build** mid-session polls: a newer stamp speaks
  at the feed's action level (the three lines live in
  `game/systemFeed.ts` — refresh / refresh-required /
  new-game; 'none' stays quiet).
- The **new build** on load greets with its own baked notes
  ("While you were away — …") — in the start screen's news
  and in the in-game stream.
- **Publishing = the stamp step**: after a wip→main merge's
  deploy verifies, the merger reads the new stamp from the
  live bundle, classifies the update honestly (the action
  level), and writes both into the KV. The classification
  guide lives in the feed repo's README.

## Surfaces

- **Start screen**: a NEWS seat first in the header cluster
  (unread dot), opening the NewsModal — this build's notes
  under "While you were away", broadcasts under "Word from
  the grower", the build stamp in the footer. A
  notice-priority broadcast may open the news ONCE on first
  load; closing marks everything seen.
- **In-game**: the system stream — a HUD_PANELS panel at the
  BOTTOM of the left stack (the HUD lane's placement call:
  the column reads urgency-descending), default shown,
  height-capped with its own internal scroll. System lines
  land live; notice-level lines ALSO toast once (type
  'system'). The stream is a record: lines stay re-readable
  for the session. Clicking the panel marks seen.

## Discipline

- **Soft in v1**: messages instruct, never force — no
  auto-reload, no input locks. Hard gates are a later trust
  decision, Adam's to make.
- **Seen-state is per-device** localStorage
  (`bioforge.systemFeed.v1`: last seen build + seen
  broadcast ids) — a fact about the screen, never the save.
- Broadcasts are **rare by design**; 'notice' is rarer.
- Player-facing words (the stale lines, the notes, broadcast
  drafts) are review surface like all copy: tease, never
  name a fate or an ending.

## Slice 4 — the publishing kit (Adam's rulings, 2026-10-18; NOT yet a build order)

Ruled, and built when its turn comes (after slices 1–3 and
Adam's feed-setup steps):

- **The Playtest Kit gets a lock**: the tilde prompts for a
  code. Its scrambled fingerprint (hash) is baked in the
  build; unlock is session-only by default, with a
  remember-this-device option Adam controls.
- **The composer lives in the kit's System tab**: write a
  broadcast, choose panel/notice, send.
- **Publishing is two-door**: the typed code is forwarded
  to the feed Worker and checked against a Worker-side
  secret (instantly rotatable, throttled) — OR a Cloudflare
  Access email session (Adam is creating a BioForge-specific
  email for the allow-list; sessions kept short, a few
  hours, because he plays from library PCs).
- **No secret of any publish value ever ships in the
  bundle.** The kit's lock is a courtesy screen for a shared
  machine; the real doors are the Worker's. A composer
  without a valid door is furniture.
