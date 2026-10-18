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
 * CURRENT BUILD (the sound system, 2026-10-18): the lines
 * below — written for the landing, in the file's standing
 * discipline (whoever composes a landing writes its notes).
 * The previous build's greeting ('One room, many voices')
 * has already fired; this build must not wear it a second
 * time (the dev lane's slice-4 lesson, applied).
 */
export const BUILD_NOTES: BuildNotes = {
  // The day-one stack (2026-10-18): the sound field fix +
  // the hum's retirement (HUD lane's ear-led passes), the
  // Left Hand's move to Ctrl (Adam's ruling), and the chat
  // pair — the solo transmissions pane and the un-blurred
  // co-op window (background lane). The sound build's own
  // notes fired with its merge; this build speaks for
  // itself, per the standing discipline.
  title: 'Clearer air, a surer hand',
  lines: [
    'The music sits at its true level now — the first mix was a whisper, and it has been set right. The low hum underneath it has retired for good; the country plays in two clean layers, and the SOUND shelf in Options will tell you what it is doing.',
    'The Left Hand cycles on Ctrl now — Ctrl and the arrow keys, or Ctrl and the scroll wheel — and every guide and card that names the key names the new one.',
    'The co-op window no longer blurs the world behind it, and its log stands open before you ever join a session: word from the system is readable even when you wander alone.',
  ],
};
