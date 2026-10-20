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
 * CURRENT BUILD (the One Law + the kept word, 2026-10-20):
 * lines below — written for the landing, in the file's
 * standing discipline (whoever composes a landing writes
 * its notes). The previous build's greeting ('Words that
 * fly') has already fired; this build must not wear it a
 * second time (the dev lane's slice-4 lesson, applied).
 */
export const BUILD_NOTES: BuildNotes = {
  // The One Law of Life (2026-10-20, Adam pinned): the wild
  // layers — creatures wander between zones, young are born
  // where life thrives, and long-empty country can be reached
  // again. The law is deliberately UNannounced in play (it is
  // weather, not an event), so the notes tease the FEELING
  // and name no mechanism, number, or road. The kept log, by
  // contrast, is a taught surface and is said plainly: News
  // now keeps every message on the device, and feedback can
  // attach the game's own error notes — only with the
  // player's say-so.
  title: 'The country provides',
  lines: [
    'Leave a valley living, and it stays living. The country moves the way weather moves now — life drifts in from the neighboring hills, young are born where the living is already good, and a place emptied long ago is not necessarily empty forever. Walk softly, and look twice at what is standing at the tree line.',
    'And the game keeps its word: every system message and build notice this device has seen is now kept in the News, nothing dropped when the wire moves on. If something ever breaks, the feedback window can tuck the game\'s own error notes into your letter — with your say-so, and only then.',
  ],
};
