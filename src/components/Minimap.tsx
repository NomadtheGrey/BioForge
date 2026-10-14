import React, { useState, useMemo } from 'react';
import {
  Compass,
  Maximize2,
  Minimize2,
  Layers,
  MapPin,
  Crosshair,
  Shield,
  Eye,
  Info,
} from 'lucide-react';
import {
  StructureEntity,
  FaunaEntity,
  FloraEntity,
} from '../types/game';
import { BIOMES, ITEMS } from '../game/constants';

export interface MinimapProps {
  playerX: number;
  playerZ: number;
  playerRotation: number;
  structures?: StructureEntity[];
  fauna?: FaunaEntity[];
  flora?: FloraEntity[];
  currentBiomeName: string;
  /** The current zone's biome type label (e.g. "Meadow"); null when seedless. */
  currentBiomeType: string | null;
  /** The current zone's grid coordinates, e.g. "Zone 0, 0". */
  zoneCoordsLabel: string;
}

export type MinimapMode = 'radar' | 'world';

export const Minimap: React.FC<MinimapProps> = ({
  playerX,
  playerZ,
  playerRotation,
  structures = [],
  fauna = [],
  flora = [],
  currentBiomeName,
  currentBiomeType,
  zoneCoordsLabel,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [mapMode, setMapMode] = useState<MinimapMode>('radar');
  const [showFlora, setShowFlora] = useState<boolean>(false);
  const [hoveredEntity, setHoveredEntity] = useState<{
    name: string;
    type: string;
    x: number;
    z: number;
    color: string;
    distance: number;
  } | null>(null);

  // Radar view config: radius around player in meters
  const radarRadius = isExpanded ? 40 : 25;
  const radarMapSize = isExpanded ? 240 : 160;

  // World map bounds config: (-50 to +50 on X and Z) -> 100x100 world
  const worldMin = -50;
  const worldMax = 50;
  const worldSpan = worldMax - worldMin; // 100 units

  // World to canvas coordinate transform for World Mode
  const toWorldCanvas = (wx: number, wz: number, size: number) => {
    const normX = (wx - worldMin) / worldSpan;
    const normZ = (wz - worldMin) / worldSpan;
    const clampedX = Math.max(0, Math.min(1, normX));
    const clampedZ = Math.max(0, Math.min(1, normZ));
    return {
      cx: clampedX * size,
      cy: clampedZ * size,
    };
  };

  // World to canvas coordinate transform for Radar Mode (Centered on player)
  const toRadarCanvas = (wx: number, wz: number, size: number) => {
    const half = size / 2;
    const dx = wx - playerX;
    const dz = wz - playerZ;
    const pxPerMeter = half / radarRadius;
    return {
      cx: half + dx * pxPerMeter,
      cy: half + dz * pxPerMeter,
      dist: Math.hypot(dx, dz),
    };
  };

  // Nearby entities for Radar Mode filtered by radar radius
  const nearbyStructures = useMemo(() => {
    return structures.filter((s) => Math.hypot(s.worldX - playerX, s.worldZ - playerZ) <= radarRadius * 1.15);
  }, [structures, playerX, playerZ, radarRadius]);

  const nearbyFauna = useMemo(() => {
    return fauna.filter((f) => Math.hypot(f.x - playerX, f.z - playerZ) <= radarRadius * 1.15);
  }, [fauna, playerX, playerZ, radarRadius]);

  const nearbyFlora = useMemo(() => {
    if (!showFlora) return [];
    return flora.filter((f) => Math.hypot(f.x - playerX, f.z - playerZ) <= radarRadius * 1.15);
  }, [flora, playerX, playerZ, radarRadius, showFlora]);

 // Player orientation angle in radians (converted to SVG degree angle).
// NOTE: playerRotation = atan2(dir.x, dir.z), so 0 = facing +Z (map south)
// and PI = facing -Z (map north). The marker is drawn pointing north (up),
// so offset by 180° to align the arrow with the true facing direction.
  const playerDeg = 180 - (playerRotation * 180) / Math.PI;

  const currentSize = isExpanded ? (mapMode === 'world' ? 260 : 240) : 160;

  // Spawn-zone home arrow (radar mode): the bearing from the player to
  // the SPAWN POINT (0, 0) — the heart of the spawn zone — drawn as a
  // small amber triangle riding the radar circle's rim, so home is
  // always one glance away. The radar is north-up with +Z drawn
  // downward, so the screen-space direction to spawn is (-x, -z).
  // Hidden when the player is basically standing on spawn.
  const spawnDist = Math.hypot(playerX, playerZ);
  const spawnAngle = Math.atan2(-playerZ, -playerX);
  const spawnRimR = currentSize / 2 - 10;
  const spawnArrowX = currentSize / 2 + Math.cos(spawnAngle) * spawnRimR;
  const spawnArrowY = currentSize / 2 + Math.sin(spawnAngle) * spawnRimR;
  const spawnArrowDeg = (spawnAngle * 180) / Math.PI;

  return (
    <div className="pointer-events-auto flex flex-col gap-1.5 select-none animate-fade-in">
      <div className="glass-panel p-2.5 rounded-2xl flex flex-col shadow-2xl border border-cyan-500/30 bg-slate-950/80 backdrop-blur-md">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
            <span className="font-tech text-[11px] font-bold tracking-wider text-cyan-300">
              {mapMode === 'radar' ? 'PRISMATIC RADAR' : 'VERGE SURVEY'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Flora toggle */}
            <button
              onClick={() => setShowFlora((prev) => !prev)}
              title={showFlora ? 'Hide Flora Dots' : 'Show Flora Dots'}
              className={`p-1 rounded-lg transition-colors text-[10px] ${
                showFlora
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3 h-3" />
            </button>

            {/* Mode switch (Radar vs Full World) */}
            <button
              onClick={() => setMapMode((prev) => (prev === 'radar' ? 'world' : 'radar'))}
              title={mapMode === 'radar' ? 'Switch to Prismatic Verge World Map' : 'Switch to Tactical Radar'}
              className="p-1 rounded-lg text-slate-400 hover:text-cyan-300 transition-colors"
            >
              <Layers className="w-3 h-3" />
            </button>

            {/* Expand / Minimize toggle */}
            <button
              onClick={() => setIsExpanded((prev) => !prev)}
              title={isExpanded ? 'Minimize Radar' : 'Expand Radar'}
              className="p-1 rounded-lg text-slate-400 hover:text-cyan-300 transition-colors"
            >
              {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Map View Canvas Container */}
        <div
          className="relative overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/90 flex items-center justify-center transition-all duration-300"
          style={{ width: currentSize, height: currentSize }}
        >
          {mapMode === 'radar' && (
            <svg
              width={currentSize}
              height={currentSize}
              viewBox={`0 0 ${currentSize} ${currentSize}`}
              className="w-full h-full"
            >
              <defs>
                <radialGradient id="radarScan" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.08" />
                  <stop offset="70%" stopColor="#06b6d4" stopOpacity="0.03" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.15" />
                </radialGradient>
                <linearGradient id="sweepLine" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Background circular radar field */}
              <circle
                cx={currentSize / 2}
                cy={currentSize / 2}
                r={currentSize / 2 - 2}
                fill="url(#radarScan)"
                stroke="#1e293b"
                strokeWidth="1.5"
              />

              {/* Range rings */}
              <circle
                cx={currentSize / 2}
                cy={currentSize / 2}
                r={(currentSize / 2) * 0.33}
                fill="none"
                stroke="#334155"
                strokeWidth="1"
                strokeDasharray="2,3"
                opacity="0.6"
              />
              <circle
                cx={currentSize / 2}
                cy={currentSize / 2}
                r={(currentSize / 2) * 0.66}
                fill="none"
                stroke="#334155"
                strokeWidth="1"
                strokeDasharray="2,3"
                opacity="0.6"
              />
              <circle
                cx={currentSize / 2}
                cy={currentSize / 2}
                r={currentSize / 2 - 4}
                fill="none"
                stroke="#0284c7"
                strokeWidth="1"
                opacity="0.3"
              />

              {/* Crosshair axis */}
              <line
                x1={currentSize / 2}
                y1="4"
                x2={currentSize / 2}
                y2={currentSize - 4}
                stroke="#1e293b"
                strokeWidth="1"
              />
              <line
                x1="4"
                y1={currentSize / 2}
                x2={currentSize - 4}
                y2={currentSize / 2}
                stroke="#1e293b"
                strokeWidth="1"
              />

              {/* Cardinal directions */}
              <text x={currentSize / 2} y="12" fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="monospace">
                N
              </text>
              <text x={currentSize - 8} y={currentSize / 2 + 3} fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="monospace">
                E
              </text>
              <text x={currentSize / 2} y={currentSize - 6} fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="monospace">
                S
              </text>
              <text x="8" y={currentSize / 2 + 3} fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="monospace">
                W
              </text>

              {/* Nearby Structures */}
              {nearbyStructures.map((s) => {
                const { cx, cy, dist } = toRadarCanvas(s.worldX, s.worldZ, currentSize);
                if (dist > radarRadius) return null;
                const isWall = s.type === 'chitin_glass_wall';
                const isFloor = s.type === 'root_tile_floor';
                const isTurret = s.type === 'tamed_snap_trap_turret';
                const color = isTurret ? '#ef4444' : isWall ? '#38bdf8' : isFloor ? '#0d9488' : '#a855f7';
                const labelName = ITEMS[s.type]?.name || s.type;

                return (
                  <rect
                    key={s.id}
                    x={cx - 2.5}
                    y={cy - 2.5}
                    width={5}
                    height={5}
                    fill={color}
                    stroke="#0f172a"
                    strokeWidth="0.8"
                    className="cursor-pointer hover:opacity-100 transition-opacity"
                    onMouseEnter={() =>
                      setHoveredEntity({
                        name: labelName,
                        type: 'Structure',
                        x: s.worldX,
                        z: s.worldZ,
                        color,
                        distance: Math.round(dist),
                      })
                    }
                    onMouseLeave={() => setHoveredEntity(null)}
                  />
                );
              })}

              {/* Nearby Flora (when enabled) */}
              {showFlora &&
                nearbyFlora.map((fl) => {
                  const { cx, cy, dist } = toRadarCanvas(fl.x, fl.z, currentSize);
                  if (dist > radarRadius) return null;
                  return (
                    <circle
                      key={fl.id}
                      cx={cx}
                      cy={cy}
                      r={1.8}
                      fill="#10b981"
                      opacity="0.75"
                      className="cursor-pointer"
                      onMouseEnter={() =>
                        setHoveredEntity({
                          name: fl.species.replace('_', ' ').toUpperCase(),
                          type: 'Flora',
                          x: fl.x,
                          z: fl.z,
                          color: '#10b981',
                          distance: Math.round(dist),
                        })
                      }
                      onMouseLeave={() => setHoveredEntity(null)}
                    />
                  );
                })}

              {/* Nearby Fauna */}
              {nearbyFauna.map((f) => {
                const { cx, cy, dist } = toRadarCanvas(f.x, f.z, currentSize);
                if (dist > radarRadius) return null;
                const isStalker = f.species === 'chitin_stalker';
                const isSoftPuff = f.species === 'soft_puff';
                const color = f.isTamed ? '#22d3ee' : isStalker ? '#ec4899' : isSoftPuff ? '#2dd4bf' : '#f59e0b';
                const label = `${f.isTamed ? 'Tamed ' : 'Wild '}${f.species.replace('_', ' ').toUpperCase()}`;

                return (
                  <g
                    key={f.id}
                    className="cursor-pointer"
                    onMouseEnter={() =>
                      setHoveredEntity({
                        name: label,
                        type: 'Fauna',
                        x: Math.round(f.x),
                        z: Math.round(f.z),
                        color,
                        distance: Math.round(dist),
                      })
                    }
                    onMouseLeave={() => setHoveredEntity(null)}
                  >
                    <circle cx={cx} cy={cy} r={3.2} fill={color} stroke="#0f172a" strokeWidth="1" />
                    {/* Pulsing warning beacon for hostile or alert fauna */}
                    {isStalker && !f.isTamed && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={6}
                        fill="none"
                        stroke="#ec4899"
                        strokeWidth="0.8"
                        strokeDasharray="2,2"
                        className="animate-ping"
                      />
                    )}
                  </g>
                );
              })}

              {/* Player Icon & Direction Wedge at Radar Center */}
              <g transform={`translate(${currentSize / 2}, ${currentSize / 2}) rotate(${playerDeg})`}>
                {/* Vision Cone Wedge */}
                <path
                  d="M 0 0 L -14 -28 A 30 30 0 0 1 14 -28 Z"
                  fill="url(#sweepLine)"
                  opacity="0.6"
                />
                {/* Center Ship / Player Marker */}
                <polygon
                  points="0,-6 4,4 0,2 -4,4"
                  fill="#38bdf8"
                  stroke="#0284c7"
                  strokeWidth="1"
                />
                <circle cx="0" cy="0" r="1.5" fill="#ffffff" />
              </g>

              {/* Spawn-zone home arrow on the radar rim (see spawnAngle
                  above): an amber triangle pointing toward spawn. */}
              {spawnDist > 2 && (
                <g transform={`translate(${spawnArrowX}, ${spawnArrowY}) rotate(${spawnArrowDeg})`} className="animate-pulse">
                  <title>Spawn Zone — this way home</title>
                  <polygon points="7,0 -5,-4.5 -5,4.5" fill="#f59e0b" stroke="#0f172a" strokeWidth="1" />
                </g>
              )}
            </svg>
          )}

          {mapMode === 'world' && (
            <svg
              width={currentSize}
              height={currentSize}
              viewBox={`0 0 ${currentSize} ${currentSize}`}
              className="w-full h-full"
            >
              {/* Sector shading: the four quadrant base colors of THIS
                  zone's terrain. Per the per-zone model these are
                  sectors of one zone, not separate biomes/zones — the
                  zone's own name heads the survey below. */}
              {/* NW sector: X [-50,0], Z [-50,0] => Top-Left */}
              <rect
                x="0"
                y="0"
                width={currentSize / 2}
                height={currentSize / 2}
                fill="#1e122b"
                stroke="#3b0764"
                strokeWidth="0.5"
              />

              {/* NE sector: X [0,50], Z [-50,0] => Top-Right */}
              <rect
                x={currentSize / 2}
                y="0"
                width={currentSize / 2}
                height={currentSize / 2}
                fill="#0e2c2c"
                stroke="#042f2e"
                strokeWidth="0.5"
              />

              {/* SW sector: X [-50,0], Z [0,50] => Bottom-Left */}
              <rect
                x="0"
                y={currentSize / 2}
                width={currentSize / 2}
                height={currentSize / 2}
                fill="#2a1a08"
                stroke="#451a03"
                strokeWidth="0.5"
              />

              {/* SE sector: X [0,50], Z [0,50] => Bottom-Right */}
              <rect
                x={currentSize / 2}
                y={currentSize / 2}
                width={currentSize / 2}
                height={currentSize / 2}
                fill="#191838"
                stroke="#312e81"
                strokeWidth="0.5"
              />

              {/* Zone identity header: one zone, one name, one biome */}
              <text
                x={currentSize / 2}
                y="13"
                fill="#e2e8f0"
                fontSize="8.5"
                fontFamily="monospace"
                fontWeight="bold"
                textAnchor="middle"
                opacity="0.95"
              >
                {currentBiomeName}
              </text>
              <text
                x={currentSize / 2}
                y={currentSize - 5}
                fill="#94a3b8"
                fontSize="7.5"
                fontFamily="monospace"
                textAnchor="middle"
                opacity="0.9"
              >
                {zoneCoordsLabel}
                {currentBiomeType ? ` · ${currentBiomeType}` : ''}
              </text>

              {/* Axis Dividers */}
              <line
                x1={currentSize / 2}
                y1="0"
                x2={currentSize / 2}
                y2={currentSize}
                stroke="#334155"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
              <line
                x1="0"
                y1={currentSize / 2}
                x2={currentSize}
                y2={currentSize / 2}
                stroke="#334155"
                strokeWidth="1"
                strokeDasharray="2,2"
              />

              {/* World Structures */}
              {structures.map((s) => {
                const { cx, cy } = toWorldCanvas(s.worldX, s.worldZ, currentSize);
                const isWall = s.type === 'chitin_glass_wall';
                const isTurret = s.type === 'tamed_snap_trap_turret';
                const color = isTurret ? '#ef4444' : isWall ? '#38bdf8' : '#0d9488';
                return (
                  <rect
                    key={s.id}
                    x={cx - 1.5}
                    y={cy - 1.5}
                    width={3}
                    height={3}
                    fill={color}
                    className="cursor-pointer"
                    onMouseEnter={() =>
                      setHoveredEntity({
                        name: ITEMS[s.type]?.name || s.type,
                        type: 'Structure',
                        x: s.worldX,
                        z: s.worldZ,
                        color,
                        distance: Math.round(Math.hypot(s.worldX - playerX, s.worldZ - playerZ)),
                      })
                    }
                    onMouseLeave={() => setHoveredEntity(null)}
                  />
                );
              })}

              {/* World Fauna */}
              {fauna.map((f) => {
                const { cx, cy } = toWorldCanvas(f.x, f.z, currentSize);
                const color = f.isTamed ? '#22d3ee' : f.species === 'chitin_stalker' ? '#ec4899' : '#2dd4bf';
                return (
                  <circle
                    key={f.id}
                    cx={cx}
                    cy={cy}
                    r={2}
                    fill={color}
                    className="cursor-pointer"
                    onMouseEnter={() =>
                      setHoveredEntity({
                        name: `${f.isTamed ? 'Tamed ' : ''}${f.species.replace('_', ' ').toUpperCase()}`,
                        type: 'Fauna',
                        x: Math.round(f.x),
                        z: Math.round(f.z),
                        color,
                        distance: Math.round(Math.hypot(f.x - playerX, f.z - playerZ)),
                      })
                    }
                    onMouseLeave={() => setHoveredEntity(null)}
                  />
                );
              })}

              {/* World Player Pin */}
              {(() => {
                const { cx, cy } = toWorldCanvas(playerX, playerZ, currentSize);
                return (
                  <g transform={`translate(${cx}, ${cy}) rotate(${playerDeg})`}>
                    <circle cx="0" cy="0" r="3.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
                    <line x1="0" y1="0" x2="0" y2="-6" stroke="#ffffff" strokeWidth="1.5" />
                  </g>
                );
              })()}
            </svg>
          )}

          {/* Hover Inspector Tooltip overlay */}
          {hoveredEntity && (
            <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-slate-950/95 border border-cyan-500/50 rounded-lg p-1.5 flex flex-col text-[10px] shadow-xl pointer-events-none">
              <div className="flex items-center justify-between">
                <span className="font-tech font-bold" style={{ color: hoveredEntity.color }}>
                  {hoveredEntity.name}
                </span>
                <span className="text-slate-400 font-mono">{hoveredEntity.distance}m</span>
              </div>
              <span className="text-slate-400 text-[9px] font-mono">
                {hoveredEntity.type} • X: {hoveredEntity.x} Z: {hoveredEntity.z}
              </span>
            </div>
          )}
        </div>

        {/* Footer Coordinate Readout: zone grid coords first (where am
            I in the WORLD), then in-zone position. Zone name lives in
            the HUD bar and the survey header. */}
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/80 mt-1">
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
            <span className="text-cyan-300 font-semibold" title={currentBiomeName}>
              {zoneCoordsLabel}
            </span>
          </div>
          <span className="text-slate-300">
            X: {Math.round(playerX)} | Z: {Math.round(playerZ)}
          </span>
        </div>

        {/* Legend strip (when expanded) */}
        {isExpanded && (
          <div className="flex items-center justify-between text-[9px] text-slate-400 pt-1.5 mt-1 border-t border-slate-800/60 font-mono">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Player
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-sm bg-teal-400" /> Structure
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-pink-400" /> Fauna
            </span>
            {showFlora && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Flora
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
