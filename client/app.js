const canvas = document.getElementById('drawingCanvas');
const context = canvas.getContext('2d');
let squares = {};
let bullets = [];
const userId = Math.random().toString(36).substr(2, 9);

squares[userId] = { x: 50, y: 50, size: 30, color: getRandomColor(), direction: 'right' };
let moveAmount = 3;
const bulletSpeed = 8;

let keys = {
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    ArrowDown: false,
    ' ': false
};

const roomId = prompt("Enter room ID:");

// WebSocket接続とその管理
let ws;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 3000; // 3秒

function connectWebSocket() {
    ws = new WebSocket(`ws://localhost:3030/chat/${roomId}`);
    
    ws.onopen = () => {
        console.log('WebSocket接続が確立されました');
        reconnectAttempts = 0; // 接続成功したらリセット
        
        // 再接続メッセージがあれば削除
        const reconnectMessage = document.getElementById('reconnectMessage');
        if (reconnectMessage) {
            document.body.removeChild(reconnectMessage);
        }
        
        squares[userId].score = 0;
        updateScoreboard();
        updateHealthBar();
        drawSquares();
        gameLoop();
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
                playerHealth -= 10;
                updateHealthBar();
                
                // 体力がゼロになったら再スポーン
                if (playerHealth <= 0) {
                    respawnPlayer();
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
            const messageElement = document.createElement('div');
            const isCurrentUser = data.id === userId;
            messageElement.style.color = isCurrentUser ? '#AAFFAA' : 'white';
            messageElement.textContent = `${isCurrentUser ? 'あなた' : data.id}: ${data.message}`;
            chatMessages.appendChild(messageElement);
            
            // 自動スクロール
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    };
    
    ws.onclose = (event) => {
        console.log('WebSocket接続が閉じられました', event.code, event.reason);
        handleDisconnection();
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket接続エラー:', error);
        // エラー発生時は接続を閉じて再接続処理に任せる
        ws.close();
    };
}

function handleDisconnection() {
    if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        console.log(`再接続を試みています... (${reconnectAttempts}/${maxReconnectAttempts})`);
        
        // 再接続メッセージを表示
        const statusMessage = document.createElement('div');
        statusMessage.textContent = `サーバーとの接続が切断されました。再接続中... (${reconnectAttempts}/${maxReconnectAttempts})`;
        statusMessage.style.position = 'absolute';
        statusMessage.style.top = '50%';
        statusMessage.style.left = '50%';
        statusMessage.style.transform = 'translate(-50%, -50%)';
        statusMessage.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
        statusMessage.style.color = 'white';
        statusMessage.style.padding = '20px';
        statusMessage.style.borderRadius = '5px';
        statusMessage.id = 'reconnectMessage';
        
        // 既存のメッセージがあれば削除
        const existingMessage = document.getElementById('reconnectMessage');
        if (existingMessage) {
            document.body.removeChild(existingMessage);
        }
        
        document.body.appendChild(statusMessage);
        
        // 一定時間後に再接続
        setTimeout(connectWebSocket, reconnectDelay);
    } else {
        // 最大再接続回数を超えた場合
        const errorMessage = document.createElement('div');
        errorMessage.textContent = 'サーバーに接続できません。ページを更新してください。';
        errorMessage.style.position = 'absolute';
        errorMessage.style.top = '50%';
        errorMessage.style.left = '50%';
        errorMessage.style.transform = 'translate(-50%, -50%)';
        errorMessage.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
        errorMessage.style.color = 'white';
        errorMessage.style.padding = '20px';
        errorMessage.style.borderRadius = '5px';
        
        // 既存のメッセージがあれば削除
        const existingMessage = document.getElementById('reconnectMessage');
        if (existingMessage) {
            document.body.removeChild(existingMessage);
        }
        
        document.body.appendChild(errorMessage);
    }
}

// 初期接続
connectWebSocket();

// スコアボードを表示する要素を追加
const scoreboardElement = document.createElement('div');
scoreboardElement.id = 'scoreboard';
scoreboardElement.style.position = 'absolute';
scoreboardElement.style.top = '10px';
scoreboardElement.style.right = '10px';
scoreboardElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
scoreboardElement.style.color = 'white';
scoreboardElement.style.padding = '10px';
scoreboardElement.style.borderRadius = '5px';
document.body.appendChild(scoreboardElement);

// プレイヤーの体力を表示
let playerHealth = 100;
const healthBarElement = document.createElement('div');
healthBarElement.id = 'healthBar';
healthBarElement.style.position = 'absolute';
healthBarElement.style.bottom = '10px';
healthBarElement.style.left = '10px';
healthBarElement.style.width = '200px';
healthBarElement.style.height = '20px';
healthBarElement.style.backgroundColor = 'gray';
document.body.appendChild(healthBarElement);

const healthFillElement = document.createElement('div');
healthFillElement.id = 'healthFill';
healthFillElement.style.width = '100%';
healthFillElement.style.height = '100%';
healthFillElement.style.backgroundColor = 'green';
healthBarElement.appendChild(healthFillElement);

// パワーアップアイテムの配列
let powerups = [];

// パワーアップの種類
const powerupTypes = {
    SPEED: { color: 'yellow', effect: 'speed' },
    HEALTH: { color: 'green', effect: 'health' },
    DAMAGE: { color: 'red', effect: 'damage' }
};

// パワーアップを生成する関数
function spawnPowerup() {
    const types = Object.values(powerupTypes);
    const type = types[Math.floor(Math.random() * types.length)];
    
    const powerup = {
        x: Math.random() * (canvas.width - 20),
        y: Math.random() * (canvas.height - 20),
        size: 15,
        color: type.color,
        effect: type.effect,
        duration: 10000 // 10秒間
    };
    
    powerups.push(powerup);
    
    // サーバーにパワーアップ生成を通知
    ws.send(JSON.stringify({
        type: 'powerup_spawn',
        powerup: powerup
    }));
}

// チャットUIを追加
const chatContainer = document.createElement('div');
chatContainer.id = 'chatContainer';
chatContainer.style.position = 'absolute';
chatContainer.style.left = '10px';
chatContainer.style.top = '10px';
chatContainer.style.width = '250px';
chatContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
chatContainer.style.color = 'white';
chatContainer.style.padding = '10px';
chatContainer.style.borderRadius = '5px';
document.body.appendChild(chatContainer);

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
chatInput.style.width = '100%';
chatInput.style.padding = '5px';
chatInput.style.boxSizing = 'border-box';
chatContainer.appendChild(chatInput);

// チャットメッセージを送信
chatInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter' && chatInput.value.trim() !== '') {
        const message = chatInput.value.trim();
        
        // サーバーにメッセージを送信
        ws.send(JSON.stringify({
            id: userId,
            type: 'chat',
            message: message
        }));
        
        chatInput.value = '';
    }
});

/**
 * ランダムな16進数形式の色を生成します。
 * @returns {string} 生成された色。
 */
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// ブロック壁の設定を修正
let walls = {
    top: { blocks: [], lastSpawn: 0, depth: 0 },
    right: { blocks: [], lastSpawn: 0, depth: 0 },
    bottom: { blocks: [], lastSpawn: 0, depth: 0 },
    left: { blocks: [], lastSpawn: 0, depth: 0 }
};

const blockSize = 30;
let blockSpawnInterval = 10000; // 10秒ごとに新しいブロックを生成

// ブロック壁を描画・更新する関数を修正
function updateWalls() {
    const now = Date.now();
    
    // 各方向のブロック壁を更新・描画
    Object.keys(walls).forEach(direction => {
        const wall = walls[direction];
        
        // 新しいブロックを生成するかチェック
        if (now - wall.lastSpawn > blockSpawnInterval) {
            wall.lastSpawn = now;
            
            // 方向に応じて新しいブロックを追加
            switch(direction) {
                case 'top':
                    // 上部の壁: ランダムな位置に数個のブロックを追加
                    const topPositions = [];
                    // 既存のブロックの位置を確認
                    const existingTopBlocks = wall.blocks.filter(b => b.y === 0);
                    const availableTopPositions = [];
                    
                    // 利用可能な位置を特定
                    for (let x = 0; x < canvas.width / blockSize; x++) {
                        const xPos = x * blockSize;
                        if (!existingTopBlocks.some(b => b.x === xPos)) {
                            availableTopPositions.push(xPos);
                        }
                    }
                    
                    // ランダムに2〜4個の位置を選択
                    const numTopBlocks = Math.floor(Math.random() * 3) + 2; // 2〜4個
                    for (let i = 0; i < numTopBlocks && availableTopPositions.length > 0; i++) {
                        const randomIndex = Math.floor(Math.random() * availableTopPositions.length);
                        topPositions.push(availableTopPositions[randomIndex]);
                        availableTopPositions.splice(randomIndex, 1);
                    }
                    
                    // 選択した位置にブロックを追加
                    topPositions.forEach(x => {
                        wall.blocks.push({
                            x: x,
                            y: 0,
                            size: blockSize,
                            active: false,
                            activationTime: now + 500,
                            growthStage: 0,
                            maxGrowth: Math.floor(Math.random() * 3) + 2 // 2〜4ブロック分成長
                        });
                    });
                    break;
                    
                case 'right':
                    // 右側の壁: ランダムな位置に数個のブロックを追加
                    const rightPositions = [];
                    const existingRightBlocks = wall.blocks.filter(b => b.x === canvas.width - blockSize);
                    const availableRightPositions = [];
                    
                    for (let y = 0; y < canvas.height / blockSize; y++) {
                        const yPos = y * blockSize;
                        if (!existingRightBlocks.some(b => b.y === yPos)) {
                            availableRightPositions.push(yPos);
                        }
                    }
                    
                    const numRightBlocks = Math.floor(Math.random() * 3) + 2;
                    for (let i = 0; i < numRightBlocks && availableRightPositions.length > 0; i++) {
                        const randomIndex = Math.floor(Math.random() * availableRightPositions.length);
                        rightPositions.push(availableRightPositions[randomIndex]);
                        availableRightPositions.splice(randomIndex, 1);
                    }
                    
                    rightPositions.forEach(y => {
                        wall.blocks.push({
                            x: canvas.width - blockSize,
                            y: y,
                            size: blockSize,
                            active: false,
                            activationTime: now + 500,
                            growthStage: 0,
                            maxGrowth: Math.floor(Math.random() * 3) + 2
                        });
                    });
                    break;
                    
                case 'bottom':
                    // 下部の壁: ランダムな位置に数個のブロックを追加
                    const bottomPositions = [];
                    const existingBottomBlocks = wall.blocks.filter(b => b.y === canvas.height - blockSize);
                    const availableBottomPositions = [];
                    
                    for (let x = 0; x < canvas.width / blockSize; x++) {
                        const xPos = x * blockSize;
                        if (!existingBottomBlocks.some(b => b.x === xPos)) {
                            availableBottomPositions.push(xPos);
                        }
                    }
                    
                    const numBottomBlocks = Math.floor(Math.random() * 3) + 2;
                    for (let i = 0; i < numBottomBlocks && availableBottomPositions.length > 0; i++) {
                        const randomIndex = Math.floor(Math.random() * availableBottomPositions.length);
                        bottomPositions.push(availableBottomPositions[randomIndex]);
                        availableBottomPositions.splice(randomIndex, 1);
                    }
                    
                    bottomPositions.forEach(x => {
                        wall.blocks.push({
                            x: x,
                            y: canvas.height - blockSize,
                            size: blockSize,
                            active: false,
                            activationTime: now + 500,
                            growthStage: 0,
                            maxGrowth: Math.floor(Math.random() * 3) + 2
                        });
                    });
                    break;
                    
                case 'left':
                    // 左側の壁: ランダムな位置に数個のブロックを追加
                    const leftPositions = [];
                    const existingLeftBlocks = wall.blocks.filter(b => b.x === 0);
                    const availableLeftPositions = [];
                    
                    for (let y = 0; y < canvas.height / blockSize; y++) {
                        const yPos = y * blockSize;
                        if (!existingLeftBlocks.some(b => b.y === yPos)) {
                            availableLeftPositions.push(yPos);
                        }
                    }
                    
                    const numLeftBlocks = Math.floor(Math.random() * 3) + 2;
                    for (let i = 0; i < numLeftBlocks && availableLeftPositions.length > 0; i++) {
                        const randomIndex = Math.floor(Math.random() * availableLeftPositions.length);
                        leftPositions.push(availableLeftPositions[randomIndex]);
                        availableLeftPositions.splice(randomIndex, 1);
                    }
                    
                    leftPositions.forEach(y => {
                        wall.blocks.push({
                            x: 0,
                            y: y,
                            size: blockSize,
                            active: false,
                            activationTime: now + 500,
                            growthStage: 0,
                            maxGrowth: Math.floor(Math.random() * 3) + 2
                        });
                    });
                    break;
            }
        }
        
        // 各ブロックの成長と描画
        const currentTime = Date.now();
        for (let i = wall.blocks.length - 1; i >= 0; i--) {
            const block = wall.blocks[i];
            
            // ブロックをアクティブ化するかチェック
            if (!block.active && currentTime >= block.activationTime) {
                block.active = true;
                
                // 成長ステージを進める
                if (block.growthStage < block.maxGrowth) {
                    block.growthStage++;
                    
                    // 新しいブロックを追加（成長）
                    const newBlock = { ...block };
                    
                    // 方向に応じて成長方向を決定
                    let newX = block.x;
                    let newY = block.y;
                    
                    if (block.y === 0) { // 上部の壁
                        newY = block.growthStage * blockSize;
                    } else if (block.x === canvas.width - blockSize) { // 右側の壁
                        newX = canvas.width - (block.growthStage + 1) * blockSize;
                    } else if (block.y === canvas.height - blockSize) { // 下部の壁
                        newY = canvas.height - (block.growthStage + 1) * blockSize;
                    } else if (block.x === 0) { // 左側の壁
                        newX = block.growthStage * blockSize;
                    }
                    
                    // 新しい位置が既存のブロックと重ならないか確認
                    const isOverlapping = wall.blocks.some(existingBlock => 
                        existingBlock !== block && 
                        existingBlock.x === newX && 
                        existingBlock.y === newY
                    );
                    
                    if (!isOverlapping) {
                        // 重ならない場合のみ新しいブロックを追加
                        newBlock.x = newX;
                        newBlock.y = newY;
                        newBlock.active = false;
                        newBlock.activationTime = currentTime + 3000;
                        newBlock.growthStage = 0;
                        wall.blocks.push(newBlock);
                    }
                }
                
                // 次の成長のためにアクティブ状態をリセット
                block.active = false;
                block.activationTime = currentTime + 5000;
            }
            
            // 中央領域に入ったブロックは削除（プレイヤーの活動領域を確保）
            const safeZone = 100;
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            
            if (Math.abs(block.x - centerX) < safeZone && 
                Math.abs(block.y - centerY) < safeZone) {
                wall.blocks.splice(i, 1);
                continue;
            }
            
            // ブロックを描画
            context.fillStyle = block.active ? '#555555' : 'rgba(85, 85, 85, 0.5)';
            context.fillRect(block.x, block.y, block.size, block.size);
            
            // プレイヤーとの衝突判定
            const square = squares[userId];
            if (square.x < block.x + block.size &&
                square.x + square.size > block.x &&
                square.y < block.y + block.size &&
                square.y + square.size > block.y) {
                
                // 衝突した場合、ダメージを与える
                playerHealth -= 5;
                updateHealthBar();
                
                // 体力がゼロになったら再スポーン
                if (playerHealth <= 0) {
                    respawnPlayer();
                }
                
                // ブロックを削除
                wall.blocks.splice(i, 1);
            }
            
            // 弾との衝突判定
            for (let j = bullets.length - 1; j >= 0; j--) {
                const bullet = bullets[j];
                
                // 衝突判定を改善（バッファを追加）
                const hitBuffer = 5; // 衝突判定の余裕を追加
                
                if (bullet.x + hitBuffer > block.x &&
                    bullet.x - hitBuffer < block.x + block.size &&
                    bullet.y + hitBuffer > block.y &&
                    bullet.y - hitBuffer < block.y + block.size) {
                    
                    // 弾を削除
                    bullets.splice(j, 1);
                    
                    // ブロックを削除
                    wall.blocks.splice(i, 1);
                    break;
                }
            }
        }
    });
}

// drawSquares関数を修正して壁の更新を含める
function drawSquares() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // 壁を更新・描画
    updateWalls();
    
    // パワーアップを描画
    for (const powerup of powerups) {
        context.beginPath();
        context.arc(powerup.x, powerup.y, powerup.size, 0, Math.PI * 2);
        context.fillStyle = powerup.color;
        context.fill();
        context.closePath();
    }
    
    // Draw squares and direction indicators
    for (const id in squares) {
        const square = squares[id];
        context.fillStyle = square.color;
        context.fillRect(square.x, square.y, square.size, square.size);
        
        // Draw direction arrow
        context.fillStyle = 'white';
        context.beginPath();
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
    
    // Update and draw bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        
        if (bullet.x < 0 || bullet.x > canvas.width || 
            bullet.y < 0 || bullet.y > canvas.height) {
            bullets.splice(i, 1);
            continue;
        }
        
        // 弾と四角形の衝突検出
        for (const id in squares) {
            // 自分の弾は自分に当たらない
            if (id === bullet.ownerId) continue;
            
            const square = squares[id];
            if (bullet.x > square.x && 
                bullet.x < square.x + square.size &&
                bullet.y > square.y && 
                bullet.y < square.y + square.size) {
                
                // 衝突を検出したらサーバーに通知
                ws.send(JSON.stringify({
                    type: 'hit',
                    bulletId: i,
                    targetId: id,
                    shooterId: bullet.ownerId
                }));
                
                // 弾を削除
                bullets.splice(i, 1);
                break;
            }
        }
        
        // 弾を描画（衝突していない場合）
        if (i < bullets.length) {
            context.beginPath();
            context.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
            context.fillStyle = bullet.color;
            context.fill();
            context.closePath();
        }
    }
    
    requestAnimationFrame(drawSquares);
}

/**
 * キーの状態を更新するためのkeydownイベントを処理します。
 * @param {KeyboardEvent} event - keydownイベント。
 */
document.addEventListener('keydown', (event) => {
    if (event.key in keys) {
        keys[event.key] = true;
    }
});

/**
 * キーの状態を更新するためのkeyupイベントを処理します。
 * @param {KeyboardEvent} event - keyupイベント。
 */
document.addEventListener('keyup', (event) => {
    if (event.key in keys) {
        keys[event.key] = false;
    }
});

/**
 * 移動と射撃を処理するメインのゲームループ。
 */
function gameLoop() {
    const square = squares[userId];

    // Movement
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

    // Shooting
    if (keys[' ']) {
        const velocities = {
            'up': { vx: 0, vy: -bulletSpeed },
            'down': { vx: 0, vy: bulletSpeed },
            'left': { vx: -bulletSpeed, vy: 0 },
            'right': { vx: bulletSpeed, vy: 0 }
        };
        
        const velocity = velocities[square.direction];
        if (!velocity) return;
        
        const bullet = {
            x: square.x + square.size / 2,
            y: square.y + square.size / 2,
            vx: velocity.vx,
            vy: velocity.vy,
            size: 8,
            color: square.color,
            ownerId: userId
        };
        
        bullets.push(bullet);
        
        ws.send(JSON.stringify({
            id: userId,
            x: square.x,
            y: square.y,
            color: square.color,
            direction: square.direction,
            type: 'fire',
            bullet
        }));
    }

    // Send position update
    ws.send(JSON.stringify({
        id: userId,
        x: square.x,
        y: square.y,
        color: square.color,
        direction: square.direction,
        type: 'move'
    }));

    checkPowerupCollisions();

    requestAnimationFrame(gameLoop);
}

// スコアボードを更新する関数
function updateScoreboard() {
    let scoreHTML = '<h3>スコアボード</h3>';
    for (const id in squares) {
        const player = squares[id];
        const isCurrentPlayer = id === userId ? ' (あなた)' : '';
        scoreHTML += `<div>${id}${isCurrentPlayer}: ${player.score || 0} 点</div>`;
    }
    scoreboardElement.innerHTML = scoreHTML;
}

// 体力バーを更新する関数
function updateHealthBar() {
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

// プレイヤーを再スポーンする関数
function respawnPlayer() {
    playerHealth = 100;
    updateHealthBar();
    
    // ランダムな位置に再スポーン
    const square = squares[userId];
    square.x = Math.random() * (canvas.width - square.size);
    square.y = Math.random() * (canvas.height - square.size);
    
    // 再スポーン情報を送信
    ws.send(JSON.stringify({
        id: userId,
        x: square.x,
        y: square.y,
        color: square.color,
        direction: square.direction,
        type: 'respawn'
    }));
}

// パワーアップとの衝突を検出
function checkPowerupCollisions() {
    const square = squares[userId];
    
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
            ws.send(JSON.stringify({
                id: userId,
                type: 'powerup_collect',
                effect: powerup.effect
            }));
        }
    }
}

// パワーアップ効果を適用する関数
function applyPowerup(powerup) {
    const square = squares[userId];
    
    switch (powerup.effect) {
        case 'speed':
            // 移動速度を一時的に上げる
            const originalMoveAmount = moveAmount;
            // moveAmountは変数になったので直接変更可能
            moveAmount = moveAmount * 1.5;
            
            setTimeout(() => {
                moveAmount = originalMoveAmount;
            }, powerup.duration);
            break;
            
        case 'health':
            // 体力回復
            playerHealth = Math.min(100, playerHealth + 30);
            updateHealthBar();
            break;
            
        case 'damage':
            // 弾のダメージを一時的に上げる
            // 実装は省略
            break;
    }
}

// 定期的にパワーアップを生成
setInterval(spawnPowerup, 15000); // 15秒ごとに生成

// 難易度を徐々に上げる関数を修正
function increaseDifficulty() {
    // ブロック生成間隔を短くする速度を遅くする
    blockSpawnInterval = Math.max(3000, blockSpawnInterval - 50); // 100→50に変更
    
    // 10秒ごとに難易度を上げる（5秒→10秒）
    setTimeout(increaseDifficulty, 10000);
}

// ゲーム開始時に難易度上昇タイマーを開始
setTimeout(increaseDifficulty, 30000); // 30秒後から難易度上昇開始（10秒→30秒）

