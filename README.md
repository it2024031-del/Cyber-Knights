# CyberKnight — Tic Tac Toe (Web + Online)
Created by **SUBHADIP JANA**

A modern, responsive Tic Tac Toe with three modes:
- **Human vs Human** (same device)
- **Human vs AI** (minimax, perfect play)
- **Online 2-Player** (Socket.IO rooms)

## Quick Start (Local)
1) Install Node.js 18+
2) In this folder, run:
```bash
npm install
npm start
```
3) Open your browser at **http://localhost:3000**  
4) Choose **Online 2-Player**, click **Create Room** and share the code with your friend.  
   Your friend opens the same URL and clicks **Join** with the code.

## Deploy
- Deploy to services like **Render**, **Railway**, **Glitch**, **Heroku**, or **Vercel (with Node server)**.
- Ensure the server serves `/public` and Socket.IO (already configured in `server.js`).

## Structure
```
CyberKnight_TicTacToe_Web_Online/
├─ package.json
├─ server.js
└─ public/
   ├─ index.html
   ├─ styles.css
   └─ script.js
```

## Notes
- Online games use a simple room code (letters/numbers). The server is authoritative for board/turns.
- If both players leave, the room is cleaned up.
- Scoreboard is local per browser session.
