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
  // The light-and-lenses stack (2026-10-18): the ground-light
  // fix (Adam's priority — pooled light rides its ground and
  // the tables speak the physical scale), the helm's first
  // working lenses (Biolume Visor + the zone reads), the
  // Sky Law (east rise, west set), and the HUD lane's ear-led
  // stack: music figures in place of fog, the legacy hum
  // retired at its source, one mute authority, system word
  // that stays readable, and a roomier Options panel.
  title: 'Light that lands',
  lines: [
    'The world\'s light lands where it always should have. Lantern posts pool on the ground beneath them, a lantern in hand throws a real circle of light, and down in the Biolume caves the glow fungus lights the floor you walk by.',
    'The helm\'s lenses have opened their eyes. The Biolume Visor reads living light through the deepest dark; the Trail Lens names a country\'s family, and the Identifier Lens names it whole — walk into new country and hear what your helm can see.',
    'The sky runs Earth\'s way now, by universal law: the suns rise in the east and set in the west, and the great ringed giant follows them through the night.',
    'The music speaks in figures again — motifs with edges and air between them, the old hum gone for good — and word from the system now stays on screen long enough to read it. The Options panel has a bigger room, too, with its switches in two columns.',
  ],
};
