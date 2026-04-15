package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// PlayerState はプレイヤーの状態を管理する
type PlayerState struct {
	ID     string `json:"id"`
	Health int    `json:"health"`
	Score  int    `json:"score"`
}

// GameState はゲームの状態を管理する
type GameState struct {
	Mode      string
	StartTime time.Time
	Duration  time.Duration
	Scores    map[string]int
}

// Room はルーム内の接続クライアントを管理する
type Room struct {
	mu      sync.Mutex
	clients map[*Client]bool
	broadcast chan []byte
}

// Client はWebSocket接続を表す
type Client struct {
	conn *websocket.Conn
	send chan []byte
	room *Room
}

// Hub はルーム全体を管理する
type Hub struct {
	mu           sync.RWMutex
	rooms        map[string]*Room
	playerStates map[string]map[string]*PlayerState // room_id -> player_id -> state
	gameStates   map[string]*GameState              // room_id -> game state
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // 開発用にすべてのオリジンを許可
	},
}

func newHub() *Hub {
	return &Hub{
		rooms:        make(map[string]*Room),
		playerStates: make(map[string]map[string]*PlayerState),
		gameStates:   make(map[string]*GameState),
	}
}

// getOrCreateRoom はルームを取得または作成する
func (h *Hub) getOrCreateRoom(roomID string) *Room {
	h.mu.Lock()
	defer h.mu.Unlock()

	if room, ok := h.rooms[roomID]; ok {
		return room
	}

	room := &Room{
		clients:   make(map[*Client]bool),
		broadcast: make(chan []byte, 256),
	}
	h.rooms[roomID] = room
	h.gameStates[roomID] = &GameState{
		Scores: make(map[string]int),
	}
	h.startNewGameLocked(roomID, room)

	// ルームのブロードキャストループを起動
	go room.run()

	return room
}

// run はルームのブロードキャストループ
func (r *Room) run() {
	for msg := range r.broadcast {
		r.mu.Lock()
		for client := range r.clients {
			select {
			case client.send <- msg:
			default:
				// 送信バッファが詰まっている場合はクライアントを削除
				close(client.send)
				delete(r.clients, client)
			}
		}
		r.mu.Unlock()
	}
}

// addClient はクライアントをルームに追加する
func (r *Room) addClient(client *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.clients[client] = true
}

// removeClient はクライアントをルームから削除する
func (r *Room) removeClient(client *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.clients[client]; ok {
		delete(r.clients, client)
		close(client.send)
	}
}

// readPump はクライアントからメッセージを受信しブロードキャストする
func (c *Client) readPump() {
	defer func() {
		c.room.removeClient(c)
		c.conn.Close()
	}()

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("websocket error: %v", err)
			}
			break
		}

		// "hit" タイプのメッセージを処理（他と同様にブロードキャスト）
		var data map[string]interface{}
		if err := json.Unmarshal(message, &data); err == nil {
			if msgType, ok := data["type"].(string); ok && msgType == "hit" {
				// 衝突情報を全クライアントに転送
				c.room.broadcast <- message
				continue
			}
		}

		c.room.broadcast <- message
	}
}

// writePump はクライアントへメッセージを送信する
func (c *Client) writePump() {
	defer c.conn.Close()

	for msg := range c.send {
		if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			log.Printf("websocket send error: %v", err)
			return
		}
	}
}

// userConnected は新しいWebSocket接続を処理する
func userConnected(hub *Hub, w http.ResponseWriter, r *http.Request, roomID string) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("upgrade error: %v", err)
		return
	}

	room := hub.getOrCreateRoom(roomID)
	client := &Client{
		conn: conn,
		send: make(chan []byte, 256),
		room: room,
	}

	room.addClient(client)

	go client.writePump()
	go client.readPump()
}

// updateGameStates はゲーム状態を定期的に更新する（1秒ごと）
func (h *Hub) updateGameStates() {
	for {
		time.Sleep(time.Second)
		h.processGameStates()
	}
}

func (h *Hub) processGameStates() {
	h.mu.Lock()
	defer h.mu.Unlock()

	type roomEndInfo struct {
		roomID string
		room   *Room
	}
	var endedRooms []roomEndInfo

	for roomID, state := range h.gameStates {
		room, ok := h.rooms[roomID]
		if !ok {
			continue
		}

		elapsed := time.Since(state.StartTime)

		if elapsed >= state.Duration {
			// ゲーム終了
			endedRooms = append(endedRooms, roomEndInfo{roomID, room})
		} else {
			// 残り時間を更新
			remaining := state.Duration - elapsed
			msg := map[string]interface{}{
				"type":      "game_time",
				"remaining": int(remaining.Seconds()),
			}
			if data, err := json.Marshal(msg); err == nil {
				select {
				case room.broadcast <- data:
				default:
				}
			}
		}
	}

	// ゲーム終了処理（ロック外で行う必要があるためここで実行）
	for _, info := range endedRooms {
		h.startNewGameLocked(info.roomID, info.room)
	}
}

// startNewGameLocked は新しいゲームを開始する（mu がロック済みの前提）
func (h *Hub) startNewGameLocked(roomID string, room *Room) {
	newState := &GameState{
		Mode:      "deathmatch",
		StartTime: time.Now(),
		Duration:  5 * time.Minute,
		Scores:    make(map[string]int),
	}
	h.gameStates[roomID] = newState

	msg := map[string]interface{}{
		"type":     "game_start",
		"mode":     "deathmatch",
		"duration": 300,
	}
	if data, err := json.Marshal(msg); err == nil {
		select {
		case room.broadcast <- data:
		default:
		}
	}
}

func main() {
	hub := newHub()

	// ゲーム状態を定期的に更新するゴルーチンを起動
	go hub.updateGameStates()

	// /chat/{room_id} エンドポイントを登録
	http.HandleFunc("/chat/", func(w http.ResponseWriter, r *http.Request) {
		// パスから room_id を抽出: /chat/{room_id}
		path := strings.TrimPrefix(r.URL.Path, "/chat/")
		roomID := strings.TrimSuffix(path, "/")
		if roomID == "" {
			roomID = "default"
		}
		userConnected(hub, w, r, roomID)
	})

	addr := "127.0.0.1:3030"
	fmt.Printf("サーバーを起動しています: ws://%s/chat/{room_id}\n", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatalf("サーバー起動エラー: %v", err)
	}
}
