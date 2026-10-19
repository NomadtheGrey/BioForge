/**
 * slumber.ts — the Slumber Husk's sleep law (BioForge wave 2, 2026-10-19).
 *
 * Adam's bed ruling, verbatim: not down — "a fleshy soft, gross but
 * comfy place." The husk is gel flesh, fiber skin, dew to keep it
 * alive, thread to stitch it shut. Its one job: at night, put the
 * world to sleep until dawn.
 *
 * THE CLOCK: sleeping jumps the Sol-cycle — the App-owned
 * dayNightCycle the engine reads (setDayNightTime) and the
 * host's loop ticks — to just inside the day band. It is the
 * same writer the HUD's debug day/night toggle and the
 * playtest phase setter use, so the jump is a known motion
 * of the sim, not a fork of its math. Nothing here fakes time.
 *
 * WHAT THE JUMP DOES NOT MOVE (checked 2026-10-19, sleep slice):
 * - Vat gestations and broth fermentations ride SECONDS OF
 *   LOADED-ZONE TIME (vat.ts, broths.ts) — a separate
 *   accumulated clock. Sleeping does not fast-forward them;
 *   the vat you leave at midnight is exactly as pregnant
 *   when you wake. By design: sleep is rest, not a cheat.
 * - The sky calendar rides WALL CLOCK from createdAt, so
 *   "Day N" on the HUD clock does not advance — only the
 *   dial moves, to 06:00-odd. The shower calendar still
 *   holds tonight's shower; the sky rig's meteor list,
 *   which latches on night entry and releases at dawn,
 *   simply never gets watched. That is the trade the
 *   design names: sleep through a meteor shower, miss
 *   the shower.
 * - The sim's dawn-crossing watcher (useWorldEntities, the
 *   hermit's dawn gift) needs prev < 0.25 AND now >= 0.25.
 *   A jump from night (say 0.85) to dawn (0.26) fails the
 *   first condition — the crossing is SKIPPED, not
 *   repeated. Coherent: the night passed without a
 *   witness, so dawn's small gifts pass too.
 *
 * CO-OP LAW: the sky belongs to the host (the host's tick is
 * the cycle's one writer; guests adopt via day_night
 * messages). A guest must not put the world to sleep — the
 * gate lives in the interaction, next to the host's own
 * condition.
 */

// ---------------------------------------------------------------------------
// The phase vocabulary (the engine's own: 0.25 = sunrise, 0.5 = noon,
// 0.75 = sunset, 0 = midnight — skyRig.ts; the day band 0.25-0.75 is
// the same interval the scar-heat and thaw-cold passes read).
// ---------------------------------------------------------------------------

/**
 * The moment sleep delivers: just inside the day band, where
 * the engine's night dome releases and the meteor latch
 * lets go. Not 0.25 exactly — the exact edge reads as
 * "still night" to half-open interval checks.
 */
export const SLUMBER_DAWN_PHASE = 0.26;

/**
 * The hours the husk is for: the night band, the complement
 * of the engine's day interval (the same predicate the
 * thaw-cold pass uses: cycle <= 0.25 || cycle >= 0.75).
 * From dusk onward, inclusive.
 */
export function isSleepHour(phase: number): boolean {
  return phase <= 0.25 || phase >= 0.75;
}

/** The dawn a sleep delivers. One place owns the number. */
export function nextDawnPhase(): number {
  return SLUMBER_DAWN_PHASE;
}
