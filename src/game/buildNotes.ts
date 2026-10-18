// ====================================================================
// BUILD NOTES — what the running build says about itself.
//
// Two baked facts ride every build (system messages, Adam
// 2026-10-18):
//
//   BUILD_ID — the build's stamp: the minute it was built,
//   injected by vite.config.ts as a define (zero manual
//   steps; it changes on every build because the clock
//   does). The merge flow reads the stamp from the deployed
//   /build.txt (a static file the same config emits — a
//   bundle grep would NOT survive minification, which folds
//   the label away) and writes it into the system feed as
//   latestBuild, with the action level the update honestly
//   needs. A build that polls the feed and finds a NEWER
//   stamp knows it is the old build, and speaks at that
//   level.
//
//   BUILD_NOTES — this build's own release notes, in player
//   voice, spoiler-safe (the guide's discipline: tease,
//   never name a fate or an ending). The notes are part of
//   every landing's review surface, like all copy: whoever
//   composes a landing writes its lines here. A landing
//   that ships without notes gets the honest default below
//   — merges never block on missing notes.
//
// The new build greets with these notes on load ("While you
// were away — …") on the start screen's news seat and in
// the in-game system stream. Notes travel INSIDE the build,
// so a copy of the game anywhere (Workers site, itch,
// a portal) greets its own players correctly.
// ====================================================================

declare const __BIOFORGE_BUILD_ID__: string;

/** The labeled stamp exactly as baked ('bioforge-build:…'). */
export const BUILD_LABEL: string =
  typeof __BIOFORGE_BUILD_ID__ === 'string' ? __BIOFORGE_BUILD_ID__ : 'bioforge-build:dev';

/** The bare stamp (an ISO minute, or 'dev' locally). The
 *  examples in these comments deliberately avoid the real
 *  stamp's exact shape, so grepping a deployed bundle for
 *  the stamp pattern finds exactly one string: the stamp. */
export const BUILD_ID: string = BUILD_LABEL.replace('bioforge-build:', '');

export interface BuildNotes {
  title: string;
  lines: string[];
}

/**
 * The honest default, for a landing that ships without
 * written notes: true, plain, and promising nothing.
 */
export const DEFAULT_BUILD_NOTES: BuildNotes = {
  title: 'A new build',
  lines: ['A new build, with fixes and polish under the leaves.'],
};

/**
 * THIS build's notes. Review surface: read them like a
 * player meeting them cold.
 *
 * CURRENT BUILD (the slice-4 merge, 2026-10-18): the notes
 * stand at the HONEST DEFAULT, deliberately. This build
 * carries operator furniture — the kit's lock and the
 * broadcast composer — nothing a player meets, and the
 * previous build's greeting ('Word travels now', the News
 * Stack) has already fired for it. A quiet build greets
 * quietly; the next player-facing landing writes its own
 * lines here again.
 */
export const BUILD_NOTES: BuildNotes = {
  // The chat fold build (Adam, 2026-10-18): system word —
  // automated lines and the grower's broadcasts alike —
  // moved INTO the co-op chat (SYSTEM / ADMIN, reserved
  // colors), the stream's own panel retired, and player
  // chat colors became seat-dealt so no two explorers in a
  // room wear the same voice. Player-facing: it greets.
  title: 'One room, many voices',
  lines: [
    'System word now arrives in the co-op chat — SYSTEM for the world\'s own notices, ADMIN for word from the grower. The separate system panel has retired; the NEWS seat still keeps the record.',
    'Every explorer\'s chat wears a color of its own now, dealt by seat — and the sky blue and amber belong to SYSTEM and ADMIN alone.',
  ],
};
