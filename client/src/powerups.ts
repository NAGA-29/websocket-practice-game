import { PowerUp, PowerUpEffect } from './types.js';
import { powerups, canvas, blockSize, squares } from './game.js';
import { updateHealthBar } from './ui.js';
import { sendWebSocketMessage } from './network.js';

// 外部から変更できるようにexport
// letではなくvarを使用して再代入可能にする
export var playerHealth = 100;
export var moveAmount = 3;

// プレイヤーの体力をリセットする関数
export function resetPlayerHealth(): void {
    playerHealth = 100;
}

// プレイヤーの体力を更新する関数
export function updatePlayerHealth(amount: number): void {
    playerHealth += amount;
    playerHealth = Math.max(0, Math.min(100, playerHealth)); // 0〜100の範囲に制限
}

// パワーアップの種類
const powerupTypes = {
    SPEED: { color: 'yellow', effect: 'speed' as PowerUpEffect },
    HEALTH: { color: 'green', effect: 'health' as PowerUpEffect },
    DAMAGE: { color: 'red', effect: 'damage' as PowerUpEffect }
};

// パワーアップを生成
export function spawnPowerup(ws: WebSocket): void {
    const types = Object.values(powerupTypes);
    const type = types[Math.floor(Math.random() * types.length)];
    
    const powerup: PowerUp = {
        x: Math.random() * (canvas.width - 20),
        y: Math.random() * (canvas.height - 20),
        size: 15,
        color: type.color,
        effect: type.effect,
        duration: 10000 // 10秒間
    };
    
    powerups.push(powerup);
    
    // サーバーにパワーアップ生成を通知
    sendWebSocketMessage(ws, {
        type: 'powerup_spawn',
        powerup: powerup
    });
}

// パワーアップとの衝突を検出
export function checkPowerupCollisions(userId: string, ws: WebSocket): void {
    const square = squares[userId];
    if (!square) return;
    
    for (let i = powerups.length - 1; i >= 0; i--) {
        const powerup = powerups[i];
        
        // 衝突検出
        if (square.x < powerup.x + powerup.size &&
            square.x + square.size > powerup.x &&
            square.y < powerup.y + powerup.size &&
            square.y + square.size > powerup.y) {
            
            // パワーアップ効果を適用
            applyPowerup(powerup);
            
            // パワーアップを削除
            powerups.splice(i, 1);
            
            // サーバーにパワーアップ取得を通知
            sendWebSocketMessage(ws, {
                id: userId,
                type: 'powerup_collect',
                effect: powerup.effect
            });
        }
    }
}

// パワーアップ効果を適用
function applyPowerup(powerup: PowerUp): void {
    switch (powerup.effect) {
        case 'speed':
            // 移動速度を一時的に上げる
            const originalMoveAmount = moveAmount;
            moveAmount = moveAmount * 1.5;
            
            setTimeout(() => {
                moveAmount = originalMoveAmount;
            }, powerup.duration);
            break;
            
        case 'health':
            // 体力回復
            updatePlayerHealth(30);
            updateHealthBar();
            break;
            
        case 'damage':
            // 弾のダメージを一時的に上げる
            // 実装は省略
            break;
    }
} 