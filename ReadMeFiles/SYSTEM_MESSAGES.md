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
  injected by `vite.config.ts` as a define — zero manual
  steps; it changes on every build because the clock does.
  `src/game/buildNotes.ts` unwraps it (`BUILD_ID`), and the
  deployed bundle contains exactly one stamp-shaped string,
  so the merge flow reads it back out of the live JS.
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
