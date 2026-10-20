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

/**
 * EMAILJS_*: the feedback door's sending service (Adam,
 * 2026-10-19 — his choice for replacing the mailto handoff
 * with a real in-page send). The FeedbackModal composes the
 * note exactly as before; feedbackSend.ts sends it through
 * EmailJS's REST endpoint addressed here. All three stand
 * `null` today — and per this file's law the direct-send
 * door stays dark until they don't. Where Adam gets them
 * (the EmailJS dashboard):
 *   EMAILJS_SERVICE_ID  — Email Services → the Gmail service
 *     connected to FEEDBACK_EMAIL (bioforge.game@gmail.com)
 *   EMAILJS_TEMPLATE_ID — Email Templates → the template
 *     whose subject is {{subject}}, whose body is
 *     {{message}}, and whose Reply To is {{reply_to}}
 *   EMAILJS_PUBLIC_KEY  — Account → API Keys → Public Key
 * The public key is DESIGNED to ship in client code; its
 * safety lives in EmailJS's Allowed Domains restriction,
 * which Adam sets to the game's own addresses (see the
 * anti-abuse note in feedbackSend.ts). Until all three are
 * set, the modal keeps its mailto door: nothing half-lights.
 */
export const EMAILJS_SERVICE_ID: string | null = 'service_ikopy7e';
export const EMAILJS_TEMPLATE_ID: string | null = 'template_wz423zk';
export const EMAILJS_PUBLIC_KEY: string | null = '88JIcq827fzALh_3RWD';
