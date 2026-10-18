/**
 * useAudioEngine.ts — the audio program's conductor (Adam's
 * build order, 2026-10-18).
 *
 * App mounts this hook once, handing it a snapshot getter
 * over refs it already owns. Four times a second the hook:
 *
 *   1. Keeps the graph honest to the SOUND shelf — the
 *      settings are re-read and re-applied whenever they
 *      change, so an Options slider moves the mix live.
 *   2. Tells the music director where the player is standing
 *      (family, hybrid visitor, coordinates, night, sky, depth,
 *      the scar, the hearth) and lets it schedule.
 *   3. Watches the fauna for the SETTLED occasions and plays
 *      their calls under CHORUS DISCIPLINE: at most three
 *      voices at once, the nearest first — a herd is a chorus,
 *      never a crowd. The game logic is never touched: every
 *      occasion is an OBSERVED transition (an entity crossing
 *      into earshot, a state flipping to alert, a hurt animal
 *      vanishing), which keeps this hook a listener, not a
 *      participant.
 *
 * The AudioContext is born on the player's first gesture —
 * browsers demand one, and the game's own rhythm (click to
 * look, click to start) provides it without any ceremony.
 * A hidden tab suspends the context: silence, honestly.
 */

import { useEffect, useRef } from 'react';
import type { BiomeId } from '../game/world/biomes';
import type { FaunaEntity, StructureEntity } from '../types/game';
import {
  applySettings,
  audioCtx,
  ensureCtx,
  resumeAudio,
  suspendAudio,
} from '../game/engine/synthCore';
import { MusicDirector, type MusicContext } from '../game/engine/musicDirector';
import { playCall, voiceParamsFor } from '../game/engine/creatureVoices';
import { cometStatesAt, nightSkyAt, skyRosterNow } from '../game/world/skyCalendar';
import { loadAudioSettings } from './useAudioSettings';

// ---------------------------------------------------------------------------
// The snapshot App hands over (built from its own refs)
// ---------------------------------------------------------------------------

export interface AudioSnapshot {
  worldSeed: string;
  zx: number;
  zz: number;
  biome: BiomeId;
  secondary: BiomeId | null;
  /** World clock phase: 0 midnight, 0.25 sunrise, 0.5 noon,
   *  0.75 sunset (the shared convention). */
  dayNight: number;
  /** Cavern stratum; 0 elsewhere. */
  depth: number;
  inRuin: boolean;
  player: { x: number; z: number; rotation: number };
  fauna: FaunaEntity[];
  floraCount: number;
  structures: StructureEntity[];
}

// ---------------------------------------------------------------------------
// Small derivations
// ---------------------------------------------------------------------------

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Phase → nightness: distance around the clock from noon,
 *  smoothed so dawn and dusk are crossfades, not switches. */
function nightness(phase: number): number {
  const d = Math.abs(phase - 0.5);
  const wrapped = Math.min(d, 1 - d); // 0 at noon, 0.5 at midnight
  const t = clamp01((wrapped - 0.16) / (0.4 - 0.16));
  return t * t * (3 - 2 * t);
}

const dist = (ax: number, az: number, bx: number, bz: number) =>
  Math.hypot(ax - bx, az - bz);

/** Call loudness by distance — absolute gain for the synth
 *  core's scale (peaks ~0.17 up close, gone by 40 paces). */
const gainAt = (d: number) => 0.17 * Math.pow(clamp01(1 - d / 40), 1.4);
const brightAt = (d: number) => Math.max(0.15, clamp01(1 - d / 45));

interface Seen {
  species: string;
  state: FaunaEntity['state'];
  x: number;
  z: number;
  dist: number;
  health: number;
  maxHealth: number;
  lastGreet: number;
  lastAlert: number;
}

// ---------------------------------------------------------------------------
// The hook
// ---------------------------------------------------------------------------

export function useAudioEngine(deps: { getSnapshot: () => AudioSnapshot | null }): void {
  const directorRef = useRef<MusicDirector | null>(null);
  const seenRef = useRef<Map<string, Seen>>(new Map());
  const zoneKeyRef = useRef('');
  const activeCallsRef = useRef<number[]>([]); // ctx-times when calls end
  const lastDeathRef = useRef(0);
  const settingsJsonRef = useRef('');

  // ── Birth on first gesture; sleep with the tab ──────────
  useEffect(() => {
    const unlock = () => {
      if (ensureCtx()) {
        applySettings(loadAudioSettings());
        settingsJsonRef.current = JSON.stringify(loadAudioSettings());
        resumeAudio();
      }
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
    const onVis = () => {
      if (document.hidden) suspendAudio();
      else resumeAudio();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // ── The 4 Hz conductor's beat ─────────────────────────────
  useEffect(() => {
    const tick = () => {
      // The shelf, live: a slider moved in Options lands in
      // the graph within a beat.
      const settings = loadAudioSettings();
      const json = JSON.stringify(settings);
      if (json !== settingsJsonRef.current) {
        settingsJsonRef.current = json;
        applySettings(settings);
      }

      const ac = audioCtx();
      const snap = deps.getSnapshot();
      if (!ac || ac.state !== 'running' || !snap) return;
      const now = ac.currentTime;
      const night = nightness(snap.dayNight);

      // ── The sky, from the calendar the rig already keeps ──
      let comet = false;
      let shower = false;
      let dayIndex = 0;
      const skyNow = skyRosterNow(Date.now());
      if (skyNow) {
        dayIndex = Math.floor(skyNow.tDays);
        comet = cometStatesAt(skyNow.roster, skyNow.tDays).some((c) => c.visible);
        shower = !!nightSkyAt(skyNow.roster, dayIndex).shower;
      }

      // ── The scar and the hearth, by proximity ─────────────
      let scar = false;
      let hearth = 0;
      for (const s of snap.structures) {
        const d = dist(s.worldX, s.worldZ, snap.player.x, snap.player.z);
        if (s.type === 'the_scar' && d < 15) scar = true;
        if (s.type === 'hearthpod') hearth = Math.max(hearth, clamp01(1 - d / 20));
      }

      // ── Music ─────────────────────────────────────────────
      if (!directorRef.current) directorRef.current = new MusicDirector();
      const mc: MusicContext = {
        biome: snap.biome,
        secondary: snap.secondary,
        worldSeed: snap.worldSeed,
        zx: snap.zx,
        zz: snap.zz,
        night,
        dayIndex,
        comet,
        shower,
        depth: snap.depth,
        inRuin: snap.inRuin,
        scar,
        hearth,
        // Lushness, first pass: the visible flora stand for
        // the country. The map holds this curve open for
        // tuning by ear — it is a knob, not a law.
        lush: Math.max(0.35, Math.min(1.3, snap.floraCount / 110)),
      };
      directorRef.current.setContext(mc);
      directorRef.current.update();

      // ── Creature occasions ────────────────────────────────
      if (!settings.master?.on || !settings.creatures?.on) return;
      const zoneKey = `${snap.zx},${snap.zz}|${snap.depth}|${snap.inRuin ? 'ruin' : 'surf'}`;
      if (zoneKey !== zoneKeyRef.current) {
        // Travel is not death: a new zone starts a fresh watch
        // and nothing that vanished across the border is mourned.
        zoneKeyRef.current = zoneKey;
        seenRef.current.clear();
      }
      const seen = seenRef.current;
      activeCallsRef.current = activeCallsRef.current.filter((end) => end > now);
      const chorusOpen = () => activeCallsRef.current.length < 3;
      const bookCall = (dur: number) => activeCallsRef.current.push(now + dur);

      const panFor = (x: number, z: number) => {
        const ang = Math.atan2(x - snap.player.x, z - snap.player.z) - snap.player.rotation;
        return Math.max(-1, Math.min(1, Math.sin(ang)));
      };

      const current = new Map<string, FaunaEntity>();
      for (const e of snap.fauna) current.set(e.id, e);

      // Deaths first (they read the OLD seen entries).
      for (const [id, prev] of seen) {
        if (current.has(id)) continue;
        const diedHurt = prev.health <= prev.maxHealth * 0.3 || prev.state === 'attacking';
        if (diedHurt && prev.dist < 40 && now - lastDeathRef.current > 5 && chorusOpen()) {
          const v = voiceParamsFor(prev.species, id);
          playCall('death', v, { at: now + 0.05, gain: gainAt(prev.dist), pan: panFor(prev.x, prev.z), bright: brightAt(prev.dist) });
          bookCall(1.6);
          lastDeathRef.current = now;
        }
        seen.delete(id);
      }

      for (const e of snap.fauna) {
        const d = dist(e.x, e.z, snap.player.x, snap.player.z);
        const prev = seen.get(e.id);
        const v = voiceParamsFor(e.species, e.id);
        const at = now + 0.05;

        if (!prev) {
          // First sight. A creature that arrives already tame
          // near its person was very likely born in the vat a
          // moment ago — the imprint chirp is its hello.
          if (e.isTamed && d < 22 && chorusOpen()) {
            playCall('imprint', v, { at, gain: gainAt(d) * 1.1, pan: panFor(e.x, e.z), bright: brightAt(d) });
            bookCall(0.6);
          }
        } else {
          // Greeting: a companion or follower crossing into
          // earshot (companions and the settled greet before
          // the wild — the wild are not wired with one at all
          // in this pass, per the settled occasion set).
          const entering = prev.dist >= 14 && d < 14;
          if (
            entering && (e.isTamed || e.state === 'following') &&
            now - prev.lastGreet > 45 && chorusOpen()
          ) {
            playCall('greeting', v, { at, gain: gainAt(d), pan: panFor(e.x, e.z), bright: brightAt(d) });
            bookCall(1.1);
            prev.lastGreet = now;
            // The Answer: a social neighbor says the word back.
            if (v.social > 0.3) {
              const candidates = snap.fauna.filter(
                (o) => o.id !== e.id && dist(o.x, o.z, e.x, e.z) < 20,
              );
              for (const o of candidates) {
                const ov = voiceParamsFor(o.species, o.id);
                if (ov.social <= 0.3) continue;
                const od = dist(o.x, o.z, snap.player.x, snap.player.z);
                playCall('answer', ov, {
                  at: at + 0.55 + ((e.id.charCodeAt(0) + o.id.charCodeAt(0)) % 60) / 100,
                  gain: gainAt(od), pan: panFor(o.x, o.z), bright: brightAt(od),
                });
                bookCall(0.6);
                break; // one answerer — a reply, not a roll call
              }
            }
          }
          // The alert tell: the flip into alert or attack IS
          // the information, whoever it belongs to.
          const flipped =
            prev.state !== e.state && (e.state === 'alert' || e.state === 'attacking');
          if (flipped && d < 34 && now - prev.lastAlert > 20 && chorusOpen()) {
            playCall('alert', v, { at, gain: gainAt(d), pan: panFor(e.x, e.z), bright: brightAt(d) });
            bookCall(0.5);
            prev.lastAlert = now;
          }
        }

        seen.set(e.id, {
          species: e.species,
          state: e.state,
          x: e.x,
          z: e.z,
          dist: d,
          health: e.health,
          maxHealth: e.maxHealth,
          lastGreet: prev?.lastGreet ?? 0,
          lastAlert: prev?.lastAlert ?? 0,
        });
      }
    };

    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
    // deps.getSnapshot is a stable useCallback in App.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

}
