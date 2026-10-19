/**
 * links — the game's doors to the outside (Adam, 2026-10-18).
 *
 * Every external destination the UI points at lives behind ONE
 * constant here, so a door lights up everywhere at once when
 * its address exists — and stays dark, honestly, until it does.
 *
 * DONATE_URL: the BioForge itch page's donation door. The
 * BUTTON rendered everywhere from the start (Adam's call,
 * 2026-10-18: the Donation door sits beside Credits wherever
 * Credits lies) — capped and honest about it, via
 * components/DonateButton, while the page was still being
 * built. THE PAGE STANDS NOW (Adam published it 2026-10-19):
 * the address below is real, so every seat's itch door is
 * lit in this build — the second support door, beside Ko-fi.
 */
export const DONATE_URL: string | null = 'https://nomadthegrey.itch.io/bioforge';

/**
 * KOFI_URL: the maker's Ko-fi page (Adam, 2026-10-18) — the
 * DonateModal's LIVE door, open today while the itch page
 * waits for launch. Beside DONATE_URL on the switchboard:
 * components read these constants; no address is hard-coded
 * in a seat.
 */
export const KOFI_URL = 'https://ko-fi.com/nomadthegrey';

/**
 * FEEDBACK_EMAIL: where a player's word lands (Adam,
 * 2026-10-18) — the game's own Gmail. The FeedbackModal
 * composes a note and hands it to the player's mail program
 * addressed here; if a real backend ever replaces that, the
 * address still stands as the destination of record.
 */
export const FEEDBACK_EMAIL = 'bioforge.game@gmail.com';
