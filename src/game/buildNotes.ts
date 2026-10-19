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
  title: 'Yours for good',
  lines: [
    'A fix, plainly told. The World Asks Back keeps a ledger: when a finished saga removes a species from a zone, the wild of that kind are gone for good — that part is by design, and it stands. But the ledger was reading names, not faces. A creature you had tamed, or a planting you had raised with your own hands, could be swept out with its wild kin when you left and came back.',
    'No longer. What is yours is yours: a tamed companion and a planted garden stand outside the wild census now, in every zone, on every return. The removals keep their teeth — the wild still answer for what the sagas decided — but your companions and your plantings are yours for good.',
  ],
};
