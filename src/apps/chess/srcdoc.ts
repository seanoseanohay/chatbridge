import chessJsSource from 'chess.js/dist/esm/chess.js?raw'

export function createChessAppSrcDoc() {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: light;
        font-family: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
      }
      body {
        margin: 0;
        background: linear-gradient(160deg, #f4efe4 0%, #efe6d3 100%);
        color: #2e2418;
      }
      .wrap {
        box-sizing: border-box;
        min-height: 100vh;
        padding: 18px;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 12px;
      }
      .title {
        font-size: 18px;
        font-weight: 700;
      }
      .status {
        margin-top: 4px;
        font-size: 13px;
        color: #5e4f3b;
      }
      .moves {
        min-height: 24px;
        max-width: 220px;
        text-align: right;
        font-size: 12px;
        color: #5e4f3b;
      }
      .board {
        display: grid;
        grid-template-columns: repeat(8, minmax(0, 1fr));
        width: min(100%, 720px);
        margin: 0 auto;
        border: 1px solid #b79d78;
        border-radius: 18px;
        overflow: hidden;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.6), 0 12px 24px rgba(93, 61, 26, 0.12);
      }
      .square {
        aspect-ratio: 1;
        display: grid;
        place-items: center;
        font-size: clamp(28px, 3.8vw, 42px);
        position: relative;
        cursor: pointer;
        user-select: none;
        transition: transform 120ms ease, box-shadow 120ms ease, filter 120ms ease;
      }
      .square:hover {
        transform: scale(0.985);
      }
      .light { background: #f7ecd7; }
      .dark { background: #b88a5a; color: white; }
      .square.selected {
        box-shadow: inset 0 0 0 5px rgba(39, 110, 241, 0.78);
      }
      .square.target::after {
        content: '';
        position: absolute;
        inset: 34%;
        border-radius: 999px;
        background: rgba(39, 110, 241, 0.32);
      }
      .square.capture::after {
        content: '';
        position: absolute;
        inset: 10%;
        border-radius: 999px;
        border: 4px solid rgba(192, 40, 40, 0.55);
      }
      .panel {
        width: min(100%, 720px);
        margin: 14px auto 0;
        display: grid;
        gap: 8px;
      }
      .hint, .error {
        border-radius: 12px;
        padding: 10px 12px;
        font-size: 13px;
      }
      .hint { background: rgba(255,255,255,0.72); }
      .error { background: #f9d8d8; color: #7a1e1e; display: none; }
      .error.visible { display: block; }
      .meta {
        font-size: 12px;
        color: #5e4f3b;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="header">
        <div>
          <div class="title">Chess</div>
          <div class="status" id="status">Waiting for game…</div>
        </div>
        <div class="moves" id="moves"></div>
      </div>
      <div class="board" id="board"></div>
      <div class="panel">
        <div class="hint" id="hint">Click a piece to see legal targets, or type a move like <code>e4</code>, <code>Nf3</code>, or <code>e2e4</code>.</div>
        <div class="meta" id="meta"></div>
        <div class="error" id="error"></div>
      </div>
    </div>
    <script type="module">
      ${chessJsSource}

      const PIECES = {
        wp: '♙', wr: '♖', wn: '♘', wb: '♗', wq: '♕', wk: '♔',
        bp: '♟', br: '♜', bn: '♞', bb: '♝', bq: '♛', bk: '♚'
      };

      let game = new Chess();
      let activeSessionId = null;
      let selectedSquare = null;
      let legalTargets = [];
      let manualSeq = 1000;

      const boardEl = document.getElementById('board');
      const statusEl = document.getElementById('status');
      const movesEl = document.getElementById('moves');
      const errorEl = document.getElementById('error');
      const metaEl = document.getElementById('meta');
      const hintEl = document.getElementById('hint');

      function pieceSymbol(piece) {
        if (!piece) return '';
        return PIECES[piece.color + piece.type] || '';
      }

      function currentTurnColor() {
        return game.turn() === 'w' ? 'white' : 'black';
      }

      function summarizeBoard() {
        const history = game.history();
        const suffix = game.isGameOver()
          ? game.isCheckmate()
            ? 'Checkmate.'
            : game.isDraw()
              ? 'Draw.'
              : 'Game over.'
          : game.inCheck()
            ? 'Check.'
            : 'In progress.';
        return 'Moves: ' + history.length + '. Turn: ' + currentTurnColor() + '. Recent moves: ' + (history.slice(-4).join(', ') || 'none') + '. ' + suffix;
      }

      function setHint(message) {
        hintEl.innerHTML = message;
      }

      function showError(message) {
        errorEl.textContent = message;
        errorEl.classList.add('visible');
      }

      function clearError() {
        errorEl.textContent = '';
        errorEl.classList.remove('visible');
      }

      function post(type, payload) {
        if (!activeSessionId) return;
        parent.postMessage({ type, sessionId: activeSessionId, ...payload }, '*');
      }

      function updateStatusText() {
        if (!activeSessionId) {
          statusEl.textContent = 'Waiting for game…';
          return;
        }

        if (game.isCheckmate()) {
          statusEl.textContent = 'Checkmate · ' + (currentTurnColor() === 'white' ? 'Black' : 'White') + ' wins';
          return;
        }

        if (game.isDraw()) {
          statusEl.textContent = 'Draw';
          return;
        }

        statusEl.textContent =
          'Turn: ' +
          currentTurnColor() +
          (game.inCheck() ? ' · check' : '') +
          ' · session ' +
          activeSessionId.slice(0, 8);
      }

      function render() {
        const board = game.board();
        boardEl.innerHTML = '';

        for (let rank = 0; rank < 8; rank++) {
          for (let file = 0; file < 8; file++) {
            const squareName = 'abcdefgh'[file] + String(8 - rank);
            const piece = board[rank][file];
            const square = document.createElement('button');
            square.type = 'button';
            square.className = 'square ' + ((rank + file) % 2 === 0 ? 'light' : 'dark');

            if (selectedSquare === squareName) {
              square.className += ' selected';
            }

            const targetMove = legalTargets.find((move) => move.to === squareName);
            if (targetMove) {
              square.className += targetMove.captured ? ' capture' : ' target';
            }

            square.textContent = pieceSymbol(piece);
            square.dataset.square = squareName;
            square.setAttribute('aria-label', 'Square ' + squareName);
            boardEl.appendChild(square);
          }
        }

        movesEl.textContent = game.history().slice(-8).join(' · ');
        metaEl.textContent = 'FEN: ' + game.fen();
        updateStatusText();
      }

      function resetSelection() {
        selectedSquare = null;
        legalTargets = [];
      }

      function postStateUpdate(seq) {
        post('APP_STATE_UPDATE', {
          seq,
          stateSummary: summarizeBoard()
        });
      }

      function maybePostComplete(seq) {
        if (!game.isGameOver()) return;

        const result = {
          outcome: game.isCheckmate()
            ? currentTurnColor() === 'white'
              ? 'black-win'
              : 'white-win'
            : 'draw',
          pgn: game.pgn(),
          fen: game.fen(),
          stateSummary: summarizeBoard()
        };

        post('APP_COMPLETE', { seq, result });
      }

      function handleSuccessfulMove(moveResult, meta) {
        clearError();
        resetSelection();
        render();
        postStateUpdate(meta.seq);

        if (meta.toolName) {
          post('APP_RESULT', {
            seq: meta.seq,
            toolName: meta.toolName,
            result: {
              accepted: true,
              move: moveResult.san,
              lan: moveResult.lan,
              pgn: game.pgn(),
              fen: game.fen(),
              stateSummary: summarizeBoard()
            }
          });
        }

        maybePostComplete(meta.seq);
      }

      function tryMove(moveInput, meta) {
        try {
          const moveResult =
            typeof moveInput === 'string'
              ? game.move(moveInput, { strict: false })
              : game.move(moveInput);

          if (!moveResult) {
            throw new Error('Invalid move');
          }

          handleSuccessfulMove(moveResult, meta);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          showError(message);
          if (meta.toolName) {
            post('APP_RESULT', {
              seq: meta.seq,
              toolName: meta.toolName,
              result: { error: 'illegal_move', description: message }
            });
          }
        }
      }

      function handleSquareSelection(squareName) {
        if (game.isGameOver()) {
          showError('The game is over. Start a new game to keep playing.');
          return;
        }

        const piece = game.get(squareName);
        const pieceIsCurrentTurn = piece && piece.color === game.turn();

        if (!selectedSquare) {
          if (!pieceIsCurrentTurn) {
            showError('Select one of the pieces for the current turn.');
            return;
          }

          selectedSquare = squareName;
          legalTargets = game.moves({ square: squareName, verbose: true });
          clearError();
          setHint('Selected <code>' + squareName + '</code>. Click a highlighted target square to move.');
          render();
          return;
        }

        if (selectedSquare === squareName) {
          resetSelection();
          clearError();
          setHint('Click a piece to see legal targets, or type a move like <code>e4</code>, <code>Nf3</code>, or <code>e2e4</code>.');
          render();
          return;
        }

        if (pieceIsCurrentTurn) {
          selectedSquare = squareName;
          legalTargets = game.moves({ square: squareName, verbose: true });
          clearError();
          setHint('Selected <code>' + squareName + '</code>. Click a highlighted target square to move.');
          render();
          return;
        }

        const target = legalTargets.find((move) => move.to === squareName);
        if (!target) {
          showError('That is not a legal destination for the selected piece.');
          return;
        }

        tryMove({ from: selectedSquare, to: squareName, promotion: 'q' }, { seq: manualSeq++ });
      }

      function resetGame() {
        game = new Chess();
        resetSelection();
        manualSeq = 1000;
        clearError();
        setHint('Click a piece to see legal targets, or type a move like <code>e4</code>, <code>Nf3</code>, or <code>e2e4</code>.');
        render();
      }

      boardEl.addEventListener('click', (event) => {
        const square = event.target && event.target.closest ? event.target.closest('.square') : null;
        if (!square) return;
        handleSquareSelection(square.dataset.square);
      });

      boardEl.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const square = event.target && event.target.closest ? event.target.closest('.square') : null;
        if (!square) return;
        event.preventDefault();
        handleSquareSelection(square.dataset.square);
      });

      window.addEventListener('message', (rawEvent) => {
        const event = rawEvent.data;
        if (!event || typeof event !== 'object') return;

        if (event.type === 'INIT_APP') {
          activeSessionId = event.sessionId;
          resetGame();
          post('APP_READY', {});
          postStateUpdate(0);
          return;
        }

        if (!activeSessionId || event.sessionId !== activeSessionId) return;

        if (event.type === 'INVOKE_TOOL') {
          if (event.toolName === 'chess_start') {
            resetGame();
            postStateUpdate(event.seq);
            post('APP_RESULT', {
              seq: event.seq,
              toolName: event.toolName,
              result: {
                accepted: true,
                pgn: game.pgn(),
                fen: game.fen(),
                stateSummary: summarizeBoard()
              }
            });
            return;
          }

          if (event.toolName === 'chess_move') {
            tryMove(event.params && event.params.move, { seq: event.seq, toolName: event.toolName });
          }
        }
      });

      render();
    </script>
  </body>
</html>`
}
