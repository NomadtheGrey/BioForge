/**
 * HudOptionsPanel — the HUD Options screen (Adam, 2026-10-16).
 *
 * Opened from the OPTIONS button on the pause / Resume overlay.
 * Its first job (Adam's words): list ALL the HUD elements with
 * on/off switches, so anything hidden — by its ✕ badge or from in
 * here — can always be brought back. It also carries the two
 * recovery buttons: SHOW ALL and RESET POSITIONS.
 *
 * Adam asked for this screen to be REMEMBERED — it is the standing
 * home for HUD / display settings from here on. Future options
 * (scale, opacity, …) should arrive as new sections of THIS panel,
 * fed by the HUD_PANELS registry in useHudLayout, not as new menus.
 *
 * The SOUND section (Adam, 2026-10-17) is the second section to
 * take him up on that: one switch + slider per audio channel,
 * data-driven from AUDIO_CHANNELS in useAudioSettings — the mix
 * shelf the generative audio program will read when it lands.
 */

import React from 'react';
import { LayoutPanelTop, RotateCcw, Eye, Volume2, X } from 'lucide-react';
import { HUD_PANELS, type HudLayout } from '../hooks/useHudLayout';
import { AUDIO_CHANNELS, type AudioSettings } from '../hooks/useAudioSettings';

interface HudOptionsPanelProps {
  layout: HudLayout;
  audio: AudioSettings;
  onClose: () => void;
}

export const HudOptionsPanel: React.FC<HudOptionsPanelProps> = ({ layout, audio, onClose }) => {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/50 pointer-events-auto p-4">
      <div className="glass-panel-biolum w-full max-w-md max-h-[86vh] rounded-2xl flex flex-col border border-cyan-500/50 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-700/60 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <LayoutPanelTop className="w-4.5 h-4.5 text-cyan-300" />
            <div className="flex flex-col">
              <span className="font-tech text-sm tracking-widest text-cyan-200 font-bold">
                HUD OPTIONS
              </span>
              <span className="text-[11px] text-slate-400">
                Show, hide, and arrange the on-screen panels.
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Close options"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* The panel switches — one row per registered HUD element.
            This list is data-driven from HUD_PANELS so it can never
            drift out of sync with the panels that actually exist. */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {HUD_PANELS.map((panel) => {
            const shown = !layout.isHidden(panel.id);
            return (
              <div
                key={panel.id}
                className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-800/40"
              >
                <div className="flex flex-col flex-1 min-w-0">
                  <span className={`text-xs font-tech font-bold ${shown ? 'text-slate-100' : 'text-slate-500'}`}>
                    {panel.label}
                  </span>
                  <span className="text-[11px] text-slate-400 leading-snug">{panel.blurb}</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={shown}
                  aria-label={`${panel.label} ${shown ? 'on' : 'off'}`}
                  onClick={() => layout.setHidden(panel.id, shown)}
                  className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
                    shown
                      ? 'bg-cyan-600/70 border-cyan-400/60'
                      : 'bg-slate-800 border-slate-600/60'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-slate-100 shadow transition-all ${
                      shown ? 'left-[1.375rem]' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        {/* SOUND — the mix shelf (Adam, 2026-10-17). One row per
            channel in AUDIO_CHANNELS: the same switch the panels
            use, plus a slider for where the channel stands in the
            mix. Master rides on top of the list, set apart: its
            switch and slider fold through every other channel. */}
        <div className="px-3 py-2 border-t border-slate-700/60">
          <div className="flex items-center gap-2 px-2 pt-1 pb-1.5">
            <Volume2 className="w-4 h-4 text-cyan-300" />
            <span className="font-tech text-xs tracking-widest text-cyan-200 font-bold">SOUND</span>
            <span className="text-[11px] text-slate-500">
              Settings wait ready — the grown music and voices are on their way.
            </span>
          </div>
          {AUDIO_CHANNELS.map((channel) => {
            const on = audio.isOn(channel.id);
            const pct = Math.round(audio.levelOf(channel.id) * 100);
            return (
              <div
                key={channel.id}
                className={`flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-800/40 ${
                  channel.id === 'master' ? 'border-b border-slate-700/50 rounded-b-none mb-1' : ''
                }`}
              >
                <div className="flex flex-col flex-1 min-w-0">
                  <span className={`text-xs font-tech font-bold ${on ? 'text-slate-100' : 'text-slate-500'}`}>
                    {channel.label}
                  </span>
                  <span className="text-[11px] text-slate-400 leading-snug">{channel.blurb}</span>
                </div>
                <span className="text-[10px] font-tech text-slate-400 w-8 text-right shrink-0">
                  {on ? `${pct}%` : 'OFF'}
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={pct}
                  disabled={!on}
                  aria-label={`${channel.label} volume`}
                  onChange={(e) => audio.setLevel(channel.id, Number(e.target.value) / 100)}
                  className="w-24 shrink-0 accent-cyan-400 disabled:opacity-40"
                />
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${channel.label} ${on ? 'on' : 'off'}`}
                  onClick={() => audio.setOn(channel.id, !on)}
                  className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
                    on
                      ? 'bg-cyan-600/70 border-cyan-400/60'
                      : 'bg-slate-800 border-slate-600/60'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-slate-100 shadow transition-all ${
                      on ? 'left-[1.375rem]' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        {/* Recovery + how-to footer */}
        <div className="px-4 py-3 border-t border-slate-700/60 bg-slate-900/60 flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={layout.showAll}
              className="flex-1 px-3 py-2 rounded-xl text-[11px] font-tech font-bold text-emerald-300 border border-emerald-500/50 hover:bg-emerald-950/50 transition-colors flex items-center justify-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" /> SHOW ALL
            </button>
            <button
              onClick={layout.resetPositions}
              className="flex-1 px-3 py-2 rounded-xl text-[11px] font-tech font-bold text-amber-300 border border-amber-500/50 hover:bg-amber-950/50 transition-colors flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> RESET POSITIONS
            </button>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            Drag any panel by its corner grip (or by any empty part of it) to move it; the ✕ on a
            panel hides it. Press ESC to free the mouse for dragging. Arrangement is remembered on
            this device.
          </p>
        </div>
      </div>
    </div>
  );
};
