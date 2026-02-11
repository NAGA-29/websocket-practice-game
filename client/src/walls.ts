import { Wall } from './types.js';
import { walls, blockSize, canvas, squares, bullets } from './game.js';
import { updateHealthBar } from './ui.js';
import { respawnPlayer } from './player.js';
import { playerHealth, updatePlayerHealth } from './powerups.js';

// 外部から参照できるようにexport
export let blockSpawnInterval = 5000; // 5秒ごとにブロック生成
export let blockMoveInterval = 5000; // 2秒ごとにブロック移動

// 壁の更新と描画
export function updateWalls(): void {
    const now = Date.now();
    
    // 各方向の壁を更新・描画
    Object.keys(walls).forEach(direction => {
        const wall = walls[direction as keyof typeof walls];
        
        // 新しいブロックを生成するかチェック
        if (now - wall.lastSpawn > blockSpawnInterval) {
            wall.lastSpawn = now;
            
            // 方向に応じて新しいブロックを追加
            switch(direction) {
                case 'top':
                    addTopBlocks(wall, now);
                    break;
                case 'right':
                    addRightBlocks(wall, now);
                    break;
                case 'bottom':
                    addBottomBlocks(wall, now);
                    break;
                case 'left':
                    addLeftBlocks(wall, now);
                    break;
            }
        }
        
        // 各ブロックの描画と移動
        updateAndDrawBlocks(wall, direction, now);
    });
}

// 上部の壁にブロックを追加
function addTopBlocks(wall: Wall, now: number): void {
    // ランダムな数のブロックを生成（1〜5個）
    const numBlocks = Math.floor(Math.random() * 5) + 1;
    const blockWidth = canvas.width / 10; // 画面幅を10等分
    
    // 既存のブロックの位置を避けて配置
    const existingPositions = wall.blocks.map(block => Math.floor(block.x / blockWidth));
    const availablePositions = Array.from({length: 10}, (_, i) => i)
        .filter(pos => !existingPositions.includes(pos));
    
    // 利用可能な位置がなければ終了
    if (availablePositions.length === 0) return;
    
    // ランダムに位置を選択
    for (let i = 0; i < Math.min(numBlocks, availablePositions.length); i++) {
        const randomIndex = Math.floor(Math.random() * availablePositions.length);
        const position = availablePositions.splice(randomIndex, 1)[0];
        
        wall.blocks.push({
            x: position * blockWidth,
            y: 0,
            width: blockSize,
            height: blockSize,
            createdAt: now,
            depth: 0 // 壁の深さ（0が最も外側）
        });
    }
}

// 右側の壁にブロックを追加
function addRightBlocks(wall: Wall, now: number): void {
    // ランダムな数のブロックを生成（1〜5個）
    const numBlocks = Math.floor(Math.random() * 5) + 1;
    const blockHeight = canvas.height / 10; // 画面高さを10等分
    
    // 既存のブロックの位置を避けて配置
    const existingPositions = wall.blocks.map(block => Math.floor(block.y / blockHeight));
    const availablePositions = Array.from({length: 10}, (_, i) => i)
        .filter(pos => !existingPositions.includes(pos));
    
    // 利用可能な位置がなければ終了
    if (availablePositions.length === 0) return;
    
    // ランダムに位置を選択
    for (let i = 0; i < Math.min(numBlocks, availablePositions.length); i++) {
        const randomIndex = Math.floor(Math.random() * availablePositions.length);
        const position = availablePositions.splice(randomIndex, 1)[0];
        
        wall.blocks.push({
            x: canvas.width - blockSize,
            y: position * blockHeight,
            width: blockSize,
            height: blockSize,
            createdAt: now,
            depth: 0 // 壁の深さ（0が最も外側）
        });
    }
}

// 下部の壁にブロックを追加
function addBottomBlocks(wall: Wall, now: number): void {
    // ランダムな数のブロックを生成（1〜5個）
    const numBlocks = Math.floor(Math.random() * 5) + 1;
    const blockWidth = canvas.width / 10; // 画面幅を10等分
    
    // 既存のブロックの位置を避けて配置
    const existingPositions = wall.blocks.map(block => Math.floor(block.x / blockWidth));
    const availablePositions = Array.from({length: 10}, (_, i) => i)
        .filter(pos => !existingPositions.includes(pos));
    
    // 利用可能な位置がなければ終了
    if (availablePositions.length === 0) return;
    
    // ランダムに位置を選択
    for (let i = 0; i < Math.min(numBlocks, availablePositions.length); i++) {
        const randomIndex = Math.floor(Math.random() * availablePositions.length);
        const position = availablePositions.splice(randomIndex, 1)[0];
        
        wall.blocks.push({
            x: position * blockWidth,
            y: canvas.height - blockSize,
            width: blockSize,
            height: blockSize,
            createdAt: now,
            depth: 0 // 壁の深さ（0が最も外側）
        });
    }
}

// 左側の壁にブロックを追加
function addLeftBlocks(wall: Wall, now: number): void {
    // ランダムな数のブロックを生成（1〜5個）
    const numBlocks = Math.floor(Math.random() * 5) + 1;
    const blockHeight = canvas.height / 10; // 画面高さを10等分
    
    // 既存のブロックの位置を避けて配置
    const existingPositions = wall.blocks.map(block => Math.floor(block.y / blockHeight));
    const availablePositions = Array.from({length: 10}, (_, i) => i)
        .filter(pos => !existingPositions.includes(pos));
    
    // 利用可能な位置がなければ終了
    if (availablePositions.length === 0) return;
    
    // ランダムに位置を選択
    for (let i = 0; i < Math.min(numBlocks, availablePositions.length); i++) {
        const randomIndex = Math.floor(Math.random() * availablePositions.length);
        const position = availablePositions.splice(randomIndex, 1)[0];
        
        wall.blocks.push({
            x: 0,
            y: position * blockHeight,
            width: blockSize,
            height: blockSize,
            createdAt: now,
            depth: 0 // 壁の深さ（0が最も外側）
        });
    }
}

// ブロックの更新と描画
function updateAndDrawBlocks(wall: Wall, direction: string, now: number): void {
    const ctx = canvas.getContext('2d')!;
    
    // 各ブロックを更新・描画
    for (let i = wall.blocks.length - 1; i >= 0; i--) {
        const block = wall.blocks[i];
        const age = now - block.createdAt;
        
        // 一定時間ごとにブロックを内側に移動
        const moveSteps = Math.floor(age / blockMoveInterval);
        if (moveSteps > block.depth) {
            block.depth = moveSteps;
            
            // 方向に応じてブロックを移動
            switch(direction) {
                case 'top':
                    block.y = moveSteps * blockSize;
                    break;
                case 'right':
                    block.x = canvas.width - blockSize - (moveSteps * blockSize);
                    break;
                case 'bottom':
                    block.y = canvas.height - blockSize - (moveSteps * blockSize);
                    break;
                case 'left':
                    block.x = moveSteps * blockSize;
                    break;
            }
        }
        
        // ブロックの描画
        ctx.fillStyle = '#8B4513'; // 茶色
        ctx.fillRect(block.x, block.y, block.width, block.height);
        
        // プレイヤーとの衝突検出
        for (const id in squares) {
            const square = squares[id];
            if (block.x < square.x + square.size &&
                block.x + block.width > square.x &&
                block.y < square.y + square.size &&
                block.y + block.height > square.y) {
                
                // 衝突した場合、ダメージを与える
                if (id === (window as any).gameUserId) {
                    try {
                        // ダメージを与える（5ポイント）
                        applyDamage(5);
                        
                        // 体力がゼロになったら再スポーン
                        if (playerHealth <= 0) {
                            const ws = (window as any).gameWebSocket;
                            if (ws && ws.readyState === WebSocket.OPEN) {
                                respawnPlayer(id, ws);
                            }
                        }
                        
                        // ブロックを消滅させる
                        wall.blocks.splice(i, 1);
                        return; // このブロックの処理を終了
                    } catch (error) {
                        console.error('壁との衝突処理中にエラーが発生しました:', error);
                    }
                }
            }
        }
        
        // 弾との衝突検出
        let blockDestroyed = false;
        for (let j = bullets.length - 1; j >= 0; j--) {
            const bullet = bullets[j];
            if (bullet.x > block.x && 
                bullet.x < block.x + block.width &&
                bullet.y > block.y && 
                bullet.y < block.y + block.height) {
                
                // 衝突した場合、弾を削除
                bullets.splice(j, 1);
                
                // ブロックを破壊（確率で）
                if (Math.random() < 0.5) { // 30%の確率でブロックを破壊
                    wall.blocks.splice(i, 1);
                    blockDestroyed = true;
                    break;
                }
            }
        }
        
        // ブロックが破壊された場合、次のブロックに進む
        if (blockDestroyed) continue;
        
        // 画面中央に到達したブロックを削除
        if (block.depth >= 10) { // 深さが10以上になったら削除
            wall.blocks.splice(i, 1);
            continue;
        }
    }
}

// プレイヤーにダメージを与える
function applyDamage(amount: number): void {
    updatePlayerHealth(-amount);
    updateHealthBar();
}

// 難易度を徐々に上げる
export function increaseDifficulty(): void {
    // ブロック生成間隔を短くする
    blockSpawnInterval = Math.max(2000, blockSpawnInterval - 300);
    // ブロック移動間隔を短くする
    blockMoveInterval = Math.max(1000, blockMoveInterval - 100);
    
    console.log(`難易度上昇: ブロック生成間隔 ${blockSpawnInterval}ms, 移動間隔 ${blockMoveInterval}ms`);
    
    // 10秒ごとに難易度を上げる
    setTimeout(increaseDifficulty, 10000);
} 