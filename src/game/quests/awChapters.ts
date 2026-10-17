// =====================================================================
// ASK THE WORLD — the eleven chapters (Adam, 2026-10-16)
// =====================================================================
// When a player holds a world's full fragment set (five Fate
// Fragments from five ruin hearts), the quest "What Happened
// Here" completes and App opens the chapter for THAT world's
// fate — the one place the game ever answers plainly, and the
// one earned exception to "the fate is never shown": Adam ruled
// the chapter MAY name the fate outright once the set is
// complete. Each text below is written as that fate's own story
// told at last — no coyness at this depth; the player earned the
// plain words ruin by ruin.
//
// The fate itself comes from fateForWorld(worldSeed) in
// game/world/ruins.ts — the same roll that styled every ruin the
// player delved to get here. The chapter is the ruins, translated.
// =====================================================================

import type { WorldFate } from '../world/ruins';

export interface AwChapter {
  /** The fate, named — the payoff line of the whole thread. */
  name: string;
  /** The story, in the primer's voice. */
  body: string;
}

export const AW_CHAPTERS: Record<WorldFate, AwChapter> = {
  gardeners: {
    name: 'The Gardeners',
    body: 'They were gardeners, and this world was their garden. They came from somewhere colder and darker, carrying seeds the way your people carry tools, and they grew everything you have ever touched here — the lantern-ferns first, for light; the hearth-dogs, for company; the valleys and the rootwoods and the deep green order of it, all of it composed, all of it tended. Nothing here is wild the way you mean wild. It is a garden whose gardeners stood up one season, in the middle of planting, and went home. Why, the stones do not say; there is no ruin of war here, no scar of sickness, only work set down gently, by hands that meant to return by spring. Perhaps spring, where they went, has not come yet. Until it does, the garden keeps growing in their shapes — and now, a little, in yours.',
  },
  crash: {
    name: 'The Crash',
    body: 'They did not choose this world. Their vessel came down the way a tree comes down — all at once, and in pieces, along a long scar of country the far zones still remember. There was one crew. There was one bad week: the landing, the fire, the count of who was left. And then, because they were who they were, there was the long second story — the years of growing shelter out of wreckage, of teaching a broken ship’s gardens to live in open soil, of making a home because no rescue was ever coming to make one for them. The ruins are not temples. They are the rooms of people being stubborn in the particular way of the shipwrecked: everything repaired, everything repurposed, everything kept one season too long. They are gone now, the way crews go. But they were not lost. Read the stones right and they say so themselves: not lost. Landed.',
  },
  long_experiment: {
    name: 'The Long Experiment',
    body: 'This world was a laboratory, and everything living in it — everything — is a result. The Precursors did not garden here for beauty. They posed questions in flesh: how tame can a hunter be bred, and still be a hunter? How much of a people can you grow into a plant before it stops being either? The tameable things you love are the experiments that pleased them. The lantern-fern is a lamp they published. The dog at your hearth is a colleague’s side project, and the things in the far zones, the ones that do not please anybody, are the results nobody signed. In the end the experiment simply… concluded. The staff withdrew in good order, the way staff do, leaving the apparatus running because stopping it would have been the one unethical act left available. The apparatus is running still. You are walking around inside somebody’s data. Be kind to it; some of it can read.',
  },
  evacuation: {
    name: 'The Evacuation',
    body: 'They left in a hurry, and the hurry is written on everything: meals mid-table, projects mid-growth, doors left open behind people who did not expect to be gone long and did not expect to be gone forever, somehow both. For a long time the stones will not tell you what they were fleeing, because the people fleeing did not waste time writing it down. Then you walk far enough out, and you stop needing to be told. The wild country is the reason. Something in the shape of this world — in its deep zones, its hungry valleys, its weather with opinions — was becoming the kind of place the Precursors could no longer keep. So they did the arithmetic that every people in their story eventually does, and they chose each other over the garden. The ruins are not a defeat. They are what love looks like when it has to pack quickly.',
  },
  becoming: {
    name: 'The Becoming',
    body: 'Nobody died here, and nobody left. That is the thing the stones have been trying to tell you, in every ruin that feels less built than grown: the Precursors are not gone. They put down their tools the way a tree puts down nothing at all, and they became what they had been growing toward for centuries — rooted, patient, distributed through the living country like a thought through a mind. The Living Valleys are not named kindly by accident. Some of what watches you there is curious in a way animals are not. Some of the oldest rootwoods keep arrangements no weather made. They traded hands for this, and voices for this, and the small brief shape of a single life for the long green one — and the trade was not a tragedy to them. It was graduation. When the valley reaches for you, grower, understand what is reaching: the gardeners, still gardening, with the only hands they have left.',
  },
  war: {
    name: 'The War',
    body: 'They destroyed themselves, and the world has been politely not mentioning it in every meadow you have ever crossed. The Precursors of this world were gardeners who learned — late, and from each other — that anything grown can be aimed. Root-walls became fortifications. Tamed hunters became arguments. There are zones out there that are not country at all but old battlefields, where nothing tameable will settle to this day because the soil remembers instructions. The ruins are scarred because the war was fought with living things, and living things scar. There was no enemy from the sky, no sickness, no verdict of the deep zones: just a people who disagreed about the garden until the garden was the weapon and then the wound. They are gone the way fires go out. What is left is the proof, in green and stone, that it can happen to anyone who grows things — which is to say, grower, it is left as a warning addressed to you.',
  },
  sickness: {
    name: 'The Sickness',
    body: 'The terrible thing about this world’s ending is how tidy it is. They were not driven out and they did not fall to any war. A sickness came — the grown kind, the kind their own medicine could not outgrow because it grew the way their medicine did — and it took them in one season, in their houses, at their work. Projects stand finished. Tools lie down mid-task, set there carefully, by hands that expected to pick them up in an hour. The ruins are quarantined not by any authority but by habit: the last of them cleaned as they went, the way you tidy a room for whoever comes next. Nobody came next, for a very long time. Then you did. If the stones seem gentle here, it is because the people who carved them spent their last season being gentle on purpose, with the whole of their strength. Sit in their houses respectfully. They kept them for you without ever knowing your name.',
  },
  taken_out: {
    name: 'Taken Out',
    body: 'The Precursors did not end. They were ended. Read the damage in the deep rooms with your new eyes and the shape of it resolves: the scars do not match any grown weapon, any weather, any war the gardeners could have fought among themselves. Something else came to this world — a third party in a story you thought had two — and it did its work thoroughly and left no forwarding address and no ruins of its own. The Precursors were not the top of anything. They were a garden in somebody else’s path. The stones do not know the strangers’ names, because the strangers never stayed to be named; they are the only blank in a world where everything else can be read. Whether they are still out there, the chapter cannot tell you. The chapter can only tell you the one thing the survivors carved, over and over, in the deepest rooms, like a note left on a door: it was not us. Remember that it was not us.',
  },
  uplift: {
    name: 'The Uplift',
    body: 'Of all the ways a world can end, this is the kind one. They were visited — as, the stones say, they had once visited others — by a people older and stranger than themselves, who looked at the garden and the gardeners and offered them the one gift gardeners cannot grow: more garden, elsewhere, forever. And the Precursors, being who they were, said yes. The ruins are orderly because the leaving was orderly: stores distributed, experiments settled into self-tending, the dog left where a dog could decide for itself, everything watered one last time. There is gratitude in these stones so plain it embarrasses the carver, and no grief at all that is not the ordinary grief of a doorway. They were not taken and they did not flee. They were invited, and they went, the way seeds go when the wind finally offers. Somewhere, the gardeners are gardening. It is not impossible that they are proud of how theirs has kept.',
  },
  departure: {
    name: 'The Departure',
    body: 'This was a hometown, and one day the town left. Not fled — the stones are clear about the difference, and proud of it — but departed, in good order and by their own road, through the grown stations whose rings still stand in the grand ruins. A people who had been native here since before their own records simply decided, together, over years of argument nobody won and everybody survived, that their story belonged somewhere else now. They packed like gardeners: cuttings taken, seeds banked, the wild things released from every obligation, the tame things given the choice — and the record notes, with a plainness that undoes you, how many of the tame things chose to stay. You have met their descendants at your own hearth. The stations stand open and patient because leaving well means leaving the road in repair for whoever comes after. It was never a disaster site, grower. It is a house whose family moved away, kept clean by everyone who loved it.',
  },
  return_to_water: {
    name: 'Return to Water',
    body: 'They went back to the water, and the water has been keeping their secret in every pond you have ever waded. The Precursors of this world were never quite as land-bound as their ruins suggest; the rivers were their first roads and the deep places their first country. When the change came — and the stones, unusually, call it a homecoming and not a loss — they unmade their land-lives the way they had made everything: slowly, by growing. They dissociated from their tools, their houses, their own shapes, season by season, until what had been a people of growers was a presence in the bright water, remembering being hands the way you remember a dream at breakfast. The ruins drowned because the water rose to meet them halfway, like family. Are they still present? The pond things know your step before you take it. The chapter will not say more than that. Some stories the world keeps in the first person.',
  },
};
