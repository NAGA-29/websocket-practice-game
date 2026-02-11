import { squares, bullets } from './game.js';
import { updateScoreboard, updateHealthBar } from './ui.js';
import { respawnPlayer } from './player.js';
import { playerHealth, updatePlayerHealth } from './powerups.js';

// WebSocket接続とその管理
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 3000; // 3秒

// WebSocketの接続状態を追跡
export let isWebSocketConnected = false;

export function connectWebSocket(roomId: string, userId: string): WebSocket {
    const ws = new WebSocket(`ws://localhost:3030/chat/${roomId}`);
    
    ws.onopen = () => {
        console.log('WebSocket接続が確立されました');
        reconnectAttempts = 0; // 接続成功したらリセット
        isWebSocketConnected = true; // 接続状態を更新
        
        // 再接続メッセージがあれば削除
        const reconnectMessage = document.getElementById('reconnectMessage');
        if (reconnectMessage) {
            document.body.removeChild(reconnectMessage);
        }
        
        if (squares[userId]) {
            squares[userId].score = 0;
        }
        updateScoreboard();
        updateHealthBar();
        
        // 接続が確立されたらゲームを開始
        if (typeof window.startGameAfterConnection === 'function') {
            window.startGameAfterConnection();
        }
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'move' || data.type === 'fire') {
            if (!squares[data.id]) {
                squares[data.id] = { x: data.x, y: data.y, size: 30, color: data.color, direction: data.direction };
            } else {
                squares[data.id].x = data.x;
                squares[data.id].y = data.y;
                squares[data.id].direction = data.direction;
            }
            if (data.type === 'fire' && data.bullet) {
                bullets.push(data.bullet);
            }
        } else if (data.type === 'hit') {
            // プレイヤーが弾に当たった場合
            if (data.targetId === userId) {
                updatePlayerHealth(-10);
                updateHealthBar();
                
                // 体力がゼロになったら再スポーン
                if (playerHealth <= 0) {
                    respawnPlayer(userId, ws);
                }
            }
            
            // 攻撃者のスコアを更新
            if (squares[data.shooterId]) {
                squares[data.shooterId].score = (squares[data.shooterId].score || 0) + 10;
                updateScoreboard();
            }
        } else if (data.type === 'scoreboard') {
            // スコアボード更新
            updateScoreboard();
        } else if (data.type === 'chat') {
            // チャットメッセージを表示
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                const messageElement = document.createElement('div');
                const isCurrentUser = data.id === userId;
                messageElement.style.color = isCurrentUser ? '#AAFFAA' : 'white';
                messageElement.textContent = `${isCurrentUser ? 'あなた' : data.id}: ${data.message}`;
                chatMessages.appendChild(messageElement);
                
                // 自動スクロール
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }
    };
    
    ws.onclose = (event) => {
        console.log('WebSocket接続が閉じられました', event.code, event.reason);
        isWebSocketConnected = false; // 接続状態を更新
        handleDisconnection(roomId, userId);
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket接続エラー:', error);
        // エラー発生時は接続を閉じて再接続処理に任せる
        ws.close();
    };
    
    return ws;
}

function handleDisconnection(roomId: string, userId: string): void {
    if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        console.log(`再接続を試みています... (${reconnectAttempts}/${maxReconnectAttempts})`);
        
        // 再接続メッセージを表示
        showReconnectMessage(reconnectAttempts, maxReconnectAttempts);
        
        // 一定時間後に再接続
        setTimeout(() => connectWebSocket(roomId, userId), reconnectDelay);
    } else {
        // 最大再接続回数を超えた場合
        showErrorMessage();
    }
}

function showReconnectMessage(attempts: number, maxAttempts: number): void {
    // 実装は省略
}

function showErrorMessage(): void {
    // 実装は省略
}

// WebSocketにメッセージを安全に送信する関数
export function sendWebSocketMessage(ws: WebSocket, message: any): void {
    try {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        } else {
            console.warn('WebSocketがまだ接続されていません。メッセージは送信されませんでした。');
        }
    } catch (error) {
        console.error('WebSocketメッセージの送信中にエラーが発生しました:', error);
    }
}

// グローバルに型定義を追加
declare global {
    interface Window {
        startGameAfterConnection?: () => void;
    }
} 