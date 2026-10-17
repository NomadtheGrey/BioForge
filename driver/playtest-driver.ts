/**
 * PLAYTEST KIT DRIVER — verifies the kit's pure pieces: the
 * row search (src/components/playtestSearch.ts) against
 * synthetic rows, and the called-shower seam
 * (src/game/world/skyCalendar.ts) against a synthetic seed.
 *
 * Run: npx tsx driver/playtest-driver.ts
 */
import { filterSearchRows, type SearchRow } from '../src/components/playtestSearch';
import {
  setSkyWorld,
  skyRosterFor,
  nightSkyAt,
  callShowerTonight,
  SHOWER_BLOCK_DAYS,
} from '../src/game/world/skyCalendar';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

const rows: SearchRow[] = [
  { id: 'lantern_shield', name: 'Lantern Shield' },
  { id: 'hand_lantern_fern', name: 'Hand Lantern-Fern' },
  { id: 'scute_shield', name: 'Scute Shield' },
  { id: 'lantern_fern_post', name: 'Lantern-Fern Lamp Post' },
  { id: 'resin_sap', name: 'Resin Sap' },
];

console.log('1. filterSearchRows');
{
  // An empty query returns the rows in registry order, capped.
  const empty = filterSearchRows(rows, '');
  check('empty query returns the head of the list', empty.length === rows.length && empty[0].id === 'lantern_shield');

  // A name prefix beats a mere substring: "lantern sh" puts
  // the Lantern Shield ahead of the Scute Shield, which only
  // carries the words further in.
  const prefix = filterSearchRows(rows, 'lantern sh');
  check('name-prefix outranks substring', prefix[0].id === 'lantern_shield', prefix.map((r) => r.id).join(','));

  // Typing with spaces finds underscore ids.
  const spaced = filterSearchRows(rows, 'lantern shield');
  check('underscores read as spaces', spaced.some((r) => r.id === 'lantern_shield'), spaced.map((r) => r.id).join(','));

  // The limit is honored even when everything matches.
  const limited = filterSearchRows(rows, 'lantern', 2);
  check('limit caps the results', limited.length === 2);

  // An id-only hit still surfaces (the name carries none of it).
  const idOnly = filterSearchRows([{ id: 'fulgurite_shard', name: 'Skyglass' }], 'fulgurite');
  check('id-only matches are found', idOnly.length === 1);

  // Nothing matching means nothing returned.
  check('no match, no rows', filterSearchRows(rows, 'xyzzy').length === 0);
}

console.log('2. the called shower');
{
  const SKY_DAY_MS = 600_000;
  const createdAt = Date.UTC(2026, 9, 17, 0, 0, 0);
  const seed = 'playtest-driver-seed';

  // Before any world is set the clock is dark and the call
  // is refused — the panel speaks "no sky yet" instead.
  check('no world, no call', callShowerTonight(createdAt) === false);

  setSkyWorld(seed, createdAt);
  const roster = skyRosterFor(seed);

  // Find this block's own seeded shower night by scanning
  // the block: exactly one night per block deals one.
  const naturalDay = Array.from({ length: SHOWER_BLOCK_DAYS }, (_, i) => i)
    .find((d) => nightSkyAt(roster, d).shower !== null)!;
  const natural = nightSkyAt(roster, naturalDay).shower!;
  check('the block deals exactly one seeded shower',
    Array.from({ length: SHOWER_BLOCK_DAYS }, (_, i) => i).filter((d) => nightSkyAt(roster, d).shower !== null).length === 1,
    `day ${naturalDay}`);

  // Call for a night that is NOT the block's own: before the
  // call it carries no shower; after, the block's own event
  // shows tonight.
  const callDay = (naturalDay + 7) % SHOWER_BLOCK_DAYS;
  check('the called night is quiet before the call', nightSkyAt(roster, callDay).shower === null);
  check('the call lands', callShowerTonight(createdAt + callDay * SKY_DAY_MS) === true);
  const called = nightSkyAt(roster, callDay).shower;
  check('the called night gains a shower', called !== null);
  if (called) {
    // The event's identity is the block's own — radiant, hue,
    // intensity drawn from the same seeded stream — merely
    // dealt on the called night (its dayIndex is tonight's).
    check('the def is the block\u2019s own event',
      called.def.radiantAzimuthDeg === natural.def.radiantAzimuthDeg
      && called.def.radiantElevationDeg === natural.def.radiantElevationDeg
      && called.def.hue === natural.def.hue
      && called.def.intensity === natural.def.intensity
      && called.def.blockIndex === natural.def.blockIndex,
      JSON.stringify(called.def));
    check('dealt on the called night', called.def.dayIndex === callDay, `dayIndex ${called.def.dayIndex}`);
    check('meteors are dealt for tonight', called.meteors.length > 0, `${called.meteors.length}`);
  }

  // The block's own night is untouched by the call.
  const stillNatural = nightSkyAt(roster, naturalDay).shower;
  check('the natural night stands', stillNatural !== null && stillNatural.def.dayIndex === naturalDay);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
