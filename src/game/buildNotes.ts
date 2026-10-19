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
 * CURRENT BUILD (the light-and-lenses stack, 2026-10-18):
 * the lines below — written for the landing, in the file's
 * standing discipline (whoever composes a landing writes
 * its notes). The previous build's greeting ('Clearer air,
 * a surer hand') has already fired; this build must not
 * wear it a second time (the dev lane's slice-4 lesson,
 * applied).
 */
export const BUILD_NOTES: BuildNotes = {
  // The chips + the lantern's radius (2026-10-18): on
  // touch, the vitals, zone, and tracker panels rest as
  // small chips (tap to open the full card, one at a
  // time) so the world starts clear on a small screen;
  // and the carried lantern's light reaches much farther
  // — held and braced alike — per the maker's dark walks.
  title: 'Promises kept',
  lines: [
    'The Codex tells the truth now — its facts are read from the land itself: how a creature is won, how hard it bites, what it sheds, what a kill leaves behind. No more numbers copied by hand; what the book says, the world does.',
    'And three creatures the book described but the world didn\'t keep are out there now: a hearth dog won by offerings, a burrow mouse that sheds what it promised, and a great bear standing in the deep glades — gentle, unless provoked.',
    'Things on the ground have shapes of their own now, so a dropped treasure reads as itself from a distance.',
    'Smaller honesties: the quest tracker says why when it\'s resting and how to wake it; co-op tells it straight (one host, one world, joined through the relay); storage kits read their true sizes; and the Left Hand answers to Ctrl, as the tutorial now correctly teaches.',
  ],
};
