import {
  MultiplayerPeer,
  StructureEntity,
  FloraEntity,
  FaunaEntity,
} from '../types/game';

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
    | 'chat_message';
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
  onPeerMove?: (peerId: string, x: number, z: number, rotation: number, tool: string) => void;
  onBuildPlaced?: (structure: StructureEntity) => void;
  onBuildRemoved?: (structureId: string) => void;
  onFloraHarvested?: (floraId: string) => void;
  onFaunaTamed?: (faunaId: string, tamedBy: string) => void;
  onWorldSync?: (data: { structures: StructureEntity[]; flora: FloraEntity[]; fauna: FaunaEntity[] }) => void;
  onChatMessage?: (senderName: string, text: string, color: string) => void;
}

export class MultiplayerManager {
  public peerId: string;
  public playerName: string;
  public playerColor: string;
  public roomCode: string = '';
  public isHost: boolean = false;
  public isConnected: boolean = false;
  private channel: BroadcastChannel | null = null;
  private peers: Map<string, MultiplayerPeer> = new Map();
  private callbacks: MultiplayerCallbacks = {};

  constructor(callbacks: MultiplayerCallbacks = {}) {
    this.callbacks = callbacks;
    this.peerId = 'bio_' + Math.random().toString(36).substring(2, 9);
    this.playerName = 'Explorer-' + Math.floor(100 + Math.random() * 900);
    const colors = ['#38bdf8', '#a855f7', '#34d399', '#f59e0b', '#ec4899', '#06b6d4'];
    this.playerColor = colors[Math.floor(Math.random() * colors.length)];
  }

  public setCallbacks(callbacks: MultiplayerCallbacks) {
    this.callbacks = callbacks;
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
    if (this.channel) {
      this.broadcastMessage('peer_leave', { peerId: this.peerId });
      this.channel.close();
      this.channel = null;
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
  }

  private handleIncomingMessage(msg: MultiplayerMessage) {
    if (msg.senderId === this.peerId) return; // Ignore own messages

    switch (msg.type) {
      case 'peer_join': {
        const payload = msg.payload as { name: string; color: string };
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
        this.callbacks.onPeerJoin?.(peer);

        // If I am host, respond with my presence and greeting
        if (this.isHost) {
          this.broadcastMessage('peer_join', {
            name: this.playerName,
            color: this.playerColor,
          });
        }
        break;
      }

      case 'peer_leave': {
        this.peers.delete(msg.senderId);
        this.callbacks.onPeerLeave?.(msg.senderId);
        break;
      }

      case 'peer_move': {
        const payload = msg.payload as { x: number; z: number; rotation: number; tool: string };
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
        this.callbacks.onPeerMove?.(msg.senderId, payload.x, payload.z, payload.rotation, payload.tool);
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
            }
          );
        }
        break;
      }

      case 'chat_message': {
        const { text } = msg.payload as { text: string };
        this.callbacks.onChatMessage?.(msg.senderName, text, msg.senderColor);
        break;
      }
    }
  }

  public broadcastMessage(type: MultiplayerMessage['type'], payload: unknown) {
    if (!this.channel) return;
    const msg: MultiplayerMessage = {
      type,
      senderId: this.peerId,
      senderName: this.playerName,
      senderColor: this.playerColor,
      roomCode: this.roomCode,
      payload,
      timestamp: Date.now(),
    };
    try {
      this.channel.postMessage(msg);
    } catch (e) {
      console.warn('Failed to broadcast message', e);
    }
  }

  public broadcastPlayerMove(x: number, z: number, rotation: number, tool: string) {
    this.broadcastMessage('peer_move', { x, z, rotation, tool });
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

  public broadcastChat(text: string) {
    this.broadcastMessage('chat_message', { text });
  }

  public getConnectedPeers(): MultiplayerPeer[] {
    return Array.from(this.peers.values());
  }
}

export const multiplayerManager = new MultiplayerManager();
