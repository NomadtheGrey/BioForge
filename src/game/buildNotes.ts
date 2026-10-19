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
 * CURRENT BUILD (the itch door lights, 2026-10-19): the
 * lines below — written for the landing, in the file's
 * standing discipline (whoever composes a landing writes
 * its notes). The previous build's greeting ('Yours for
 * good') has already fired; this build must not wear it a
 * second time (the dev lane's slice-4 lesson, applied).
 */
export const BUILD_NOTES: BuildNotes = {
  // The itch door lights (2026-10-19): Adam published the
  // game's itch.io page today, so DONATE_URL in links.ts
  // carries its real address and the DonateModal's second
  // door stands open beside Ko-fi. The notes also tell
  // direct-site players the second home exists — and that
  // their three cloud words bridge the two, so no world is
  // stranded on either side.
  title: 'Words that fly',
  lines: [
    'Writing to us gets easier. The feedback window is learning to send your note itself — no detour through your mail app, no borrowed envelope: you write, you press send, and your words fly straight to the grower\'s inbox. You can leave your own address if you\'d like an answer.',
    'And if the road is ever blocked, the window says why, plainly — and keeps your words safe in front of you, with a button to copy them out whole, so a failed send never eats what you wrote. The direct door lights the moment our mail service finishes connecting; until then, the old mail door works exactly as it always has.',
  ],
};
