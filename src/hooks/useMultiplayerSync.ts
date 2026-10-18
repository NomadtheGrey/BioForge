/**
 * BioForge Multiplayer Sync Domain Hook
 * Extracted from App.tsx (2026-10-15, the seam-by-seam refactor —
 * seam 4 of 6, a pure move: no behavior changes).
 *
 * Owns the co-op session surface: the session state (room, host
 * flag, peers, chat), the invite-link landing, the manager
 * callbacks registration (peer join/leave, world sync, entity
 * routing across zones, chat, zone request/snapshot), the zone-tag
 * effect, the presence heartbeat, and the session verbs (host /
 * join / leave / chat / the start screen's co-op door).
 *
 * The manager (game/multiplayer.ts) stays a module singleton; this
 * hook is the React side of it. Cross-zone routing rules live in
 * game/zoneSync.ts; this hook supplies the stores and applies the
 * verdicts.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { multiplayerManager, ADMIN_CHAT_COLOR, SYSTEM_CHAT_COLOR, type EntityKind, type EntitySnapshot, type TunnelPairMouth } from '../game/multiplayer';
import { soundEngine } from '../audio/soundEngine';
import { routeForZoneTag, storeEntityEvent, type ZoneStores } from '../game/zoneSync';
import { generateSeededWorld } from '../game/world/worldGen';
import { SPAWN_ZONE, zoneBiomeAt, zoneVariantAt, zoneFaceAt, zoneKey, type ZoneCoords } from '../game/world/zones';
import type { WorldSnapshot, GameDifficulty } from '../game/saveSystem';
import type { BioForgeThreeEngine } from '../game/engine/threeEngine';
import type { PendingTravel } from './useZoneTravel';
import { setSkyWorld } from '../game/world/skyCalendar';
import type { StrikeCtx } from '../game/creatures/shields';
import type {
  DroppedItemEntity, FaunaEntity, FloraEntity, GameNotification, MultiplayerPeer, StructureEntity, ToolType,
} from '../types/game';

// Chat toast tuning (moved with the session state from App).
const CHAT_TOAST_DURATION_MS = 5000;
const MAX_CHAT_TOASTS = 5;

export interface MultiplayerSyncDeps {
  engineRef: { current: BioForgeThreeEngine | null };
  playerPosRef: { current: { x: number; z: number; rotation: number } };
  playerLevelRef: { current: number };
  activeToolRef: { current: ToolType };
  currentZoneId: () => string;
  playerZone: ZoneCoords;
  inCavern: boolean;
  inRuin: boolean;
  playerZoneRef: { current: ZoneCoords };
  setPlayerZone: (zone: ZoneCoords) => void;
  visitedZonesRef: { current: Map<string, WorldSnapshot> };
  worldSeedRef: { current: string };
  /** The HOST's difficulty, learned from world sync (Adam,
   *  2026-10-18: the host's save determines difficulty for
   *  everyone in the world). App owns the ref; this hook
   *  writes it on sync and clears it on leave. Null = not a
   *  guest in a synced world (solo, hosting, or a host on an
   *  older build that sent none). */
  hostDifficultyRef: { current: GameDifficulty | null };
  /** The host-side getter: this client's own save's
   *  difficulty, broadcast with world sync when hosting. */
  getWorldDifficulty: () => GameDifficulty;
  // HOSTILE (2026-10-18): two App-owned bags this hook fills.
  // peerPositionsRef — the same-zone peers' last known
  // positions (id → {x, z}), kept in step with the avatar
  // stream: the weapon hook hit-tests swings and shots
  // against it. explorerStrikesRef — strikes ADDRESSED TO
  // this player, queued for the game loop to resolve through
  // the shared shield/health consumer on its next tick.
  peerPositionsRef: { current: Map<string, { x: number; z: number }> };
  explorerStrikesRef: { current: { damage: number; ctx: StrikeCtx }[] };
  setSessionSeed: (seed: string) => void;
  zoneStores: () => ZoneStores;
  buildZoneSyncTravel: () => { zone: string; zones: Record<string, WorldSnapshot>; worldSeed: string; worldCreatedAt?: number };
  completeTravel: (nx: number, nz: number, entry: { x: number; z: number }, hostSnapshot?: WorldSnapshot) => void;
  cancelPendingTravel: () => void;
  pendingTravelRef: { current: PendingTravel | null };
  buildWorldSnapshot: () => WorldSnapshot;
  latestStateRef: { current: { dayNightCycle: number } };
  setHasStarted: (value: boolean) => void;
  setDayNightCycle: (value: number) => void;
  resetInstanceState: () => void;
  postNotification: (title: string, message: string, type?: GameNotification['type'], iconColor?: string) => void;
  enterFullscreenOnTouch: () => void;
  // Only the co-op door touches the modal state (opens the panel).
  setActiveModal: (modal: 'multiplayer') => void;
  upsertFlora: (flora: FloraEntity) => void;
  upsertFauna: (fauna: FaunaEntity) => void;
  upsertStructure: (structure: StructureEntity) => void;
  upsertDroppedItem: (item: DroppedItemEntity) => void;
  removeFlora: (floraId: string) => void;
  removeFauna: (faunaId: string) => void;
  removeStructure: (structureId: string) => void;
  removeDroppedItem: (itemId: string) => void;
  addStructure: (structure: StructureEntity) => void;
  resetFloraHarvest: (floraId: string, regrowthDuration: number) => void;
  tameFauna: (faunaId: string, customName: string, state: FaunaEntity['state']) => void;
  replaceWorld: (world: WorldSnapshot) => void;
  /** The BioTunnel guest fix (Adam, 2026-10-16): the host's pair
   *  truth — both mouths' zone keys + ids — derived from the host's
   *  known world (tunnelMouthsNow). Read on the heartbeat only. */
  getTunnelPairFact: () => TunnelPairMouth[];
  /** Called on a guest right after a tunnel-pair fact lands, so the
   *  pairing display (mouth membrane glow) re-reads it. */
  onTunnelPairFact?: () => void;
  /** Called on a guest when a tunnel ride's zone snapshot arrives
   *  and the crossing completes — the ride's announcement and the
   *  Ask-the-World crossing signal. Never fires on asking. */
  onTunnelRideArrived?: () => void;
}

export interface UseMultiplayerSyncResult {
  roomCode: string;
  isHost: boolean;
  isConnected: boolean;
  peers: MultiplayerPeer[];
  chatMessages: { sender: string; text: string; color: string; time: string }[];
  chatToasts: { id: number; sender: string; text: string; color: string }[];
  inviteRoomCode: string;
  /** The BioTunnel guest fix: the host's last pair fact (null when
   *  none has arrived or the session ended). Guests union it into
   *  pairing display and transit targeting. */
  guestTunnelPairRef: { current: TunnelPairMouth[] | null };
  handleJoinCoopFromStart: () => void;
  handleHostSession: () => void;
  handleJoinSession: (code: string) => void;
  handleLeaveSession: () => void;
  handleSendChatMessage: (text: string) => void;
  /** The system fold (Adam, 2026-10-18): a system entry —
   *  SYSTEM (automated) or ADMIN (the grower's broadcast) —
   *  joins the chat log through the same sink as a player's
   *  message. Local only: it never crosses the relay, because
   *  every client derives it from the same feed. `toast`
   *  false = log only (notice-level lines already raised
   *  their notification toast upstream). */
  appendSystemChat: (sender: 'SYSTEM' | 'ADMIN', text: string, opts?: { toast?: boolean }) => void;
}

export function useMultiplayerSync(deps: MultiplayerSyncDeps): UseMultiplayerSyncResult {
  const {
    engineRef, playerPosRef, playerLevelRef, activeToolRef, currentZoneId,
    playerZone, inCavern, inRuin,
    playerZoneRef, setPlayerZone, visitedZonesRef, worldSeedRef, hostDifficultyRef, getWorldDifficulty, peerPositionsRef, explorerStrikesRef, setSessionSeed,
    zoneStores, buildZoneSyncTravel, completeTravel, cancelPendingTravel, pendingTravelRef,
    buildWorldSnapshot, latestStateRef, setHasStarted, setDayNightCycle, resetInstanceState,
    postNotification, enterFullscreenOnTouch, setActiveModal,
    upsertFlora, upsertFauna, upsertStructure, upsertDroppedItem,
    removeFlora, removeFauna, removeStructure, removeDroppedItem,
    addStructure, resetFloraHarvest, tameFauna, replaceWorld,
    getTunnelPairFact, onTunnelPairFact, onTunnelRideArrived,
  } = deps;

  // 3. Multiplayer States
  const [roomCode, setRoomCode] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [peers, setPeers] = useState(multiplayerManager.getConnectedPeers());
  const [chatMessages, setChatMessages] = useState<{ sender: string; text: string; color: string; time: string }[]>([]);
  const [chatToasts, setChatToasts] = useState<{ id: number; sender: string; text: string; color: string }[]>([]);

  // The BioTunnel guest fix (Adam, 2026-10-16): the host's pair
  // truth, kept here for guests. Pairing display and transit
  // targeting read it; the host never stores it (its own derived
  // pair is the truth — see the manager's tunnel_pair guard).
  const guestTunnelPairRef = useRef<TunnelPairMouth[] | null>(null);

  // Invite links: when the game is opened from a shared link
  // (…/?room=CODE), the code is parked here at boot and handed to the
  // multiplayer modal, which pre-fills its join field. Empty string
  // means "no invite" — the modal then behaves exactly as before.
  const [inviteRoomCode, setInviteRoomCode] = useState<string>('');


  // The co-op door: no local save involved. The guest plays in the
  // host's world; saveNow stays disarmed because currentSaveRef is null.
  const handleJoinCoopFromStart = (): void => {
    enterFullscreenOnTouch();
    setHasStarted(true);
    setActiveModal('multiplayer');
  };

  // ------------------------------------------------------------------------
  // Invite Links — landing side
  // ------------------------------------------------------------------------
  // A host shares a link like bioforgegame.netlify.app/?room=BIO77X.
  // On boot we lift the code out of the URL so the join flow can start
  // pre-filled: the guest lands on the start screen, takes the co-op
  // door, and the code is already waiting in the join field — all that
  // is left is typing their name and pressing JOIN SESSION.
  // The parameter is sanitized to the room-code alphabet (letters and
  // digits, 6 max) and must be at least 3 characters, matching what the
  // join field itself accepts. The URL is left untouched; the code also
  // stays parked here until a session actually starts, so closing the
  // modal and reopening it keeps the pre-fill.
  useEffect(() => {
    const rawCode = new URLSearchParams(window.location.search).get('room');
    if (!rawCode) return;
    const cleanCode = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (cleanCode.length < 3) return;
    setInviteRoomCode(cleanCode);
    postNotification('Invite Link Detected', `Room code ${cleanCode} is filled in and waiting — take the co-op door to join your host!`, 'system', '#a855f7');
  }, []);




  // --------------------------------------------------------------------------
  // Multiplayer Event Setup
  // --------------------------------------------------------------------------
  useEffect(() => {
    multiplayerManager.setCallbacks({
      onPeerJoin: (peer) => {
        setPeers(multiplayerManager.getConnectedPeers());
        postNotification('Explorer Joined', `${peer.name} entered sector. Co-Op synced!`, 'system', peer.color);
        // Host duty: a new explorer's game booted with the starter world
        // (or their own saved one). If it isn't OUR world, it's wrong —
        // send the full snapshot so they play in the same place we do.
        if (multiplayerManager.isHost) {
          multiplayerManager.broadcastWorldSync(buildWorldSnapshot(), latestStateRef.current.dayNightCycle, buildZoneSyncTravel(), getWorldDifficulty());
          // The BioTunnel guest fix (Adam, 2026-10-16): answer the
          // joiner with the pair's truth at once, so a guest at a
          // mouth never has to wait a heartbeat to see it lit.
          multiplayerManager.broadcastTunnelPair(getTunnelPairFact());
        }
      },
      onPeerLeave: (peerId) => {
        setPeers(multiplayerManager.getConnectedPeers());
        engineRef.current?.removePeerAvatar(peerId);
        peerPositionsRef.current.delete(peerId);
      },
      onPeerMove: (peerId, px, pz, prot, _tool, level, zone) => {
        // Instances are separate spaces: a peer on the surface is not
        // standing in your cave, nor you in theirs — hide cross-zone
        // avatars instead of drawing them in the wrong world. (Old
        // builds tagged every surface position 'surface': read that
        // as the spawn zone, the only surface they knew.)
        const peerTag = zone === undefined || zone === 'surface' ? `zone:${zoneKey(SPAWN_ZONE.zx, SPAWN_ZONE.zz)}` : zone;
        if (peerTag !== currentZoneId()) {
          engineRef.current?.removePeerAvatar(peerId);
          // HOSTILE: a peer in another country is out of reach
          // in every sense — out of the hit-test map too.
          peerPositionsRef.current.delete(peerId);
          return;
        }
        const peer = peers.find((p) => p.id === peerId);
        engineRef.current?.updatePeerAvatar(peerId, peer?.name || 'Explorer', px, pz, prot, peer?.color || '#38bdf8', level ?? 0);
        // HOSTILE: remember where they stand — the weapon
        // hook judges swings and shots against these.
        peerPositionsRef.current.set(peerId, { x: px, z: pz });
      },
      onPlayerHit: (senderId, senderName, damage, x, z) => {
        // HOSTILE (2026-10-18): a strike addressed to me.
        // Queue it — the game loop resolves it through the
        // shared shield/health consumer on its next tick, so
        // an explorer's hit and a creature's bite take the
        // EXACT same door (block, floor, death latch). The
        // notice names the hand; the health bar tells the rest.
        explorerStrikesRef.current.push({ damage, ctx: { faunaId: senderId, x, z } });
        postNotification('Struck!', `${senderName} struck you — weapons are live between explorers on this world.`, 'alert', '#ef4444');
      },
      onBuildPlaced: (structure) => {
        addStructure(structure);
        soundEngine.playBuildPlace();
      },
      onBuildRemoved: (structId) => {
        removeStructure(structId);
        soundEngine.playSolventSpray();
      },
      onFloraHarvested: (floraId) => {
        resetFloraHarvest(floraId, 18);
      },
      onFaunaTamed: (faunaId, tamedBy) => {
        tameFauna(faunaId, `${tamedBy}'s Companion`, 'following');
        postNotification('Wildlife Domesticated', `${tamedBy} tamed a companion for the base!`, 'tame', '#a855f7');
      },
      onChatMessage: (sender, text, color) => {
        setChatMessages((prev) => [
          ...prev,
          { sender, text, color, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
        ]);
        const toastId = Date.now() + Math.random();
        setChatToasts((prev) => [...prev.slice(-MAX_CHAT_TOASTS), { id: toastId, sender, text, color }]);
        setTimeout(() => {
          setChatToasts((prev) => prev.filter((t) => t.id !== toastId));
        }, CHAT_TOAST_DURATION_MS);
      },
      onEntityUpsert: (kind: EntityKind, entity: EntitySnapshot, zone?: string) => {
        // Zone routing: an upsert only touches the lists of the
        // zone it happened in (see routeForZoneTag). Untagged
        // events (older peers) keep the original live behavior.
        const route = zone === undefined ? 'live' : routeForZoneTag(zone, currentZoneId(), zoneKey(playerZoneRef.current.zx, playerZoneRef.current.zz), multiplayerManager.isHost);
        if (route === 'store') {
          storeEntityEvent(zoneStores(), zone as string, kind, entity);
          return;
        }
        if (route === 'drop') return;
        switch (kind) {
          case 'flora':
            upsertFlora(entity as FloraEntity);
            break;
          case 'fauna':
            upsertFauna(entity as FaunaEntity);
            break;
          case 'structure':
            upsertStructure(entity as StructureEntity);
            break;
          case 'drop':
            upsertDroppedItem(entity as DroppedItemEntity);
            break;
        }
      },
      onEntityRemove: (kind: EntityKind, id: string, zone?: string) => {
        const route = zone === undefined ? 'live' : routeForZoneTag(zone, currentZoneId(), zoneKey(playerZoneRef.current.zx, playerZoneRef.current.zz), multiplayerManager.isHost);
        if (route === 'store') {
          storeEntityEvent(zoneStores(), zone as string, kind, null, id);
          return;
        }
        if (route === 'drop') return;
        switch (kind) {
          case 'flora':
            removeFlora(id);
            break;
          case 'fauna':
            removeFauna(id);
            break;
          case 'structure':
            removeStructure(id);
            break;
          case 'drop':
            removeDroppedItem(id);
            break;
        }
      },
      onZoneRequest: (zone: string) => {
        // Host duty (the manager only calls this on the host): send
        // the zone from OUR record — the zone we're standing in
        // comes from the live/parked lists, a visited one from the
        // map, and a brand-new one we roll ourselves from our seed
        // and keep, so our record stays the only truth.
        const curKey = zoneKey(playerZoneRef.current.zx, playerZoneRef.current.zz);
        let snap = zone === curKey ? buildWorldSnapshot() : visitedZonesRef.current.get(zone);
        if (!snap) {
          const [zx, zz] = zone.split(',').map(Number);
          const seed = worldSeedRef.current;
          if (!seed || Number.isNaN(zx) || Number.isNaN(zz)) return;
          const gen = generateSeededWorld(seed, zx, zz);
          snap = { flora: gen.flora, fauna: gen.fauna, structures: gen.structures, drops: [] };
          visitedZonesRef.current.set(zone, snap);
        }
        multiplayerManager.broadcastZoneSnapshot(zone, snap, worldSeedRef.current);
      },
      onZoneSnapshot: (data) => {
        if (data.worldSeed && !worldSeedRef.current) {
          worldSeedRef.current = data.worldSeed;
          setSessionSeed(data.worldSeed);
        }
        const pending = pendingTravelRef.current;
        if (pending && zoneKey(pending.nx, pending.nz) === data.zone) {
          // The zone I asked for: complete the crossing with the
          // host's copy. (If I'd walked away, the tick already
          // cancelled the pending — this branch can't fire stale.)
          cancelPendingTravel();
          // The BioTunnel guest fix (Adam, 2026-10-16): a tunnel
          // ride's entry was parked unknown — the far zone's truth
          // was never in hand. Resolve the far mouth's exit from
          // the arrived snapshot (the host's true mouth, by id),
          // exactly the exit the direct path computes.
          let entryX = pending.entryX;
          let entryZ = pending.entryZ;
          if (pending.tunnel) {
            const farMouth =
              data.world.structures.find((s) => s.type === 'biotunnel_mouth' && s.id === pending.tunnel!.farMouthId) ??
              data.world.structures.find((s) => s.type === 'biotunnel_mouth');
            if (farMouth) {
              const fx = Math.sin(farMouth.rotation ?? 0);
              const fz = Math.cos(farMouth.rotation ?? 0);
              entryX = farMouth.worldX + fx * 2;
              entryZ = farMouth.worldZ + fz * 2;
            }
          }
          completeTravel(pending.nx, pending.nz, { x: entryX, z: entryZ }, data.world);
          // A completed tunnel ride announces itself — the
          // Ask-the-World crossing signal fires here, on arrival.
          if (pending.tunnel) onTunnelRideArrived?.();
          return;
        }
        // Someone else's crossing, overheard: freshen my map with
        // the host's truth — unless it's the zone I'm standing in,
        // where my live lists and the event stream are fresher.
        if (data.zone !== zoneKey(playerZoneRef.current.zx, playerZoneRef.current.zz)) {
          visitedZonesRef.current.set(data.zone, data.world);
        }
      },
      onDayNight: (value) => {
        setDayNightCycle(value);
      },
      onTunnelPair: (mouths) => {
        // The manager already guards hosts (their own derivation is
        // the truth). Guests keep the fact and re-read the pairing
        // display — a near mouth lights as paired the moment the
        // host's pair is whole, even in a zone never visited.
        guestTunnelPairRef.current = mouths;
        onTunnelPairFact?.();
      },
      onWorldSync: (data) => {
        // The host's world replaces ours wholesale. This is memory only:
        // our own save file on disk is untouched, and autosave is gated
        // off while we are guests, so their world can never overwrite it.
        resetInstanceState();
        // The host's law (Adam, 2026-10-18): adopt the host's
        // difficulty BEFORE the seed lands below, so the zone
        // evaluator that the seed change wakes reads the
        // world's law, never our own save's. A host on an
        // older build sends none — the ref clears and App
        // falls back to our own save.
        hostDifficultyRef.current = data.difficulty ?? null;
        // Zone travel (2026-10-15): the sync also lands us in the
        // host's CURRENT zone, adopts the host's visited-zones map
        // (their record of every zone's changes) and the world seed
        // — after this, we can wander off on our own and generate
        // the same wilderness the host would. Hosts on older builds
        // send none of it: the spawn-zone defaults below hold.
        if (data.worldSeed) {
          worldSeedRef.current = data.worldSeed;
          setSessionSeed(data.worldSeed);
        }
        const [hzx, hzz] = (data.zone ?? '0,0').split(',').map(Number);
        const hostZone: ZoneCoords = {
          zx: Number.isNaN(hzx) ? SPAWN_ZONE.zx : hzx,
          zz: Number.isNaN(hzz) ? SPAWN_ZONE.zz : hzz,
        };
        visitedZonesRef.current = new Map(Object.entries(data.zones ?? {}));
        playerZoneRef.current = hostZone;
        setPlayerZone(hostZone);
        replaceWorld({
          flora: data.flora,
          fauna: data.fauna,
          structures: data.structures,
          drops: data.drops,
        });
        if (worldSeedRef.current) {
          engineRef.current?.setZoneBiome(zoneBiomeAt(worldSeedRef.current, hostZone.zx, hostZone.zz), zoneFaceAt(worldSeedRef.current, hostZone.zx, hostZone.zz)?.tint ?? null, zoneFaceAt(worldSeedRef.current, hostZone.zx, hostZone.zz) ? { distanceMult: zoneFaceAt(worldSeedRef.current, hostZone.zx, hostZone.zz)!.lightDistanceMult, intensityMult: zoneFaceAt(worldSeedRef.current, hostZone.zx, hostZone.zz)!.lightIntensityMult } : null);
        }
        setDayNightCycle(data.dayNightCycle);
        // Shelf 1: the guest's sky clock adopts the host's
        // world (seed + creation time), so both screens
        // watch the same comets, showers, and aurora nights.
        if (data.worldSeed && data.worldCreatedAt) {
          setSkyWorld(data.worldSeed, data.worldCreatedAt);
        }
      },
    });
  }, [peers, addStructure, removeStructure, resetFloraHarvest, tameFauna, postNotification, upsertFlora, removeFlora, upsertFauna, removeFauna, upsertStructure, upsertDroppedItem, removeDroppedItem, replaceWorld]);


  // Keep the multiplayer manager's zone stamp current: every entity
  // event this client sends is tagged with the zone it happened in
  // (the manager stamps centrally — see multiplayer.ts). The tag
  // changes exactly when zone identity does: travel (playerZone),
  // entering an instance (inCavern/inRuin), or leaving one.
  useEffect(() => {
    multiplayerManager.setCurrentZoneTag(currentZoneId());
  }, [playerZone, inCavern, inRuin, currentZoneId]);

  // ------------------------------------------------------------------------
  // Presence heartbeat — appear on join, stay visible standing still
  // ------------------------------------------------------------------------
  // The movement broadcast in the game loop only fires while the player is
  // actually moving, so a peer who joins and stands still never sends a
  // position — and because remote avatars are only drawn when a peer_move
  // arrives, that player stays invisible to everyone until they walk.
  // While connected, this heartbeat re-sends our current position once a
  // second whether we are moving or not. A joiner materializes for the
  // room almost immediately; the room materializes for the joiner too,
  // because everyone else's heartbeats keep arriving; and nobody vanishes
  // for the crime of standing still. Position truth is playerPosRef, the
  // same source the movement broadcast uses.
  // The BioTunnel guest fix (Adam, 2026-10-16): the last pair
  // fact the host broadcast. A change of signature means a mouth
  // was placed or dissolved, so guests get the new truth. Reset
  // whenever the heartbeat effect restarts (reconnect), so a new
  // session always announces its pair on the first beat.
  const lastPairSigRef = useRef<string>('__unset__');

  const PEER_PRESENCE_HEARTBEAT_MS = 1000;
  useEffect(() => {
    if (!isConnected) return;
    lastPairSigRef.current = '__unset__';
    const sendPresence = () => {
      const pos = playerPosRef.current;
      multiplayerManager.broadcastPlayerMove(pos.x, pos.z, pos.rotation, activeToolRef.current, playerLevelRef.current, currentZoneId());
    };
    sendPresence();
    const heartbeatId = setInterval(sendPresence, PEER_PRESENCE_HEARTBEAT_MS);
    // The BioTunnel guest fix (Adam, 2026-10-16): the host carries
    // the pair's truth on the heartbeat — both mouths' zone keys +
    // ids, derived from the host's own known world. Guests union it
    // into pairing display and transit targeting. The fact only
    // changes when a mouth is placed or dissolved, so it goes out
    // on change (plus a 30-beat re-affirm, so one dropped message
    // can't strand a guest's display or a ride).
    let beats = 0;
    const pairBeatId = setInterval(() => {
      if (!multiplayerManager.isHost) return;
      beats += 1;
      const fact = getTunnelPairFact();
      const sig = JSON.stringify(fact);
      if (sig !== lastPairSigRef.current || beats % 30 === 0) {
        lastPairSigRef.current = sig;
        multiplayerManager.broadcastTunnelPair(fact);
      }
    }, PEER_PRESENCE_HEARTBEAT_MS);
    return () => {
      clearInterval(heartbeatId);
      clearInterval(pairBeatId);
    };
  }, [isConnected]);

  const handleHostSession = () => {
    const code = multiplayerManager.hostSession();
    setRoomCode(code);
    setIsHost(true);
    setIsConnected(true);
    // A session has started, so any parked invite code has done its job
    // (or was never meant for us). Clear it so it can't pre-fill later.
    setInviteRoomCode('');
    postNotification('Host Session Created', `Room Code: ${code}. Share the code — or copy your invite link from the multiplayer panel — to bring fellow explorers into your world!`, 'system', '#10b981');
  };

  const handleJoinSession = (code: string) => {
    const success = multiplayerManager.joinSession(code);
    if (success) {
      setRoomCode(code);
      setIsHost(false);
      setIsConnected(true);
      // Joined — the parked invite code is spent. Clear it (see
      // handleHostSession for why).
      setInviteRoomCode('');
      postNotification('Session Joined', `Connected to room ${code}! Co-Op base building active.`, 'system', '#a855f7');
    }
  };

  const handleLeaveSession = () => {
    multiplayerManager.leaveSession();
    setRoomCode('');
    setIsHost(false);
    setIsConnected(false);
    setPeers([]);
    // The BioTunnel guest fix: the host's pair truth dies with the
    // session — pairing display falls back to the known world.
    guestTunnelPairRef.current = null;
    // The host's law dies with the session too: our own
    // save's difficulty governs again from here.
    hostDifficultyRef.current = null;
    postNotification('Session Disconnected', 'Returned to local single-explorer mode.', 'system', '#64748b');
  };

  const handleSendChatMessage = (text: string) => {
    multiplayerManager.broadcastChat(text);
    setChatMessages((prev) => [
      ...prev,
      {
        sender: 'You',
        text,
        color: multiplayerManager.playerColor,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // The system fold (Adam, 2026-10-18): SYSTEM / ADMIN
  // entries join the chat log in their reserved colors —
  // the same sink a player's message lands in (log + toast),
  // minus the relay: every client derives the same entries
  // from the same feed, so sending them anywhere would only
  // double them.
  const appendSystemChat = useCallback((sender: 'SYSTEM' | 'ADMIN', text: string, opts?: { toast?: boolean }) => {
    const color = sender === 'SYSTEM' ? SYSTEM_CHAT_COLOR : ADMIN_CHAT_COLOR;
    setChatMessages((prev) => [
      ...prev,
      { sender, text, color, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    ]);
    if (opts?.toast) {
      const toastId = Date.now() + Math.random();
      setChatToasts((prev) => [...prev.slice(-MAX_CHAT_TOASTS), { id: toastId, sender, text, color }]);
      setTimeout(() => {
        setChatToasts((prev) => prev.filter((t) => t.id !== toastId));
      }, CHAT_TOAST_DURATION_MS);
    }
  }, []);


  return {
    roomCode, isHost, isConnected, peers, chatMessages, chatToasts, inviteRoomCode,
    guestTunnelPairRef,
    handleJoinCoopFromStart, handleHostSession, handleJoinSession, handleLeaveSession,
    handleSendChatMessage,
    appendSystemChat,
  };
}
