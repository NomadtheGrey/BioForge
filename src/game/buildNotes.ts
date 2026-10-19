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
  title: 'Put to work',
  lines: [
    'Your garden gains a workforce. The Bone Chime Sentinel stands at the camp\'s edge and listens: when something with a hunter\'s nature crosses near, it knocks — bone and straw, a warning, never an alarm — and then holds its peace. It never fights. It tells you to look up.',
    'The Culture Vat takes a broth now: pour in one gel and let it ferment beside the growing — no fire; the culture warms itself, and its warmth is its strength. A ripe broth leans on the hatch: tougher, quicker, more generous in what it sheds, or gentler when it goes home to the wild. The hatchling drinks it dry.',
    'Beds and walls: the Root Bed grows on into the Slumber Husk — gel-flesh, fiber skin, warm and faintly damp and better than it sounds; click it at night to sleep the world to dawn. The Mycologist\'s Wall mounts one of every cap kind, alive: its glow caps light your camp, its rot kinds digest scraps into compost. Even the Mound\'s fungus eats bone and shell now.',
    'A plant with an address: the Planter holds one living plant as furniture — it grows there, and a glowing tenant lights the room with its own species\' light. Which reminds us: every light has a gesture now. Moss pulses like a heartbeat, lantern ferns sway, cave glow ripples past in a wave. You\'ll learn to read your lights like faces.',
    'Land animals swim — a bear crossing a deep pond rides the surface now (brine too; lava, still no). And the world keeps growing while you\'re away: vats ripen, broths warm, planters grow by the clock, not by your presence. Come back to a garden that didn\'t wait for you.',
    'At the Bio-Forge, structures fold into subgroups now — Defenses among them, where the chime and the turret keep company — and on phones the big screens stack properly instead of squeezing.',
  ],
};
