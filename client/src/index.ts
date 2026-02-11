import { initGame } from './game.js';
import { setupUI } from './ui.js';
import { connectWebSocket } from './network.js';

console.log('Script loaded');

// DOMContentLoadedイベントを待つ
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGame);
} else {
    // DOMがすでに読み込まれている場合は直接実行
    initializeGame();
}

function initializeGame() {
    console.log('DOM fully loaded, initializing game...');
    
    // キャンバス要素の存在を確認
    const canvas = document.getElementById('drawingCanvas');
    console.log('Canvas element:', canvas);
    
    const roomId = prompt("Enter room ID:") || "default";
    const userId = Math.random().toString(36).substr(2, 9);
    
    // UIの初期化
    setupUI(userId);
    
    // WebSocket接続の確立
    const ws = connectWebSocket(roomId, userId);
    
    // ゲームの初期化
    setTimeout(() => {
        initGame(userId, ws);
    }, 100); // 少し遅延させてDOMが確実に準備できるようにする
} 