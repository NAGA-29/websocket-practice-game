// ゲームで使用する型定義

export interface Square {
    x: number;
    y: number;
    size: number;
    color: string;
    direction: Direction;
    score?: number;
}

export interface Bullet {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    ownerId: string;
}

export interface PowerUp {
    x: number;
    y: number;
    size: number;
    color: string;
    effect: PowerUpEffect;
    duration: number;
}

export interface Block {
    x: number;
    y: number;
    width: number;
    height: number;
    createdAt: number;
    depth: number; // 壁の深さ（0が最も外側、数値が大きいほど中央に近い）
}

export interface Wall {
    blocks: Block[];
    lastSpawn: number;
    depth: number;
}

export interface Walls {
    top: Wall;
    right: Wall;
    bottom: Wall;
    left: Wall;
}

export type Direction = 'up' | 'down' | 'left' | 'right';
export type PowerUpEffect = 'speed' | 'health' | 'damage'; 