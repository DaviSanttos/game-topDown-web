import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { io, Socket } from 'socket.io-client';

interface Player {
  x: number;
  y: number;
}

class PhaserGame extends Phaser.Scene {
  socket?: Socket;
  players: Record<string, Phaser.GameObjects.Rectangle> = {};
  playerId?: string;
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private ready: boolean = false;

  // Listeners para remover depois
  onCurrentPlayers?: (players: Record<string, Player>) => void;
  onNewPlayer?: (player: { id: string; x: number; y: number }) => void;
  onUpdatePlayer?: (data: { id: string; pos: Player }) => void;
  onPlayerDisconnected?: (id: string) => void;

  constructor() {
    super('PhaserGame');
  }

  preload() {
    // Preload assets se necessário
  }

  create() {
      console.log('create() chamado');
    this.cursors = this.input.keyboard!.createCursorKeys();

    this.socket = io('http://localhost:3000');

    this.socket.on('connect', () => {
      this.playerId = this.socket!.id;
      console.log('Conectado com id', this.playerId);
    });

    this.onCurrentPlayers = (players: Record<string, Player>) => {
      if (!this.ready) return;
      this.addPlayers(players);
    };
    this.socket.on('currentPlayers', this.onCurrentPlayers);

    this.onNewPlayer = (player: { id: string; x: number; y: number }) => {
      if (!this.ready) return;
      this.addPlayer(player.id, { x: player.x, y: player.y });
    };
    this.socket.on('newPlayer', this.onNewPlayer);

    this.onUpdatePlayer = (data: { id: string; pos: Player }) => {
      const rect = this.players[data.id];
      if (rect) {
        rect.x = data.pos.x;
        rect.y = data.pos.y;
      }
    };
    this.socket.on('updatePlayer', this.onUpdatePlayer);

    this.onPlayerDisconnected = (id: string) => {
      if (this.players[id]) {
        this.players[id].destroy();
        delete this.players[id];
      }
    };
    this.socket.on('playerDisconnected', this.onPlayerDisconnected);

    this.ready = true;
  }

  addPlayers(players: Record<string, Player>) {
    Object.entries(players).forEach(([id, pos]) => {
      this.addPlayer(id, pos);
    });
  }

  addPlayer(id: string, pos: Player) {
    if (this.players[id]) return;
    if (!this.ready) {
      console.warn('Tentou adicionar player antes da cena estar pronta');
      return;
    }

    if (!this.add) {
      console.warn('this.add está null, não pode adicionar player agora');
      return;
    }

    console.log('foi')

    const rect = this.add.rectangle(pos.x, pos.y, 40, 40, 0x00ff00);
    this.players[id] = rect;
  }

  update() {
    if (!this.playerId) return;
    const playerRect = this.players[this.playerId];
    if (!playerRect) return;

    let moved = false;

    if (this.cursors.left?.isDown) {
      playerRect.x -= 2;
      moved = true;
    } else if (this.cursors.right?.isDown) {
      playerRect.x += 2;
      moved = true;
    }

    if (this.cursors.up?.isDown) {
      playerRect.y -= 2;
      moved = true;
    } else if (this.cursors.down?.isDown) {
      playerRect.y += 2;
      moved = true;
    }

    if (moved && this.socket && this.socket.connected) {
      this.socket.emit('playerMove', { x: playerRect.x, y: playerRect.y });
    }
  }

  shutdown() {
    // Suspende áudio com checagem segura
    const soundManager = this.sound;
    if ('context' in soundManager && soundManager.context && soundManager.context.state === 'running') {
      soundManager.context.suspend().catch(() => {});
    }

    if (this.socket) {
      if (this.onCurrentPlayers) this.socket.off('currentPlayers', this.onCurrentPlayers);
      if (this.onNewPlayer) this.socket.off('newPlayer', this.onNewPlayer);
      if (this.onUpdatePlayer) this.socket.off('updatePlayer', this.onUpdatePlayer);
      if (this.onPlayerDisconnected) this.socket.off('playerDisconnected', this.onPlayerDisconnected);

      if (this.socket.connected) this.socket.disconnect();
    }
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  scene: PhaserGame,
  backgroundColor: '#222222',
  audio: {
    noAudio: true,
  },
};

const PhaserComponent: React.FC = () => {
  const gameRef = useRef<Phaser.Game | null>(null);
  const gameContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log('PhaserComponent montado')
    if (!gameRef.current && gameContainer.current) {
       console.log('Criando novo Phaser.Game');
      gameRef.current = new Phaser.Game({
        ...config,
        parent: gameContainer.current,
      });
    }

    return () => {
      if (gameRef.current) {
         console.log('PhaserComponent desmontado');
        const scene = gameRef.current.scene.getScene('PhaserGame') as PhaserGame | undefined;
        if (scene) {
          scene.shutdown();
        }
        gameRef.current.destroy(true, false);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={gameContainer}
      style={{ width: '800px', height: '600px', margin: '0 auto', display: 'block' }}
    />
  );
};

export default PhaserComponent;
