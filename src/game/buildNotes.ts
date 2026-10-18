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
  // Hostile + the two doors (2026-10-18): the third law
  // opens — explorers can fight on Hostile worlds, weapons
  // and shields exactly as they are — and the Donate
  // button becomes a two-door modal (Ko-fi live, itch at
  // launch).
  title: 'Among yourselves',
  lines: [
    'HOSTILE worlds are open. Start a world under the third law and explorers can fight each other: your weapons work on people exactly as they work on creatures, and a raised shield turns a person\'s blow the way it turns teeth. Death is still the land\'s mercy — you wake at the spawn base, pouch untouched.',
    'The spawn country stays a refuge under every law, Hostile included: nothing and no one can harm you there. Cross its border on a Hostile world and you are fair game, and so are they.',
    'The DONATE button now opens two doors: Ko-fi, live today, and the game\'s itch page, which lights the day it stands at launch. Everything in the game is free — support just keeps it growing.',
  ],
};
