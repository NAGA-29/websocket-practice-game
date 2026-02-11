import { Square, Bullet, PowerUp, Walls, Block, Direction } from './types.js';
import { updateScoreboard, updateHealthBar } from './ui.js';
import { getRandomColor } from './utils.js';
import { checkPowerupCollisions, spawnPowerup } from './powerups.js';
import { updateWalls, increaseDifficulty } from './walls.js';
import { isWebSocketConnected, sendWebSocketMessage } from './network.js';

// ゲーム状態
export let squares: Record<string, Square> = {};
export let bullets: Bullet[] = [];
export let powerups: PowerUp[] = [];
export let playerHealth = 100;
export let moveAmount = 3;
export const bulletSpeed = 8;
export const blockSize = 30;
export let blockSpawnInterval = 10000;

// 弾の発射制限
let lastFireTime = 0;
const fireInterval = 300; // 0.3秒ごとに発射可能

// キー入力状態
export const keys: Record<string, boolean> = {
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    ArrowDown: false,
    ' ': false
};

// 壁の状態
export const walls: Walls = {
    top: { blocks: [], lastSpawn: 0, depth: 0 },
    right: { blocks: [], lastSpawn: 0, depth: 0 },
    bottom: { blocks: [], lastSpawn: 0, depth: 0 },
    left: { blocks: [], lastSpawn: 0, depth: 0 }
};

// キャンバス要素 - exportを追加
export let canvas: HTMLCanvasElement;
export let context: CanvasRenderingContext2D;

// WebSocketインスタンスを保持
let gameWebSocket: WebSocket;
let gameUserId: string;

// ゲームの初期化
export function initGame(userId: string, ws: WebSocket): void {
    console.log('Initializing game...');
    
    // WebSocketとユーザーIDを保存
    gameWebSocket = ws;
    gameUserId = userId;
    
    // キャンバス要素を取得
    canvas = document.getElementById('drawingCanvas') as HTMLCanvasElement;
    if (!canvas) {
        console.error('Canvas element not found!');
        return;
    }
    
    // キャンバスのサイズを設定
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // コンテキストを取得
    context = canvas.getContext('2d')!;
    if (!context) {
        console.error('Could not get canvas context!');
        return;
    }
    
    console.log('Canvas initialized:', canvas.width, 'x', canvas.height);
    
    // テスト描画
    context.fillStyle = 'red';
    context.fillRect(50, 50, 100, 100);
    
    // グローバル変数にWebSocketとユーザーIDを保存
    (window as any).gameWebSocket = ws;
    (window as any).gameUserId = userId;
    
    // キャンバスのリサイズイベント
    window.addEventListener('resize', resizeCanvas);
    
    // プレイヤーの初期化
    squares[userId] = { 
        x: 50, 
        y: 50, 
        size: 30, 
        color: getRandomColor(), 
        direction: 'right',
        score: 0
    };
    
    // キーボードイベントの設定
    document.addEventListener('keydown', (event) => {
        if (event.key in keys) {
            keys[event.key] = true;
        }
    });
    
    document.addEventListener('keyup', (event) => {
        if (event.key in keys) {
            keys[event.key] = false;
        }
    });
    
    // WebSocketが接続済みならゲームを開始、そうでなければ接続後に開始
    if (isWebSocketConnected) {
        startGame();
    } else {
        window.startGameAfterConnection = startGame;
    }
}

// ゲームを開始する関数
function startGame(): void {
    console.log('Starting game...');
    
    // ゲームループの開始
    drawSquares();
    gameLoop();
    
    // 難易度上昇タイマーの開始
    setTimeout(() => increaseDifficulty(), 30000);
    
    // パワーアップ生成タイマーの開始
    setInterval(() => {
        if (isWebSocketConnected) {
            spawnPowerup(gameWebSocket);
        }
    }, 15000);
}

// キャンバスのリサイズ
function resizeCanvas(): void {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// ゲームループ
function gameLoop(): void {
    const square = squares[gameUserId];
    if (!square) return;

    // 移動処理
    if (keys.ArrowLeft) {
        square.x = Math.max(0, square.x - moveAmount);
        square.direction = 'left';
    }
    if (keys.ArrowRight) {
        square.x = Math.min(canvas.width - square.size, square.x + moveAmount);
        square.direction = 'right';
    }
    if (keys.ArrowUp) {
        square.y = Math.max(0, square.y - moveAmount);
        square.direction = 'up';
    }
    if (keys.ArrowDown) {
        square.y = Math.min(canvas.height - square.size, square.y + moveAmount);
        square.direction = 'down';
    }

    // 弾の更新
    updateBullets();

    // 射撃処理（発射間隔を制限）
    const now = Date.now();
    if (keys[' '] && now - lastFireTime > fireInterval) {
        lastFireTime = now;
        fireBullet(square);
    }

    // 位置更新の送信
    if (isWebSocketConnected) {
        sendWebSocketMessage(gameWebSocket, {
            id: gameUserId,
            x: square.x,
            y: square.y,
            color: square.color,
            direction: square.direction,
            type: 'move'
        });
    }

    // パワーアップとの衝突検出
    if (isWebSocketConnected) {
        checkPowerupCollisions(gameUserId, gameWebSocket);
    }

    requestAnimationFrame(gameLoop);
}

// 弾を発射する
function fireBullet(square: Square): void {
    const velocities: Record<Direction, {vx: number, vy: number}> = {
        'up': { vx: 0, vy: -bulletSpeed },
        'down': { vx: 0, vy: bulletSpeed },
        'left': { vx: -bulletSpeed, vy: 0 },
        'right': { vx: bulletSpeed, vy: 0 }
    };
    
    const velocity = velocities[square.direction];
    
    const bullet: Bullet = {
        x: square.x + square.size / 2,
        y: square.y + square.size / 2,
        vx: velocity.vx,
        vy: velocity.vy,
        size: 8,
        color: square.color,
        ownerId: gameUserId
    };
    
    bullets.push(bullet);
    
    // 安全に送信
    if (isWebSocketConnected) {
        sendWebSocketMessage(gameWebSocket, {
            id: gameUserId,
            x: square.x,
            y: square.y,
            color: square.color,
            direction: square.direction,
            type: 'fire',
            bullet
        });
    }
}

// 弾の更新
function updateBullets(): void {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        
        // 弾の位置を更新
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        
        // 画面外に出た弾を削除
        if (bullet.x < 0 || bullet.x > canvas.width || 
            bullet.y < 0 || bullet.y > canvas.height) {
            bullets.splice(i, 1);
            continue;
        }
        
        // 弾と四角形の衝突検出
        for (const id in squares) {
            if (id === bullet.ownerId) continue; // 自分の弾は自分に当たらない
            
            const square = squares[id];
            if (bullet.x > square.x && 
                bullet.x < square.x + square.size &&
                bullet.y > square.y && 
                bullet.y < square.y + square.size) {
                
                // 衝突を検出したらサーバーに通知
                if (isWebSocketConnected) {
                    sendWebSocketMessage(gameWebSocket, {
                        type: 'hit',
                        shooterId: bullet.ownerId,
                        targetId: id
                    });
                }
                
                // 弾を削除
                bullets.splice(i, 1);
                break;
            }
        }
    }
}

// 描画処理
export function drawSquares(): void {
    // キャンバスをクリア
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // 壁の更新・描画
    updateWalls();
    
    // パワーアップの描画
    for (const powerup of powerups) {
        context.beginPath();
        context.arc(powerup.x, powerup.y, powerup.size, 0, Math.PI * 2);
        context.fillStyle = powerup.color;
        context.fill();
        context.closePath();
    }
    
    // 四角形と方向指示器の描画
    for (const id in squares) {
        const square = squares[id];
        
        // 四角形を描画
        context.fillStyle = square.color;
        context.fillRect(square.x, square.y, square.size, square.size);
        
        // 方向を示す三角形を描画
        context.beginPath();
        context.fillStyle = 'white';
        
        switch(square.direction) {
            case 'right':
                context.moveTo(square.x + square.size, square.y + square.size/2);
                context.lineTo(square.x + square.size - 8, square.y + square.size/2 - 4);
                context.lineTo(square.x + square.size - 8, square.y + square.size/2 + 4);
                break;
            case 'left':
                context.moveTo(square.x, square.y + square.size/2);
                context.lineTo(square.x + 8, square.y + square.size/2 - 4);
                context.lineTo(square.x + 8, square.y + square.size/2 + 4);
                break;
            case 'up':
                context.moveTo(square.x + square.size/2, square.y);
                context.lineTo(square.x + square.size/2 - 4, square.y + 8);
                context.lineTo(square.x + square.size/2 + 4, square.y + 8);
                break;
            case 'down':
                context.moveTo(square.x + square.size/2, square.y + square.size);
                context.lineTo(square.x + square.size/2 - 4, square.y + square.size - 8);
                context.lineTo(square.x + square.size/2 + 4, square.y + square.size - 8);
                break;
        }
        context.fill();
    }
    
    // 弾の更新と描画
    updateAndDrawBullets();
    
    // アニメーションフレームを要求
    requestAnimationFrame(drawSquares);
}

// 弾の更新と描画
function updateAndDrawBullets(): void {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        
        // 弾の位置を更新
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        
        // 画面外に出た弾を削除
        if (bullet.x < 0 || bullet.x > canvas.width || 
            bullet.y < 0 || bullet.y > canvas.height) {
            bullets.splice(i, 1);
            continue;
        }
        
        // 弾と四角形の衝突検出
        for (const id in squares) {
            if (id === bullet.ownerId) continue; // 自分の弾は自分に当たらない
            
            const square = squares[id];
            if (bullet.x > square.x && 
                bullet.x < square.x + square.size &&
                bullet.y > square.y && 
                bullet.y < square.y + square.size) {
                
                // 衝突を検出したらサーバーに通知
                if (isWebSocketConnected) {
                    sendWebSocketMessage(gameWebSocket, {
                        type: 'hit',
                        shooterId: bullet.ownerId,
                        targetId: id
                    });
                }
                
                // 弾を削除
                bullets.splice(i, 1);
                break;
            }
        }
        
        // 弾を描画（削除されていない場合）
        if (i < bullets.length) {
            context.beginPath();
            context.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
            context.fillStyle = bullet.color;
            context.fill();
            context.closePath();
        }
    }
}

// 残りの関数はファイルを分割するために他のファイルに移動します
// ここでは簡略化のため省略します 