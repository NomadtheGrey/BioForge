/**
 * useAudioSettings — the player's sound balance (Adam, 2026-10-17).
 *
 * BioForge is getting a generative audio program: the music is
 * GROWN (slow motifs seeded by place, a scale and instrument set
 * per biome family, day/night layers), and creature voices are
 * COMPUTED from each creature's own data record. One WebAudio
 * synth core will serve both, plus the flora sounds after them.
 *
 * This hook is the MIX shelf those consumers will read: one
 * channel per kind of sound, each with its own on/off switch and
 * volume slider, grouped in the HUD Options screen next to the
 * panel switches (Adam: group the sound controls there). The
 * settings exist ahead of the engine on purpose — the shelf is
 * built first, the consumers plug into it, the same pattern as
 * HUD_PANELS for the layout.
 *
 * Like the HUD arrangement, this is a DEVICE preference, not
 * world data: it persists in localStorage on this device only
 * and never touches the save file.
 *
 * THE MIX, in one breath: a channel's EFFECTIVE gain is its own
 * slider, folded through Master — Master off (or at zero)
 * silences everything, whatever the channels say. The synth
 * core reads effectiveGain() when a sound triggers; it does not
 * subscribe to anything. That keeps the quiet end honest:
 * silence in this game is a designed material (the Departure's
 * finale needs an overwhelming one), so nothing in here ever
 * normalizes or floors a channel's gain upward.
 */

import { useCallback, useState } from 'react';

/** Every kind of sound the game will make, as its own channel. */
export type AudioChannelId =
  | 'master'
  | 'music'
  | 'creatures'
  | 'plants'
  | 'interface';

export interface AudioChannelMeta {
  id: AudioChannelId;
  /** The name shown in the Options SOUND section. */
  label: string;
  /** One plain line under the name in the Options list. */
  blurb: string;
  /** Where the slider starts before the player ever touches it. */
  defaultLevel: number;
}

/**
 * The SOUND section's table of contents. When a new kind of
 * sound ships (the flora program is the known next one), it
 * joins this list and gains a switch + slider in Options and a
 * readable gain for its engine, with no new menu anywhere.
 */
export const AUDIO_CHANNELS: AudioChannelMeta[] = [
  { id: 'master', label: 'Master', blurb: 'Everything you hear, through one hand. Master off silences the whole mix.', defaultLevel: 1 },
  { id: 'music', label: 'Background Music', blurb: 'The grown tunes — seeded by the country you are standing in, layered by day and night.', defaultLevel: 0.8 },
  { id: 'creatures', label: 'Creature Voices', blurb: 'Calls, warnings, and greetings — each voice computed from the creature itself.', defaultLevel: 0.9 },
  { id: 'plants', label: 'Plants & Garden', blurb: 'Rustles, creaks, and growing sounds from the flora around you.', defaultLevel: 0.8 },
  { id: 'interface', label: 'Interface', blurb: 'Clicks, confirmations, and the little sounds the screens make.', defaultLevel: 0.7 },
];

export interface AudioChannelState {
  on: boolean;
  /** Slider position, 0..1. Stored linear; the engine applies
   *  its own perceptual curve when it spends the number. */
  level: number;
}

export type AudioSettingsState = Record<AudioChannelId, AudioChannelState>;

const STORAGE_KEY = 'bioforge.audio.v1';

const defaultSettings = (): AudioSettingsState => {
  const out = {} as AudioSettingsState;
  for (const ch of AUDIO_CHANNELS) out[ch.id] = { on: true, level: ch.defaultLevel };
  return out;
};

/** Read the saved balance once, tolerating anything malformed.
 *  Exported for the future synth core: non-React engine code
 *  calls this at trigger time and gets the player's live mix. */
export const loadAudioSettings = (): AudioSettingsState => {
  const out = defaultSettings();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return out;
    const parsed = JSON.parse(raw) as Partial<Record<AudioChannelId, Partial<AudioChannelState>>>;
    for (const ch of AUDIO_CHANNELS) {
      const saved = parsed[ch.id];
      if (!saved) continue;
      if (typeof saved.on === 'boolean') out[ch.id].on = saved.on;
      if (typeof saved.level === 'number' && Number.isFinite(saved.level)) {
        out[ch.id].level = Math.min(1, Math.max(0, saved.level));
      }
    }
    return out;
  } catch {
    return out;
  }
};

const saveAudioSettings = (state: AudioSettingsState): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // A device that refuses storage just loses persistence;
    // the mix still works for the session.
  }
};

/** A channel's gain as the engine should spend it: the
 *  channel's own switch and slider, folded through Master. */
export const effectiveGain = (state: AudioSettingsState, id: AudioChannelId): number => {
  const master = state.master;
  if (!master.on || master.level <= 0) return 0;
  if (id === 'master') return master.level;
  const ch = state[id];
  if (!ch.on) return 0;
  return master.level * ch.level;
};

export interface AudioSettings {
  state: AudioSettingsState;
  isOn: (id: AudioChannelId) => boolean;
  levelOf: (id: AudioChannelId) => number;
  setOn: (id: AudioChannelId, on: boolean) => void;
  setLevel: (id: AudioChannelId, level: number) => void;
  /** The engine's one question, pre-answered for a channel. */
  gainFor: (id: AudioChannelId) => number;
}

export const useAudioSettings = (): AudioSettings => {
  const [state, setState] = useState<AudioSettingsState>(loadAudioSettings);

  const update = useCallback((id: AudioChannelId, patch: Partial<AudioChannelState>) => {
    setState((prev) => {
      const next = { ...prev, [id]: { ...prev[id], ...patch } };
      saveAudioSettings(next);
      return next;
    });
  }, []);

  return {
    state,
    isOn: useCallback((id: AudioChannelId) => state[id].on, [state]),
    levelOf: useCallback((id: AudioChannelId) => state[id].level, [state]),
    setOn: useCallback((id: AudioChannelId, on: boolean) => update(id, { on }), [update]),
    setLevel: useCallback(
      (id: AudioChannelId, level: number) =>
        update(id, { level: Math.min(1, Math.max(0, level)) }),
      [update],
    ),
    gainFor: useCallback((id: AudioChannelId) => effectiveGain(state, id), [state]),
  };
};
