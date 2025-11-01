// CyberKnight — Online Tic Tac Toe server (Socket.IO)
// Created by SUBHADIP JANA
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Room state
const rooms = new Map();
// roomCode -> { board:Array(9).fill(null), current:'X', players: { X: socketId|null, O: socketId|null }, started:boolean }

function newRoom() {
  return { board: Array(9).fill(null), current: 'X', players: { X: null, O: null }, started: false };
}

function randCode(n=6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i=0;i<n;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

io.on('connection', (socket) => {
  let joinedRoom = null;
  let mark = null;

  socket.on('createRoom', (_, cb) => {
    let code;
    do { code = randCode(6); } while (rooms.has(code));
    const room = newRoom();
    room.players.X = socket.id;
    rooms.set(code, room);
    socket.join(code);
    joinedRoom = code; mark = 'X';
    cb && cb({ ok: true, code, mark: 'X' });
    io.to(code).emit('roomStatus', { players: room.players, current: room.current, board: room.board });
  });

  socket.on('joinRoom', (code, cb) => {
    code = String(code || "").toUpperCase().trim();
    if (!rooms.has(code)) { cb && cb({ ok:false, error:"Room not found" }); return; }
    const room = rooms.get(code);
    if (room.players.X && room.players.O) { cb && cb({ ok:false, error:"Room is full" }); return; }

    // Assign O if free, else X if weird case
    if (!room.players.O) { room.players.O = socket.id; mark = 'O'; }
    else if (!room.players.X) { room.players.X = socket.id; mark = 'X'; }
    else { cb && cb({ ok:false, error:"Room is full" }); return; }

    socket.join(code);
    joinedRoom = code;
    cb && cb({ ok: true, code, mark });
    room.started = !!(room.players.X && room.players.O);
    io.to(code).emit('roomStatus', { players: room.players, current: room.current, board: room.board, started: room.started });
  });

  socket.on('move', (idx, cb) => {
    if (!joinedRoom || !rooms.has(joinedRoom)) return;
    const room = rooms.get(joinedRoom);
    const playerMark = (room.players.X === socket.id) ? 'X' : (room.players.O === socket.id ? 'O' : null);
    if (!playerMark) return;

    // Validate turn and spot
    if (playerMark !== room.current) { cb && cb({ ok:false, error:"Not your turn" }); return; }
    if (room.board[idx] != null) { cb && cb({ ok:false, error:"Cell occupied" }); return; }
    if (winner(room.board)) { cb && cb({ ok:false, error:"Game over" }); return; }

    room.board[idx] = playerMark;
    room.current = playerMark === 'X' ? 'O' : 'X';

    const w = winner(room.board);
    const full = room.board.every(Boolean);
    io.to(joinedRoom).emit('state', { board: room.board, current: room.current, winner: w, full });

    cb && cb({ ok:true });
  });

  socket.on('reset', () => {
    if (!joinedRoom || !rooms.has(joinedRoom)) return;
    const room = rooms.get(joinedRoom);
    room.board = Array(9).fill(null);
    room.current = 'X';
    io.to(joinedRoom).emit('state', { board: room.board, current: room.current, winner: null, full: false, reset: true });
  });

  socket.on('disconnect', () => {
    if (joinedRoom && rooms.has(joinedRoom)) {
      const room = rooms.get(joinedRoom);
      if (room.players.X === socket.id) room.players.X = null;
      if (room.players.O === socket.id) room.players.O = null;
      io.to(joinedRoom).emit('roomStatus', { players: room.players, current: room.current, board: room.board, started: false });
      // Cleanup empty rooms
      if (!room.players.X && !room.players.O) rooms.delete(joinedRoom);
    }
  });
});

function winner(b) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6],
  ];
  for (const [a,c,d] of lines) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  }
  return null;
}

server.listen(PORT, () => console.log(`CyberKnight online server running on http://localhost:${PORT}`));
