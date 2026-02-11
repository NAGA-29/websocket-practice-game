import { squares, canvas } from './game.js';
import { updateHealthBar } from './ui.js';
import { resetPlayerHealth } from './powerups.js';
import { sendWebSocketMessage } from './network.js';

// プレイヤーを再スポーンする関数
export function respawnPlayer(userId: string, ws: WebSocket): void {
    try {
        // プレイヤーの体力をリセット
        resetPlayerHealth();
        updateHealthBar();
        
        // ランダムな位置に再スポーン
        const square = squares[userId];
        if (!square) return;
        
        square.x = Math.random() * (canvas.width - square.size);
        square.y = Math.random() * (canvas.height - square.size);
        
        // 再スポーン情報を送信
        if (ws.readyState === WebSocket.OPEN) {
            sendWebSocketMessage(ws, {
                id: userId,
                x: square.x,
                y: square.y,
                color: square.color,
                direction: square.direction,
                type: 'respawn'
            });
        }
    } catch (error) {
        console.error('プレイヤー再スポーン中にエラーが発生しました:', error);
    }
}

// ランダムな色を生成する関数
export function getRandomColor(): string {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
} 