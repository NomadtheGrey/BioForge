// ====================================================================
// systemChat — the projection from the system stream into
// the co-op chat (Adam's ruling, 2026-10-18).
//
// WHY: the stream's own HUD panel was one HUD item too many
// on a busy screen, and system word is the LESS common voice
// — so it moves into the chat UI players already read,
// wearing its own names: SYSTEM for the automated word
// (greetings, new-build lines), ADMIN for the grower's
// broadcasts. The panel retired the same day; the start
// screen's NEWS seat remains the archive.
//
// Pure: SystemLine[] in (useSystemFeed's stream), chat
// entries out. App forwards entries it hasn't forwarded
// (by id) into useMultiplayerSync's appendSystemChat — the
// same log + toast sink as a player's own message.
// ====================================================================

import type { SystemLine } from '../hooks/useSystemFeed';

export interface SystemChatEntry {
  id: string;
  sender: 'SYSTEM' | 'ADMIN';
  text: string;
  /** Notice-level: the notification toast already fired for
   *  this line, so the chat entry joins the LOG only (no
   *  second toast). Non-notice entries toast like chat. */
  notice: boolean;
}

export function projectSystemLines(lines: SystemLine[]): SystemChatEntry[] {
  const entries: SystemChatEntry[] = [];
  // The greeting arrives as a title line + one line per
  // note; in chat it is ONE message. Group by the greeting's
  // id stem ('greet:<stamp>' and 'greet:<stamp>:<i>').
  const greetingNotes = new Map<string, string[]>();
  const greetingHeads = new Map<string, SystemLine>();
  for (const line of lines) {
    if (line.kind === 'build') {
      const stem = line.id.split(':').slice(0, 2).join(':');
      if (line.id === stem) greetingHeads.set(stem, line);
      else {
        const notes = greetingNotes.get(stem) ?? [];
        notes.push(line.text);
        greetingNotes.set(stem, notes);
      }
    }
  }
  const greetedStems = new Set<string>();
  for (const line of lines) {
    if (line.kind === 'build') {
      const stem = line.id.split(':').slice(0, 2).join(':');
      if (greetedStems.has(stem)) continue;
      greetedStems.add(stem);
      const head = greetingHeads.get(stem);
      const notes = greetingNotes.get(stem) ?? [];
      // The head's text is the notes' title; when the first
      // note already opens with it (the honest default does),
      // don't say it twice.
      const parts = head ? [head.text, ...notes] : [...notes];
      if (parts.length > 1 && parts[1].startsWith(parts[0])) parts.shift();
      entries.push({
        id: stem,
        sender: 'SYSTEM',
        text: `${head?.title ?? 'While you were away'} — ${parts.join(' ')}`,
        notice: false,
      });
    } else if (line.kind === 'stale') {
      entries.push({ id: line.id, sender: 'SYSTEM', text: line.text, notice: line.notice });
    } else {
      // Broadcasts are the grower's own word: ADMIN.
      entries.push({
        id: line.id,
        sender: 'ADMIN',
        text: line.title ? `${line.title} — ${line.text}` : line.text,
        notice: line.notice,
      });
    }
  }
  return entries;
}
