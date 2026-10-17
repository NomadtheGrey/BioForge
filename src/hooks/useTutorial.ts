/**
 * THE TUTORIAL ENGINE (How to Play program, Adam, 2026-10-17;
 * design: ReadMeFiles/HOW_TO_PLAY_AND_TUTORIAL.md).
 *
 * Walks TUTORIAL_STEPS (hooks/tutorialSteps.ts — the words live
 * there, at a 12-year-old's reading bar). This hook owns only
 * the walking: which step is up, whether gated steps complete
 * themselves, and the per-device memory of it all.
 *
 * HOW IT KNOWS THINGS HAPPENED: App feeds it FACTS each render —
 * plain booleans read off state the game already keeps (a
 * harvest landed, a modal is open). The engine invents no
 * signals of its own; when a gated step's fact turns true, the
 * step completes itself after a short beat so the player can
 * see it land. Gated steps still answer Next/Skip at all times:
 * the tutorial NEVER traps the player.
 *
 * MEMORY: per-device localStorage, like the HUD layout
 * ('bioforge.tutorial.v1') — never the save file. A save is a
 * world; a tutorial record is about the PERSON at the screen.
 * { modalSeen, stepIndex, completed, offered }
 *
 * THE CHROME CONTRACT (HUD lane): render `step` when `active`;
 * highlight the HUD panel whose id is `step.target` (null = no
 * ring); wire buttons and keys to next / skip / exit. `start`
 * resumes where the player left off, or restarts when the walk
 * was completed before.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { TUTORIAL_STEPS, type TutorialStep } from './tutorialSteps';

/** The facts App feeds the engine — all read off existing state. */
export interface TutorialFacts {
  /** A flora harvest has landed this session (or the first-harvest quest is done). */
  harvested: boolean;
  /** The pouch / inventory modal is open right now. */
  pouchOpen: boolean;
  /** The BioForge modal is open right now. */
  forgeOpen: boolean;
  /** The Quest Log is open right now. */
  questsOpen: boolean;
}

interface TutorialRecord {
  modalSeen?: boolean;
  stepIndex?: number;
  completed?: boolean;
  offered?: boolean;
}

const STORAGE_KEY = 'bioforge.tutorial.v1';

function readRecord(): TutorialRecord {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as TutorialRecord;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeRecord(patch: TutorialRecord): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readRecord(), ...patch }));
  } catch {
    // Private mode / storage off: the tutorial simply forgets
    // between sessions. Never let memory plumbing break play.
  }
}

export interface UseTutorialResult {
  /** A step card should be on screen right now. */
  active: boolean;
  /** The step to render (null while inactive). */
  step: TutorialStep | null;
  /** 1-based step number for "Step 3 of 12" chrome. */
  stepNumber: number;
  stepCount: number;
  /** The How to Play modal has been opened at least once (quiets the button's pulse). */
  modalSeen: boolean;
  /** The walk was finished (or stepped through) on this device. */
  completed: boolean;
  /** The one-time first-run offer toast has been shown on this device. */
  offered: boolean;
  start: () => void;
  next: () => void;
  skip: () => void;
  exit: () => void;
  markModalSeen: () => void;
  markOffered: () => void;
}

export function useTutorial(facts: TutorialFacts): UseTutorialResult {
  const [record, setRecord] = useState<TutorialRecord>(() => readRecord());
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const advanceTimer = useRef<number | null>(null);

  const persist = useCallback((patch: TutorialRecord) => {
    writeRecord(patch);
    setRecord((prev) => ({ ...prev, ...patch }));
  }, []);

  /** Move forward one step; past the last step, the walk is done. */
  const advanceFrom = useCallback(
    (from: number) => {
      if (advanceTimer.current !== null) {
        window.clearTimeout(advanceTimer.current);
        advanceTimer.current = null;
      }
      const nextIndex = from + 1;
      if (nextIndex >= TUTORIAL_STEPS.length) {
        setActive(false);
        persist({ completed: true, stepIndex: 0 });
      } else {
        setIndex(nextIndex);
        persist({ stepIndex: nextIndex });
      }
    },
    [persist]
  );

  const start = useCallback(() => {
    // Completed once? Restart from the top (the modal's button
    // doubles as the replay door). Otherwise resume.
    const resumeAt = record.completed ? 0 : Math.min(record.stepIndex ?? 0, TUTORIAL_STEPS.length - 1);
    setIndex(resumeAt);
    setActive(true);
  }, [record.completed, record.stepIndex]);

  const next = useCallback(() => advanceFrom(index), [advanceFrom, index]);
  // Skip is Next with no gate pride: identical mechanics, kept
  // as its own name so the chrome's buttons read honestly.
  const skip = next;

  const exit = useCallback(() => {
    if (advanceTimer.current !== null) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    setActive(false);
    persist({ stepIndex: index });
  }, [index, persist]);

  // GATED STEPS completing themselves: when the current step's
  // fact stands true, advance after a short beat (600 ms — long
  // enough for the player to see the world answer, short enough
  // to feel like the game keeping up).
  const step: TutorialStep | null = active ? TUTORIAL_STEPS[index] ?? null : null;
  const gateFact = step
    ? step.gate === 'harvest'
      ? facts.harvested
      : step.gate === 'openPouch'
        ? facts.pouchOpen
        : step.gate === 'openForge'
          ? facts.forgeOpen
          : step.gate === 'openQuests'
            ? facts.questsOpen
            : false
    : false;
  useEffect(() => {
    if (!active || !step || step.gate === 'manual' || !gateFact) return;
    advanceTimer.current = window.setTimeout(() => advanceFrom(index), 600);
    return () => {
      if (advanceTimer.current !== null) {
        window.clearTimeout(advanceTimer.current);
        advanceTimer.current = null;
      }
    };
  }, [active, step, gateFact, index, advanceFrom]);

  const markModalSeen = useCallback(() => persist({ modalSeen: true }), [persist]);
  const markOffered = useCallback(() => persist({ offered: true }), [persist]);

  return {
    active,
    step,
    stepNumber: active ? index + 1 : 0,
    stepCount: TUTORIAL_STEPS.length,
    modalSeen: record.modalSeen === true,
    completed: record.completed === true,
    offered: record.offered === true,
    start,
    next,
    skip,
    exit,
    markModalSeen,
    markOffered,
  };
}
