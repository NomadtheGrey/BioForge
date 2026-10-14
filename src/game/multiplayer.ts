import {
  MultiplayerPeer,
  StructureEntity,
  FloraEntity,
  FaunaEntity,
  DroppedItemEntity,
} from '../types/game';
import type { WorldSnapshot } from './saveSystem';

const RELAY_BASE_URL = 'wss://bioforge-relay.nomadthegrey71.workers.dev';
const MAX_SEEN_MESSAGE_IDS = 1000;
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
  onWorldSync?: (data: { structures: StructureEntity[]; flora: FloraEntity[]; fauna: FaunaEntity[]; drops: DroppedItemEntity[]; dayNightCycle: number }) => void;
  onChatMessage?: (senderName: string, text: string, color: string) => void;
  onEntityUpsert?: (kind: EntityKind, entity: EntitySnapshot) => void;
  onEntityRemove?: (kind: EntityKind, id: string) => void;
  onDayNight?: (value: number) => void;
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

  constructor(callbacks: MultiplayerCallbacks = {}) {
    this.callbacks = callbacks;
    this.peerId = 'bio_' + Math.random().toString(36).substring(2, 9);
    this.playerName = this.loadPlayerName();
    const colors = ['#38bdf8', '#a855f7', '#34d399', '#f59e0b', '#ec4899', '#06b6d4'];
    this.playerColor = colors[Math.floor(Math.random() * colors.length)];
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
            }
          );
        }
        break;
      }

      case 'entity_upsert': {
        const { kind, entity } = msg.payload as { kind: EntityKind; entity: EntitySnapshot };
        this.callbacks.onEntityUpsert?.(kind, entity);
        break;
      }

      case 'entity_remove': {
        const { kind, id } = msg.payload as { kind: EntityKind; id: string };
        this.callbacks.onEntityRemove?.(kind, id);
        break;
      }

      case 'chat_message': {
        const { text } = msg.payload as { text: string };
        this.callbacks.onChatMessage?.(msg.senderName, text, msg.senderColor);
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
    this.broadcastMessage('entity_upsert', { kind, entity });
  }

  public broadcastEntityRemove(kind: EntityKind, id: string) {
    this.broadcastMessage('entity_remove', { kind, id });
  }

  public broadcastDayNight(value: number) {
    this.broadcastMessage('day_night', { value });
  }

  // Sends the host's whole world to a guest who just joined (their game
  // booted with the starter world, which is not the world the host is
  // playing in once saves exist). Guests apply it via onWorldSync.
  public broadcastWorldSync(world: WorldSnapshot, dayNightCycle: number) {
    this.broadcastMessage('world_sync', {
      structures: world.structures,
      flora: world.flora,
      fauna: world.fauna,
      drops: world.drops,
      dayNightCycle,
    });
  }

  public broadcastChat(text: string) {
    this.broadcastMessage('chat_message', { text });
  }

  public getConnectedPeers(): MultiplayerPeer[] {
    return Array.from(this.peers.values());
  }
}

export const multiplayerManager = new MultiplayerManager();
