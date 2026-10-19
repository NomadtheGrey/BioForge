/**
 * feedbackSend — the feedback modal's sending arm (Adam, 2026-10-19:
 * his choice for replacing the modal's mailto handoff with a real
 * in-page send).
 *
 * THE SETUP CONTRACT — this module sends template_params named
 * exactly: { subject, message, from_email, reply_to }. The EmailJS
 * template on Adam's side must declare those same variables, so a
 * mis-matched template is a setup bug, not a code bug:
 *   template subject:  {{subject}}
 *   template body:     {{message}}
 *   Reply To:          {{reply_to}}
 * and the EmailJS service behind EMAILJS_SERVICE_ID is the Gmail
 * service connected to FEEDBACK_EMAIL (bioforge.game@gmail.com).
 *
 * WHY REST, NOT THE SDK: the send is one plain POST to EmailJS's
 * public API — a fetch is all of it. The codebase is
 * dependency-lean by Adam's standing preference, and a library
 * would buy nothing the endpoint doesn't give directly. The
 * contract is exported once and documented here so the next
 * hand reads the wire in this file instead of a README.
 *
 * THE NEVER-THROW LAW: sendFeedback resolves every failure as a
 * value ({ ok: false, reason }) — a modal showing a sending
 * spinner must never owe its player a stack trace. The modal
 * owns the fallback door (mailto); this module only reports.
 *
 * THE DARK-UNTIL-LIT LAW: EMAILJS_* are all null until Adam
 * completes the account setup; feedbackSendConfigured() is
 * false then, and the modal keeps its mailto door. A
 * half-addressed service never half-sends.
 *
 * ANTI-ABUSE (Adam's setup step, named honestly here): the
 * public key is DESIGNED to ship in client code — its safety
 * is not secrecy. What stops a stranger from spending the
 * quota is EmailJS's Allowed Domains restriction, which Adam
 * sets to the game's own addresses (the itch page and the
 * Workers dev URL) in the dashboard. There is no origin
 * allowlist in this file — the browser would have to send
 * the key with the request anyway, so a client-side check
 * would be theater, not protection.
 */

import {
  EMAILJS_SERVICE_ID,
  EMAILJS_TEMPLATE_ID,
  EMAILJS_PUBLIC_KEY,
} from './links';

const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';

/** Ten seconds: a feedback send must never hold the modal hostage. */
const SEND_TIMEOUT_MS = 10_000;

/** What the modal passes: the composed note, already worded. */
export interface FeedbackSendInput {
  /** The composed subject ("BioForge — issue: …"), built by the modal. */
  subject: string;
  /** The composed body, with whatever footer the modal attached. */
  message: string;
  /**
   * The player's own address, when they want a reply —
   * optional by design. Sent as from_email AND reply_to so
   * the game's inbox can answer the player directly.
   * Empty string when they keep it to themselves.
   */
  fromEmail?: string;
}

export type FeedbackSendFailure = 'unconfigured' | 'network' | 'rejected';

/** Never throws — read the reason, never a stack. */
export type FeedbackSendResult =
  | { ok: true }
  | { ok: false; reason: FeedbackSendFailure; status?: number };

/**
 * Is the direct-send door lit? All three constants must be
 * addressed — links.ts owns their darkness until then.
 */
export function feedbackSendConfigured(): boolean {
  return (
    EMAILJS_SERVICE_ID !== null &&
    EMAILJS_TEMPLATE_ID !== null &&
    EMAILJS_PUBLIC_KEY !== null
  );
}

/**
 * Send the note through EmailJS. Resolves { ok: true } on a 200,
 * { ok: false, reason } for everything else — including the
 * unconfigured state, which never touches the network.
 */
export async function sendFeedback(
  input: FeedbackSendInput,
): Promise<FeedbackSendResult> {
  if (!feedbackSendConfigured()) {
    return { ok: false, reason: 'unconfigured' };
  }
  const fromEmail = input.fromEmail ?? '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(EMAILJS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: {
          subject: input.subject,
          message: input.message,
          from_email: fromEmail,
          reply_to: fromEmail,
        },
      }),
    });
    if (res.ok) return { ok: true };
    // Rejected at the service: bad IDs, disabled service, spent
    // quota — the status names the class; the modal shows the
    // fallback door, never the raw number.
    return { ok: false, reason: 'rejected', status: res.status };
  } catch {
    // Abort (timeout), DNS, offline — one honest word for all of
    // the ways the wire can fail silently.
    return { ok: false, reason: 'network' };
  } finally {
    clearTimeout(timer);
  }
}
