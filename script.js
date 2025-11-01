(() => {
  const boardEl = document.getElementById('board');
  const statusEl = document.getElementById('status');
  const modeEl = document.getElementById('mode');
  const resetBtn = document.getElementById('reset');
  const yearEl = document.getElementById('year');
  const onlineControls = document.getElementById('onlineControls');
  const createBtn = document.getElementById('createRoom');
  const joinBtn = document.getElementById('joinRoom');
  const roomCodeInput = document.getElementById('roomCode');
  const youAre = document.getElementById('youAre');

  yearEl.textContent = new Date().getFullYear();

  // Socket (lazy init)
  let socket = null;
  let online = { active: false, code: null, mark: null };

  // Game state (local for human/ai modes)
  let board = Array(9).fill(null); // indexes 0..8
  let current = 'X';
  let vsAI = true;
  let scores = { X: 0, O: 0, T: 0 };

  const scoreX = document.getElementById('scoreX');
  const scoreO = document.getElementById('scoreO');
  const scoreT = document.getElementById('scoreT');

  // Build board UI
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('button');
    cell.className = 'cell';
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', 'Empty');
    cell.addEventListener('click', () => onCell(i));
    boardEl.appendChild(cell);
  }

  modeEl.addEventListener('change', () => {
    const v = modeEl.value;
    if (v === 'online') {
      onlineControls.classList.remove('hidden');
      initSocket();
      online.active = true;
      reset(true);
      setStatus('Online mode — Create a room or join with a code.');
    } else {
      onlineControls.classList.add('hidden');
      online = { active:false, code:null, mark:null };
      if (socket) { socket.disconnect(); socket = null; }
      vsAI = v === 'ai';
      reset(true);
    }
  });

  function initSocket() {
    if (socket) return;
    socket = io();
    socket.on('connect', () => {
      setStatus('Connected. Create a room or join with a code.');
    });
    socket.on('roomStatus', ({ players, current: cur, board: b, started }) => {
      board = b || Array(9).fill(null);
      current = cur || 'X';
      updateUI();
      if (started) setStatus(`Room ready! You are ${online.mark}. ${current} to move.`);
    });
    socket.on('state', ({ board: b, current: cur, winner, full, reset }) => {
      board = b;
      current = cur;
      const winLine = winningLine(board);
      updateUI(winLine);
      if (reset) {
        setStatus(`New round — X to move.`);
        return;
      }
      if (winner) {
        setStatus(`${winner} wins!`);
        scores[winner]++; updateScores();
      } else if (full) {
        setStatus(`It's a tie.`);
        scores.T++; updateScores();
      } else {
        const turnMsg = `Turn: ${current}` + (online.active ? (current === online.mark ? ' (your move)' : ' (opponent)') : '');
        setStatus(turnMsg);
      }
    });
  }

  createBtn.addEventListener('click', () => {
    initSocket();
    socket.emit('createRoom', null, (res) => {
      if (res?.ok) {
        online.code = res.code;
        online.mark = res.mark;
        youAre.textContent = `Room: ${res.code} • You: ${res.mark}`;
        setStatus(`Share this code: ${res.code}. Waiting for opponent...`);
      } else {
        setStatus(res?.error || 'Error creating room');
      }
    });
  });

  joinBtn.addEventListener('click', () => {
    const code = (roomCodeInput.value || '').trim();
    if (!code) { setStatus('Enter a room code.'); return; }
    initSocket();
    socket.emit('joinRoom', code, (res) => {
      if (res?.ok) {
        online.code = res.code;
        online.mark = res.mark;
        youAre.textContent = `Room: ${res.code} • You: ${res.mark}`;
        setStatus(`Joined room ${res.code}.`);
      } else {
        setStatus(res?.error || 'Error joining room');
      }
    });
  });

  resetBtn.addEventListener('click', () => reset());

  function reset(keepScores=false) {
    board = Array(9).fill(null);
    current = 'X';
    updateUI();
    if (online.active && socket) {
      socket.emit('reset');
      // server will broadcast new state
    } else {
      setStatus(`${current} to move${vsAI ? ' (vs AI)' : ''}`);
      if (!keepScores) updateScores();
    }
  }

  function setStatus(msg) { statusEl.textContent = msg; }
  function updateScores() {
    scoreX.textContent = scores.X;
    scoreO.textContent = scores.O;
    scoreT.textContent = scores.T;
  }

  function updateUI(winnerLine=null) {
    [...boardEl.children].forEach((cell, idx) => {
      const mark = board[idx];
      cell.textContent = mark ? mark : '';
      cell.classList.toggle('x', mark === 'X');
      cell.classList.toggle('o', mark === 'O');
      const disabledLocal = !!mark || gameOver(board);
      const disabledOnline = online.active && (gameOver(board) || current !== online.mark);
      cell.classList.toggle('disabled', online.active ? disabledOnline : disabledLocal);
      cell.classList.toggle('win', winnerLine?.includes(idx));
      cell.setAttribute('aria-label', mark ? mark : 'Empty');
    });
  }

  function onCell(i) {
    if (online.active) {
      if (!socket) return;
      if (gameOver(board) || current !== online.mark || board[i]) return;
      socket.emit('move', i, (res) => {
        if (!res?.ok) setStatus(res?.error || 'Move rejected');
      });
      return;
    }
    if (board[i] || gameOver(board)) return;
    place(i, current);
    let result = checkGameEnd();
    if (result.done) return;

    if (vsAI && current === 'O') {
      const move = bestMove('O');
      if (move !== -1) {
        place(move, 'O');
        checkGameEnd();
      }
    }
  }

  function place(i, player) {
    board[i] = player;
    current = player === 'X' ? 'O' : 'X';
    updateUI();
  }

  function checkGameEnd() {
    const w = winner(board);
    if (w) {
      const winLine = winningLine(board);
      setStatus(`${w} wins! Click Reset for a new round.`);
      scores[w]++;
      updateUI(winLine);
      updateScores();
      return { done: true };
    } else if (full(board)) {
      setStatus(`It's a tie. Click Reset for a new round.`);
      scores.T++;
      updateUI();
      updateScores();
      return { done: true };
    } else {
      setStatus(`Turn: ${current}${vsAI ? (current==='O' ? ' (AI thinking...)' : ' (vs AI)') : ''}`);
      return { done: false };
    }
  }

  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6],
  ];

  function winner(b) {
    for (const [a, c, d] of lines) {
      if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
    }
    return null;
  }
  function winningLine(b) {
    for (const line of lines) {
      const [a, c, d] = line;
      if (b[a] && b[a] === b[c] && b[a] === b[d]) return line;
    }
    return null;
  }
  function full(b) { return b.every(Boolean); }
  function gameOver(b) { return !!winner(b) || full(b); }

  // Minimax AI — O is the AI by default
  function bestMove(ai='O') {
    let bestScore = -Infinity;
    let move = -1;
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = ai;
        const score = minimax(board, 0, false, ai);
        board[i] = null;
        if (score > bestScore) {
          bestScore = score;
          move = i;
        }
      }
    }
    return move;
  }

  function minimax(b, depth, isMaximizing, ai) {
    const w = winner(b);
    if (w === ai) return 10 - depth;
    if (w && w !== ai) return depth - 10;
    if (full(b)) return 0;

    const human = ai === 'X' ? 'O' : 'X';

    if (isMaximizing) {
      let best = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (!b[i]) {
          b[i] = ai;
          best = Math.max(best, minimax(b, depth + 1, false, ai));
          b[i] = null;
        }
      }
      return best;
    } else {
      let best = Infinity;
      for (let i = 0; i < 9; i++) {
        if (!b[i]) {
          b[i] = human;
          best = Math.min(best, minimax(b, depth + 1, true, ai));
          b[i] = null;
        }
      }
      return best;
    }
  }

  // Init
  reset();
})();