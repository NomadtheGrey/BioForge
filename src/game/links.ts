/**
 * links — the game's doors to the outside (Adam, 2026-10-18).
 *
 * Every external destination the UI points at lives behind ONE
 * constant here, so a door lights up everywhere at once when
 * its address exists — and stays dark, honestly, until it does.
 *
 * DONATE_URL: the BioForge itch page's donation door. The page
 * itself stands at wrap (~Oct 24); until the address is real,
 * this stays null. The BUTTON, though, renders everywhere
 * from the start (Adam's later call, 2026-10-18: the Donation
 * door sits beside Credits wherever Credits lies) — capped
 * and honest about it, via components/DonateButton. The day
 * the page stands, set the URL here and every seat wires
 * itself in the same build.
 */
export const DONATE_URL: string | null = null;

/**
 * FEEDBACK_EMAIL: where a player's word lands (Adam,
 * 2026-10-18) — the game's own Gmail. The FeedbackModal
 * composes a note and hands it to the player's mail program
 * addressed here; if a real backend ever replaces that, the
 * address still stands as the destination of record.
 */
export const FEEDBACK_EMAIL = 'bioforge.game@gmail.com';
