/**
 * links — the game's doors to the outside (Adam, 2026-10-18).
 *
 * Every external destination the UI points at lives behind ONE
 * constant here, so a door lights up everywhere at once when
 * its address exists — and stays dark, honestly, until it does.
 *
 * DONATE_URL: the BioForge itch page's donation door. The page
 * itself stands at wrap (~Oct 24); until the address is real,
 * this stays null and NO donate button renders anywhere — a
 * support button that 404s costs more goodwill than a week's
 * patience. The day the page stands, set the URL here and both
 * seats (the start-screen header and the Game Info screen)
 * light in the same build.
 */
export const DONATE_URL: string | null = null;
