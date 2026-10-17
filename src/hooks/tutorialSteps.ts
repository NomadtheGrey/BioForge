/**
 * THE TUTORIAL — the step script as data (How to Play program,
 * Adam, 2026-10-17; design: ReadMeFiles/HOW_TO_PLAY_AND_TUTORIAL.md).
 *
 * This file is the TEXT OF RECORD for the tutorial cards. The
 * engine (hooks/useTutorial.ts) walks these steps; the HUD lane's
 * chrome renders them. Adam's bar for every word here: a
 * 12-year-old, new to the game, must be able to follow the card
 * and DO the step. Plain words, short sentences, no unexplained
 * jargon, and nothing a step says may be untrue of the shipped
 * game — if a system changes, this script changes with it.
 *
 * A step completes one of two ways:
 *  - 'manual' steps end when the player taps Next (or Skip).
 *  - gated steps ALSO end by themselves when the game sees the
 *    player do the thing (the completion kinds below, fed to the
 *    engine as facts). Gates NEVER trap: Next and Skip always
 *    work, on every step, gated or not.
 *
 * `target` is a HUD_PANELS id (hooks/useHudLayout.ts) the chrome
 * highlights while the step is up, or null when the step's target
 * is the world itself (pick a plant) — the card then stands
 * alone in its no-target mode.
 */

export type TutorialGate =
  | 'manual'
  | 'harvest'    // a flora harvest happened (the game's first-harvest fact)
  | 'openPouch'  // the pouch / inventory modal is open
  | 'openForge'  // the BioForge modal is open
  | 'openQuests'; // the Quest Log is open

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  target: string | null;
  gate: TutorialGate;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to BioForge',
    body: 'In this world, you don\u2019t build things. You GROW them. This short walk teaches you the basics in about three minutes. You can stop at any time \u2014 the glowing HOW TO PLAY button at the top-right brings this back.',
    target: null,
    gate: 'manual',
  },
  {
    id: 'vitals',
    title: 'Your health bars',
    body: 'These bars are you. Green is health. Yellow is stamina \u2014 running, blocking, and hitting things all use it up. Blue is crafting energy. If something bites you, watch the green one.',
    target: 'vitals',
    gate: 'manual',
  },
  {
    id: 'zone',
    title: 'Where you are',
    body: 'This panel names the land you are standing in, and shows the day and the time. Walk in any direction and the land changes. The farther you walk from home, the stranger it gets \u2014 and the more dangerous.',
    target: 'zone',
    gate: 'manual',
  },
  {
    id: 'tools',
    title: 'Your tools',
    body: 'Keys 1 to 7 pick your tool. Right now you have a harvesting glove and a scanner. The small tile beside them is your LEFT HAND. It can hold a lamp or a shield. Hold Alt and roll the mouse wheel to change what it holds.',
    target: 'hotbar',
    gate: 'manual',
  },
  {
    id: 'harvest',
    title: 'Pick your first plant',
    body: 'Ripe plants glow a little. Walk up to one and click it with the Harvest Glove (key 1). Whatever you pick lands in your pouch. Try it now \u2014 this step finishes itself when you do.',
    target: null,
    gate: 'harvest',
  },
  {
    id: 'pouch',
    title: 'Your pouch',
    body: 'Everything you pick up goes in your pouch. Open it now, with the Pouch button on the bottom bar. See how each pile only holds a few? Making your pouch bigger is one of your first jobs.',
    target: 'quicknav',
    gate: 'openPouch',
  },
  {
    id: 'forge',
    title: 'Meet the Bio-Forge',
    body: 'The big living forge at your home grows everything you will ever use \u2014 tools, gear, weapons, even walls. Open it now, with the Bio-Forge button or the B key. Look for the WOVEN POUCH recipe while you are there.',
    target: 'quicknav',
    gate: 'openForge',
  },
  {
    id: 'tracker',
    title: 'Quests tell you what is next',
    body: 'This little card is your quest tracker. The quest on it tells you exactly what to gather for your next craft. Quests like this are the game teaching you, one making-project at a time. Follow them and you will learn everything in order.',
    target: 'tracker',
    gate: 'manual',
  },
  {
    id: 'questlog',
    title: 'The Quest Log',
    body: 'Press Q, or tap the QUESTS button. The log holds all your quests \u2014 the making-things chain you are on now, and bigger mysteries for later. Open it and take a look.',
    target: 'quicknav',
    gate: 'openQuests',
  },
  {
    id: 'platforms',
    title: 'Three things you will grow',
    body: 'Your gear comes in three kinds. Your GAUNTLET does the work \u2014 it will gain a scanner, a planter, a builder, and more. Your HELMET learns things \u2014 like a radar that finds creatures. Your QUICKSTEPS are your boots \u2014 some will let you walk through swamps, or even on lava. The quests add them one by one.',
    target: 'hotbar',
    gate: 'manual',
  },
  {
    id: 'trowel',
    title: 'One trowel, two jobs',
    body: 'Soon you will craft the Planter Trowel. Remember this: the trowel does TWO jobs. It plants seeds, AND it spreads fertilizer to feed them. One tool sows, and the same tool feeds.',
    target: null,
    gate: 'manual',
  },
  {
    id: 'ready',
    title: 'You are ready',
    body: 'That is the whole game: pick things, grow things, wear what you grow, walk farther out. If you ever feel lost, follow your quest tracker \u2014 and the HOW TO PLAY button at the top-right is always there. Good growing!',
    target: null,
    gate: 'manual',
  },
];
