import {
  MultiplayerPeer,
  StructureEntity,
  FloraEntity,
  FaunaEntity,
  DroppedItemEntity,
} from '../types/game';
import type { WorldSnapshot } from './saveSystem';

export const RELAY_BASE_URL = 'wss://bioforge-relay.nomadthegrey71.workers.dev';
const MAX_SEEN_MESSAGE_IDS = 1000;

/**
 * CHAT VOICES (Adam, 2026-10-18): the two reserved speakers
 * in the co-op chat. SYSTEM wears the sky blue and ADMIN
 * the amber — both RESERVED out of the player palette below
 * (they used to be dealable player colors), so no explorer's
 * name can ever wear the system's voice or the grower's.
 */
export const SYSTEM_CHAT_COLOR = '#38bdf8';
export const ADMIN_CHAT_COLOR = '#f59e0b';

/** The player palette: six seats, sky and amber reserved. */
const PLAYER_COLORS = ['#a855f7', '#34d399', '#ec4899', '#06b6d4', '#a3e635', '#fb7185'];
const RELAY_RECONNECT_DELAY_MS = 3000;
const PLAYER_NAME_STORAGE_KEY = 'bioforge_player_name';
const MAX_PLAYER_NAME_LENGTH = 20;

export type EntityKind = 'flora' | 'fauna' | 'structure' | 'drop';
export type EntitySnapshot =
  | FloraEntity
  | FaunaEntity
  | StructureEntity
  | DroppedItemEntity;

export interface MultiplayerMessage {
  type:
    | 'peer_join'
    | 'peer_leave'
    | 'peer_move'
    | 'build_placed'
    | 'build_removed'
    | 'flora_harvested'
    | 'fauna_tamed'
    | 'world_sync'
    | 'chat_message'
    | 'entity_upsert'
    | 'entity_remove'
    | 'zone_request'
    | 'zone_snapshot'
    | 'tunnel_pair'
    | 'day_night';
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  roomCode: string;
  payload: unknown;
  timestamp: number;
}

export interface MultiplayerCallbacks {
  onPeerJoin?: (peer: MultiplayerPeer) => void;
  onPeerLeave?: (peerId: string) => void;
  onPeerMove?: (peerId: string, x: number, z: number, rotation: number, tool: string, level: number, zone: string) => void;
  onBuildPlaced?: (structure: StructureEntity) => void;
  onBuildRemoved?: (structureId: string) => void;
  onFloraHarvested?: (floraId: string) => void;
  onFaunaTamed?: (faunaId: string, tamedBy: string) => void;
  onWorldSync?: (data: { structures: StructureEntity[]; flora: FloraEntity[]; fauna: FaunaEntity[]; drops: DroppedItemEntity[]; dayNightCycle: number; zone?: string; zones?: Record<string, WorldSnapshot>; worldSeed?: string; worldCreatedAt?: number }) => void;
  onChatMessage?: (senderName: string, text: string, color: string) => void;
  // Entity events carry the SENDER's zone tag (zone travel,
  // 2026-10-15): with players wandering different zones of the same
  // world independently, an upsert is only meaningful in the zone it
  // happened in. Receivers route on it (App owns the routing rules).
  onEntityUpsert?: (kind: EntityKind, entity: EntitySnapshot, zone?: string) => void;
  onEntityRemove?: (kind: EntityKind, id: string, zone?: string) => void;
  // Zone travel is host-authoritative (Adam, 2026-10-15): a guest
  // never rolls a zone itself — it ASKS, and the host sends the
  // zone (rolling it fresh from the seed itself when nobody has
  // visited). One source of truth, like everything else in co-op.
  onZoneRequest?: (zone: string) => void;
  onZoneSnapshot?: (data: { zone: string; world: WorldSnapshot; worldSeed: string }) => void;
  // The BioTunnel guest fix (Adam, 2026-10-16): pairing is derived
  // from the KNOWN world, so a guest who never visited the far zone
  // can't see the far mouth. The host carries the pair's truth —
  // both mouths' zone keys + structure ids — to guests on the
  // heartbeat. Exit positions are NOT carried: they are read from
  // the far mouth inside the zone snapshot the ride requests.
  onTunnelPair?: (mouths: TunnelPairMouth[]) => void;
  onDayNight?: (value: number) => void;
}

/** One end of the BioTunnel pair as the host reports it: the zone
 *  key it lives in and the mouth structure's id. */
export interface TunnelPairMouth {
  zone: string;
  id: string;
}

export class MultiplayerManager {
  public peerId: string;
  public playerName: string;
  public playerColor: string;
  public roomCode: string = '';
  public isHost: boolean = false;
  public isConnected: boolean = false;
  private channel: BroadcastChannel | null = null;
  private socket: WebSocket | null = null;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private seenMessageIds: Set<string> = new Set();
  private peers: Map<string, MultiplayerPeer> = new Map();
  private callbacks: MultiplayerCallbacks = {};
  // The local player's current zone tag ('zone:zx,zz' on the surface,
  // an instanceId inside a cave/ruin). App keeps this current via
  // setCurrentZoneTag; every outgoing entity event is stamped with
  // it centrally here, so the dozens of broadcast call sites in the
  // hooks never have to know zones exist.
  private currentZoneTag: string = 'surface';

  /** Tell the manager which zone/instance the local player is in —
   *  outgoing entity events are stamped with it. */
  public setCurrentZoneTag(tag: string): void {
    this.currentZoneTag = tag;
  }

  constructor(callbacks: MultiplayerCallbacks = {}) {
    this.callbacks = callbacks;
    this.peerId = 'bio_' + Math.random().toString(36).substring(2, 9);
    this.playerName = this.loadPlayerName();
    // Seat 0 until the roster says otherwise (refreshSeatColor).
    this.playerColor = PLAYER_COLORS[0];
  }

  /**
   * SEAT COLORS (Adam, 2026-10-18): a player's chat color is
   * their seat at the table — the roster (own id + known peer
   * ids, sorted) dealt over PLAYER_COLORS. Every client sees
   * the same roster, so every screen computes the same colors
   * with no protocol change; the color still rides presence
   * and chat payloads exactly as before, now as a fact the
   * room agrees on instead of a dice roll (two players could
   * collide before). Seats reshuffle when the roster changes
   * — a message already in the log keeps the color it was
   * sent with, which is honest: it WAS their color then.
   * Called wherever this manager learns or loses a peer.
   */
  private refreshSeatColor(): void {
    const ids = [this.peerId, ...this.peers.keys()].sort();
    const seat = Math.max(0, ids.indexOf(this.peerId));
    this.playerColor = PLAYER_COLORS[seat % PLAYER_COLORS.length];
  }

  public setCallbacks(callbacks: MultiplayerCallbacks) {
    this.callbacks = callbacks;
  }

  private generatePlayerName(): string {
    return 'Explorer-' + Math.floor(100 + Math.random() * 900);
  }

  private loadPlayerName(): string {
    try {
      const saved = localStorage.getItem(PLAYER_NAME_STORAGE_KEY);
      if (saved && saved.trim().length > 0) return saved;
    } catch (e) {
      // Storage unavailable (private mode, etc.) — fall back to a rolled name.
    }
    return this.generatePlayerName();
  }

  public setPlayerName(name: string) {
    const trimmed = name.trim().slice(0, MAX_PLAYER_NAME_LENGTH);
    this.playerName = trimmed.length > 0 ? trimmed : this.generatePlayerName();
    try {
      localStorage.setItem(PLAYER_NAME_STORAGE_KEY, this.playerName);
    } catch (e) {
      // Storage unavailable — the name still applies for this session.
    }
  }

  public hostSession(customCode?: string): string {
    this.leaveSession();
    this.isHost = true;
    this.roomCode = (customCode || this.generateRoomCode()).toUpperCase();
    this.initChannel();
    this.isConnected = true;
    return this.roomCode;
  }

  public joinSession(roomCode: string): boolean {
    if (!roomCode || roomCode.trim().length === 0) return false;
    this.leaveSession();
    this.isHost = false;
    this.roomCode = roomCode.trim().toUpperCase();
    this.initChannel();
    this.isConnected = true;

    // Send join greeting
    this.broadcastMessage('peer_join', {
      name: this.playerName,
      color: this.playerColor,
    });

    return true;
  }

  public leaveSession() {
    if (this.reconnectTimeoutId !== null) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    if (this.channel) {
      this.broadcastMessage('peer_leave', { peerId: this.peerId });
      this.channel.close();
      this.channel = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.peers.clear();
    this.refreshSeatColor();
    this.isConnected = false;
    this.isHost = false;
    this.roomCode = '';
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private initChannel() {
    try {
      this.channel = new BroadcastChannel(`bioforge_room_${this.roomCode}`);
      this.channel.onmessage = (event) => {
        this.handleIncomingMessage(event.data as MultiplayerMessage);
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported in current environment', e);
    }
    this.initSocket();
  }

  private initSocket() {
    let sock: WebSocket;
    try {
      sock = new WebSocket(`${RELAY_BASE_URL}/room/${this.roomCode}`);
    } catch (e) {
      console.warn('Relay connection failed to start', e);
      return;
    }
    this.socket = sock;
    sock.onopen = () => {
      if (this.reconnectTimeoutId !== null) {
        clearTimeout(this.reconnectTimeoutId);
        this.reconnectTimeoutId = null;
      }
      // Announce over the relay once it is actually connected. The greeting
      // sent at join time cannot travel yet (socket still connecting), and
      // the host never sends one at session start at all.
      this.postToSocket(
        this.buildMessage('peer_join', {
          name: this.playerName,
          color: this.playerColor,
        })
      );
    };
    sock.onmessage = (event) => {
      try {
        this.handleIncomingMessage(JSON.parse(event.data as string) as MultiplayerMessage);
      } catch (e) {
        console.warn('Failed to parse relay message', e);
      }
    };
    sock.onclose = () => {
      // A stale socket from a previous session must not clear or reconnect
      // over the current one — only the live socket's close counts.
      if (this.socket !== sock) return;
      this.socket = null;
      if (!this.isConnected) return;
      this.scheduleReconnect();
    };
    sock.onerror = () => {
      console.warn('Relay connection error');
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimeoutId !== null) return;
    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      if (!this.isConnected) return;
      if (this.socket) return;
      this.initSocket();
    }, RELAY_RECONNECT_DELAY_MS);
  }

  private buildMessage(type: MultiplayerMessage['type'], payload: unknown): MultiplayerMessage {
    return {
      type,
      id: this.peerId + '_' + Math.random().toString(36).substring(2, 10),
      senderId: this.peerId,
      senderName: this.playerName,
      senderColor: this.playerColor,
      roomCode: this.roomCode,
      payload,
      timestamp: Date.now(),
    };
  }

  private postToChannel(msg: MultiplayerMessage) {
    if (!this.channel) return;
    try {
      this.channel.postMessage(msg);
    } catch (e) {
      console.warn('Failed to broadcast message', e);
    }
  }

  private postToSocket(msg: MultiplayerMessage) {
    if (!this.socket) return;
    if (this.socket.readyState !== WebSocket.OPEN) return;
    try {
      this.socket.send(JSON.stringify(msg));
    } catch (e) {
      console.warn('Failed to send relay message', e);
    }
  }

  private handleIncomingMessage(msg: MultiplayerMessage) {
    if (msg.senderId === this.peerId) return; // Ignore own messages

    // The same message can arrive twice (local channel + relay). Handle once.
    if (msg.id) {
      if (this.seenMessageIds.has(msg.id)) return;
      this.seenMessageIds.add(msg.id);
      if (this.seenMessageIds.size > MAX_SEEN_MESSAGE_IDS) this.seenMessageIds.clear();
    }

    switch (msg.type) {
      case 'peer_join': {
        const payload = msg.payload as { name: string; color: string };
        const alreadyKnown = this.peers.has(msg.senderId);
        const peer: MultiplayerPeer = {
          id: msg.senderId,
          name: payload.name || msg.senderName,
          color: payload.color || msg.senderColor,
          x: 0,
          z: 0,
          rotation: 0,
          currentTool: 'harvest_glove',
          ping: 15,
        };
        this.peers.set(msg.senderId, peer);
        // The roster moved: seats (and so chat colors) are
        // redealt before the announcement below carries mine.
        this.refreshSeatColor();
        if (alreadyKnown) break;

        this.callbacks.onPeerJoin?.(peer);

        // Announce myself so the newcomer learns I exist too. Without this,
        // only the host ever answered a join, so guests never discovered
        // each other and every screen showed a different headcount. Firing
        // only for newly learned peers keeps announcements from looping.
        this.broadcastMessage('peer_join', {
          name: this.playerName,
          color: this.playerColor,
        });
        break;
      }

      case 'peer_leave': {
        this.peers.delete(msg.senderId);
        this.refreshSeatColor();
        this.callbacks.onPeerLeave?.(msg.senderId);
        break;
      }

      case 'peer_move': {
        const payload = msg.payload as { x: number; z: number; rotation: number; tool: string; level?: number; zone?: string };
        const existing = this.peers.get(msg.senderId);
        if (existing) {
          existing.x = payload.x;
          existing.z = payload.z;
          existing.rotation = payload.rotation;
        }
        if (!existing) {
          this.peers.set(msg.senderId, {
            id: msg.senderId,
            name: msg.senderName,
            color: msg.senderColor,
            x: payload.x,
            z: payload.z,
            rotation: payload.rotation,
            currentTool: 'harvest_glove',
            ping: 20,
          });
        }
        this.callbacks.onPeerMove?.(msg.senderId, payload.x, payload.z, payload.rotation, payload.tool, payload.level ?? 0, payload.zone ?? 'surface');
        break;
      }

      case 'build_placed': {
        this.callbacks.onBuildPlaced?.(msg.payload as StructureEntity);
        break;
      }

      case 'build_removed': {
        const { id } = msg.payload as { id: string };
        this.callbacks.onBuildRemoved?.(id);
        break;
      }

      case 'flora_harvested': {
        const { floraId } = msg.payload as { floraId: string };
        this.callbacks.onFloraHarvested?.(floraId);
        break;
      }

      case 'fauna_tamed': {
        const { faunaId, tamedBy } = msg.payload as { faunaId: string; tamedBy: string };
        this.callbacks.onFaunaTamed?.(faunaId, tamedBy);
        break;
      }

      case 'world_sync': {
        if (!this.isHost) {
          this.callbacks.onWorldSync?.(
            msg.payload as {
              structures: StructureEntity[];
              flora: FloraEntity[];
              fauna: FaunaEntity[];
              drops: DroppedItemEntity[];
              dayNightCycle: number;
              zone?: string;
              zones?: Record<string, WorldSnapshot>;
              worldSeed?: string;
              worldCreatedAt?: number;
            }
          );
        }
        break;
      }

      case 'entity_upsert': {
        const { kind, entity, zone } = msg.payload as { kind: EntityKind; entity: EntitySnapshot; zone?: string };
        this.callbacks.onEntityUpsert?.(kind, entity, zone);
        break;
      }

      case 'entity_remove': {
        const { kind, id, zone } = msg.payload as { kind: EntityKind; id: string; zone?: string };
        this.callbacks.onEntityRemove?.(kind, id, zone);
        break;
      }

      case 'chat_message': {
        const { text } = msg.payload as { text: string };
        this.callbacks.onChatMessage?.(msg.senderName, text, msg.senderColor);
        break;
      }

      case 'zone_request': {
        // Only the host answers: it owns the world's zones.
        if (this.isHost) {
          const { zone } = msg.payload as { zone: string };
          this.callbacks.onZoneRequest?.(zone);
        }
        break;
      }

      case 'zone_snapshot': {
        if (!this.isHost) {
          this.callbacks.onZoneSnapshot?.(
            msg.payload as { zone: string; world: WorldSnapshot; worldSeed: string }
          );
        }
        break;
      }

      case 'tunnel_pair': {
        // The host's own derivation is the truth — it never applies
        // a pair fact, only sends one (world_sync precedent).
        if (!this.isHost) {
          this.callbacks.onTunnelPair?.(
            (msg.payload as { mouths?: TunnelPairMouth[] }).mouths ?? []
          );
        }
        break;
      }

      case 'day_night': {
        const { value } = msg.payload as { value: number };
        this.callbacks.onDayNight?.(value);
        break;
      }
    }
  }

  public broadcastMessage(type: MultiplayerMessage['type'], payload: unknown) {
    const msg = this.buildMessage(type, payload);
    this.postToChannel(msg);
    this.postToSocket(msg);
  }

  public broadcastPlayerMove(x: number, z: number, rotation: number, tool: string, level: number = 0, zone: string = 'surface') {
    this.broadcastMessage('peer_move', { x, z, rotation, tool, level, zone });
  }

  public broadcastBuildPlaced(structure: StructureEntity) {
    this.broadcastMessage('build_placed', structure);
  }

  public broadcastBuildRemoved(structureId: string) {
    this.broadcastMessage('build_removed', { id: structureId });
  }

  public broadcastFloraHarvest(floraId: string) {
    this.broadcastMessage('flora_harvested', { floraId });
  }

  public broadcastFaunaTame(faunaId: string, tamedBy: string) {
    this.broadcastMessage('fauna_tamed', { faunaId, tamedBy });
  }

  public broadcastEntityUpsert(kind: EntityKind, entity: EntitySnapshot) {
    this.broadcastMessage('entity_upsert', { kind, entity, zone: this.currentZoneTag });
  }

  public broadcastEntityRemove(kind: EntityKind, id: string) {
    this.broadcastMessage('entity_remove', { kind, id, zone: this.currentZoneTag });
  }

  public broadcastDayNight(value: number) {
    this.broadcastMessage('day_night', { value });
  }

  // Sends the host's whole world to a guest who just joined (their game
  // booted with the starter world, which is not the world the host is
  // playing in once saves exist). Guests apply it via onWorldSync.
  // Zone travel (2026-10-15): the sync also carries WHERE the host is
  // (zone key), the host's per-zone snapshots for every zone it has
  // visited (zones), and the world seed — everything a guest needs to
  // wander off independently and still generate the same wilderness
  // the host would, with the host's changes waiting in visited zones.
  public broadcastWorldSync(
    world: WorldSnapshot,
    dayNightCycle: number,
    travel?: { zone: string; zones: Record<string, WorldSnapshot>; worldSeed: string; worldCreatedAt?: number }
  ) {
    this.broadcastMessage('world_sync', {
      structures: world.structures,
      flora: world.flora,
      fauna: world.fauna,
      drops: world.drops,
      dayNightCycle,
      ...(travel ? { zone: travel.zone, zones: travel.zones, worldSeed: travel.worldSeed, worldCreatedAt: travel.worldCreatedAt } : {}),
    });
  }

  /** A guest asks the host for a zone it wants to cross into. */
  public broadcastZoneRequest(zone: string) {
    this.broadcastMessage('zone_request', { zone });
  }

  /** The BioTunnel guest fix (Adam, 2026-10-16): the host's pair
   *  truth — both mouths' zone keys + ids — for guests who never
   *  visited the far zone. Host-only; guests apply, hosts ignore. */
  public broadcastTunnelPair(mouths: TunnelPairMouth[]) {
    this.broadcastMessage('tunnel_pair', { mouths });
  }

  /** The host's answer: the zone's snapshot, from its own record
   *  (rolled by the host itself if the zone is new to everyone). */
  public broadcastZoneSnapshot(zone: string, world: WorldSnapshot, worldSeed: string) {
    this.broadcastMessage('zone_snapshot', { zone, world, worldSeed });
  }

  public broadcastChat(text: string) {
    this.broadcastMessage('chat_message', { text });
  }

  public getConnectedPeers(): MultiplayerPeer[] {
    return Array.from(this.peers.values());
  }
}

export const multiplayerManager = new MultiplayerManager();
