use warp::Filter;
use tokio::sync::broadcast;
use warp::ws::{Message, WebSocket};
use futures::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use serde_json;

type Rooms = Arc<Mutex<HashMap<String, broadcast::Sender<Message>>>>;
type PlayerStates = Arc<Mutex<HashMap<String, HashMap<String, PlayerState>>>>;

#[derive(Clone, serde::Serialize, serde::Deserialize)]
struct PlayerState {
    id: String,
    health: i32,
    score: i32,
}

#[derive(Clone)]
#[allow(dead_code)]
struct GameState {
    mode: String,
    start_time: std::time::Instant,
    duration: std::time::Duration,
    scores: HashMap<String, i32>,
}

type GameStates = Arc<Mutex<HashMap<String, GameState>>>;

#[tokio::main]
async fn main() {
    let rooms: Rooms = Arc::new(Mutex::new(HashMap::new()));
    let player_states: PlayerStates = Arc::new(Mutex::new(HashMap::new()));
    let game_states: GameStates = Arc::new(Mutex::new(HashMap::new()));

    // 定期的にゲーム状態を更新するタスクを開始
    let game_states_clone = game_states.clone();
    let rooms_clone = rooms.clone();
    tokio::task::spawn(async move {
        loop {
            update_game_states(&game_states_clone, &rooms_clone).await;
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        }
    });

    let chat = warp::path("chat")
        .and(warp::ws())
        .and(warp::path::param())
        .and(with_rooms(rooms.clone()))
        .and(with_player_states(player_states.clone()))
        .map(|ws: warp::ws::Ws, room_id: String, rooms, player_states| {
            ws.on_upgrade(move |socket| user_connected(socket, room_id, rooms, player_states))
        });

    warp::serve(chat).run(([127, 0, 0, 1], 3030)).await;
}

fn with_rooms(rooms: Rooms) -> impl Filter<Extract = (Rooms,), Error = std::convert::Infallible> + Clone {
    warp::any().map(move || rooms.clone())
}

fn with_player_states(states: PlayerStates) -> impl Filter<Extract = (PlayerStates,), Error = std::convert::Infallible> + Clone {
    warp::any().map(move || states.clone())
}

async fn user_connected(ws: WebSocket, room_id: String, rooms: Rooms, _player_states: PlayerStates) {
    let (mut user_ws_tx, mut user_ws_rx) = ws.split();

    let tx = {
        let mut rooms = rooms.lock().unwrap();
        rooms.entry(room_id.clone()).or_insert_with(|| {
            let (tx, _rx) = broadcast::channel(10);
            tx
        }).clone()
    };

    let mut rx = tx.subscribe();

    tokio::task::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if let Err(e) = user_ws_tx.send(msg).await {
                eprintln!("websocket send error: {}", e);
            }
        }
    });

    while let Some(result) = user_ws_rx.next().await {
        let msg = match result {
            Ok(msg) => msg,
            Err(e) => {
                eprintln!("websocket error: {}", e);
                break;
            }
        };
        
        if let Ok(text) = msg.to_str() {
            if let Ok(data) = serde_json::from_str::<serde_json::Value>(text) {
                // 衝突検出メッセージを処理
                if let Some("hit") = data.get("type").and_then(|v| v.as_str()) {
                    // 衝突情報を全クライアントに転送
                    let _ = tx.send(msg.clone());
                    continue;
                }
            }
        }
        
        tx.send(msg).unwrap();
    }
}

async fn update_game_states(game_states: &GameStates, rooms: &Rooms) {
    let mut states_to_update = Vec::new();
    
    {
        let game_states = game_states.lock().unwrap();
        let rooms = rooms.lock().unwrap();
        
        for (room_id, state) in game_states.iter() {
            if let Some(tx) = rooms.get(room_id) {
                let elapsed = state.start_time.elapsed();
                
                // ゲームの残り時間を計算
                if elapsed >= state.duration {
                    // ゲーム終了、結果を送信
                    states_to_update.push((room_id.clone(), tx.clone()));
                } else {
                    // 残り時間を更新
                    let remaining = state.duration - elapsed;
                    let message = serde_json::json!({
                        "type": "game_time",
                        "remaining": remaining.as_secs()
                    });
                    
                    let _ = tx.send(Message::text(message.to_string()));
                }
            }
        }
    }
    
    // ゲーム終了処理
    for (room_id, tx) in states_to_update {
        // 新しいゲームを開始
        start_new_game(room_id, game_states, &tx).await;
    }
}

async fn start_new_game(room_id: String, game_states: &GameStates, tx: &broadcast::Sender<Message>) {
    let mut game_states = game_states.lock().unwrap();
    
    // 新しいゲーム状態を作成
    let new_state = GameState {
        mode: "deathmatch".to_string(),
        start_time: std::time::Instant::now(),
        duration: std::time::Duration::from_secs(300), // 5分間
        scores: HashMap::new(),
    };
    
    game_states.insert(room_id, new_state);
    
    // ゲーム開始メッセージを送信
    let message = serde_json::json!({
        "type": "game_start",
        "mode": "deathmatch",
        "duration": 300
    });
    
    let _ = tx.send(Message::text(message.to_string()));
}
