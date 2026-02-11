import { squares } from './game.js';
import { playerHealth } from './powerups.js';

// UIの初期化
export function setupUI(userId: string): void {
    // UIコンテナを取得
    const uiContainer = document.getElementById('uiContainer');
    if (!uiContainer) {
        console.error('UIコンテナが見つかりません');
        return;
    }

    // スコアボードを表示する要素を追加
    const scoreboardElement = document.createElement('div');
    scoreboardElement.id = 'scoreboard';
    uiContainer.appendChild(scoreboardElement);

    // プレイヤーの体力を表示
    const healthBarElement = document.createElement('div');
    healthBarElement.id = 'healthBar';
    uiContainer.appendChild(healthBarElement);

    const healthFillElement = document.createElement('div');
    healthFillElement.id = 'healthFill';
    healthFillElement.style.width = '100%';
    healthFillElement.style.height = '100%';
    healthFillElement.style.backgroundColor = 'green';
    healthBarElement.appendChild(healthFillElement);

    // チャットUIを追加
    setupChatUI(userId, uiContainer);
    
    // 初期更新
    updateScoreboard();
    updateHealthBar();
}

// チャットUIの設定
function setupChatUI(userId: string, uiContainer: HTMLElement): void {
    const chatContainer = document.createElement('div');
    chatContainer.id = 'chatContainer';
    uiContainer.appendChild(chatContainer);

    const chatMessages = document.createElement('div');
    chatMessages.id = 'chatMessages';
    chatMessages.style.height = '150px';
    chatMessages.style.overflowY = 'auto';
    chatMessages.style.marginBottom = '10px';
    chatContainer.appendChild(chatMessages);

    const chatInput = document.createElement('input');
    chatInput.type = 'text';
    chatInput.id = 'chatInput';
    chatInput.placeholder = 'メッセージを入力...';
    chatContainer.appendChild(chatInput);

    // チャットメッセージを送信
    chatInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && chatInput.value.trim() !== '') {
            const message = chatInput.value.trim();
            
            // サーバーにメッセージを送信
            const ws = (window as any).gameWebSocket; // グローバル変数からWebSocketを取得
            if (ws) {
                ws.send(JSON.stringify({
                    id: userId,
                    type: 'chat',
                    message: message
                }));
            }
            
            chatInput.value = '';
        }
    });
}

// スコアボードを更新する関数
export function updateScoreboard(): void {
    const scoreboardElement = document.getElementById('scoreboard');
    if (!scoreboardElement) return;
    
    let scoreHTML = '<h3>スコアボード</h3>';
    for (const id in squares) {
        const player = squares[id];
        const isCurrentPlayer = id === (window as any).gameUserId ? ' (あなた)' : '';
        scoreHTML += `<div>${id}${isCurrentPlayer}: ${player.score || 0} 点</div>`;
    }
    scoreboardElement.innerHTML = scoreHTML;
}

// 体力バーを更新する関数
export function updateHealthBar(): void {
    const healthFillElement = document.getElementById('healthFill');
    if (!healthFillElement) return;
    
    const healthPercentage = Math.max(0, playerHealth);
    healthFillElement.style.width = `${healthPercentage}%`;
    
    // 体力に応じて色を変更
    if (healthPercentage > 60) {
        healthFillElement.style.backgroundColor = 'green';
    } else if (healthPercentage > 30) {
        healthFillElement.style.backgroundColor = 'orange';
    } else {
        healthFillElement.style.backgroundColor = 'red';
    }
} 