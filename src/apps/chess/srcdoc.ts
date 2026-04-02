import chessJsSource from 'chess.js/dist/esm/chess.js?raw'

const chessScriptExportIndex = chessJsSource.lastIndexOf('export {')
const chessBrowserSource =
  chessScriptExportIndex >= 0
    ? `${chessJsSource.slice(0, chessScriptExportIndex)}
window.Chess = Chess;
`
    : `${chessJsSource}
window.Chess = Chess;
`

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
        background:
          radial-gradient(circle at top, rgba(255,255,255,0.82), transparent 34%),
          linear-gradient(180deg, #f6efe3 0%, #ecdfc8 100%);
        color: #2e2418;
      }
      .wrap {
        box-sizing: border-box;
        min-height: 100vh;
        padding: 18px;
        display: grid;
        gap: 14px;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }
      .eyebrow {
        font-size: 10px;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: #857052;
        margin-bottom: 4px;
      }
      .title {
        font-size: 22px;
        font-weight: 800;
        line-height: 1;
      }
      .status {
        margin-top: 6px;
        font-size: 13px;
        color: #5e4f3b;
      }
      .turn-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        padding: 10px 14px;
        background: rgba(255,255,255,0.66);
        box-shadow: 0 10px 24px rgba(94, 79, 59, 0.08);
        font-size: 12px;
        font-weight: 700;
      }
      .turn-dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: #fff;
        border: 1px solid rgba(46, 36, 24, 0.22);
      }
      .turn-dot.black {
        background: #2f2519;
      }
      .moves {
        min-height: 24px;
        max-width: 300px;
        text-align: right;
        font-size: 12px;
        color: #5e4f3b;
      }
      .workspace {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 220px;
        gap: 14px;
        align-items: start;
      }
      .board-card {
        background: rgba(255,255,255,0.48);
        border: 1px solid rgba(124, 97, 65, 0.16);
        border-radius: 24px;
        padding: 14px;
        box-shadow:
          0 14px 28px rgba(94, 79, 59, 0.12),
          inset 0 1px 0 rgba(255,255,255,0.52);
      }
      .sidecard {
        border-radius: 18px;
        padding: 14px;
        background: rgba(255,255,255,0.56);
        border: 1px solid rgba(124, 97, 65, 0.12);
        box-shadow: 0 10px 20px rgba(94, 79, 59, 0.08);
      }
      .sidecard-title {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: #7f6849;
        margin-bottom: 8px;
      }
      .move-list {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
        line-height: 1.7;
        color: #4d3f2f;
        white-space: pre-wrap;
      }
      .board {
        display: grid;
        grid-template-columns: repeat(8, minmax(0, 1fr));
        width: min(100%, 720px);
        margin: 0 auto;
        border: 10px solid #7c5b36;
        border-radius: 18px;
        overflow: hidden;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.34),
          0 18px 30px rgba(93, 61, 26, 0.16);
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
      .light { background: linear-gradient(180deg, #f5e8cb 0%, #eedcb5 100%); }
      .dark { background: linear-gradient(180deg, #b37a43 0%, #8e5a2d 100%); color: white; }
      .square.selected {
        box-shadow: inset 0 0 0 5px rgba(39, 110, 241, 0.78);
      }
      .square.last-move {
        box-shadow: inset 0 0 0 999px rgba(255, 217, 92, 0.18);
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
      .piece {
        position: relative;
        z-index: 2;
        line-height: 1;
        text-shadow: 0 1px 0 rgba(255,255,255,0.28), 0 2px 10px rgba(0,0,0,0.14);
      }
      .piece.white {
        color: #fff8ec;
        text-shadow:
          0 1px 0 rgba(76, 49, 16, 0.42),
          0 2px 10px rgba(0,0,0,0.18);
      }
      .piece.black {
        color: #1f1710;
        text-shadow:
          0 1px 0 rgba(255,255,255,0.12),
          0 2px 10px rgba(0,0,0,0.12);
      }
      .coord {
        position: absolute;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.02em;
        opacity: 0.72;
        pointer-events: none;
      }
      .coord-file {
        right: 7px;
        bottom: 5px;
      }
      .coord-rank {
        left: 7px;
        top: 5px;
      }
      .panel {
        width: min(100%, 720px);
        margin: 0 auto;
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
      @media (max-width: 900px) {
        .workspace {
          grid-template-columns: 1fr;
        }
        .moves {
          max-width: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="header">
        <div>
          <div class="eyebrow">Interactive App</div>
          <div class="title">Chess</div>
          <div class="status" id="status">Waiting for game…</div>
        </div>
        <div class="turn-badge" id="turnBadge"><span class="turn-dot"></span><span id="turnText">Waiting</span></div>
      </div>
      <div class="workspace">
        <div class="board-card">
          <div class="board" id="board"></div>
        </div>
        <div class="sidecard">
          <div class="sidecard-title">Moves</div>
          <div class="move-list" id="moves"></div>
        </div>
      </div>
      <div class="panel">
        <div class="hint" id="hint">Click a piece to see legal targets, or type a move like <code>e4</code>, <code>Nf3</code>, or <code>e2e4</code>.</div>
        <div class="meta" id="meta"></div>
        <div class="error" id="error"></div>
      </div>
    </div>
    <script>
      ${chessBrowserSource}
    </script>
    <script>
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
      const turnBadgeEl = document.getElementById('turnBadge');
      const turnTextEl = document.getElementById('turnText');

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
          turnTextEl.textContent = 'Waiting';
          turnBadgeEl.innerHTML = '<span class="turn-dot"></span><span id="turnText">Waiting</span>';
          return;
        }

        if (game.isCheckmate()) {
          statusEl.textContent = 'Checkmate · ' + (currentTurnColor() === 'white' ? 'Black' : 'White') + ' wins';
          turnBadgeEl.innerHTML = '<span class="turn-dot black"></span><span>Game Over</span>';
          return;
        }

        if (game.isDraw()) {
          statusEl.textContent = 'Draw';
          turnBadgeEl.innerHTML = '<span class="turn-dot"></span><span>Draw</span>';
          return;
        }

        turnBadgeEl.innerHTML =
          '<span class="turn-dot ' +
          (game.turn() === 'b' ? 'black' : '') +
          '"></span><span>' +
          (game.turn() === 'w' ? 'White to move' : 'Black to move') +
          '</span>';

        statusEl.textContent =
          'Turn: ' +
          currentTurnColor() +
          (game.inCheck() ? ' · check' : '') +
          ' · session ' +
          activeSessionId.slice(0, 8);
      }

      function render() {
        const board = game.board();
        const verboseHistory = game.history({ verbose: true });
        const lastMove = verboseHistory.length ? verboseHistory[verboseHistory.length - 1] : null;
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

            if (lastMove && (lastMove.from === squareName || lastMove.to === squareName)) {
              square.className += ' last-move';
            }

            square.dataset.square = squareName;
            square.setAttribute('aria-label', 'Square ' + squareName);
            square.innerHTML =
              '<span class="piece ' + (piece ? (piece.color === 'w' ? 'white' : 'black') : '') + '">' +
              pieceSymbol(piece) +
              '</span>' +
              (rank === 7 ? '<span class="coord coord-file">' + squareName[0] + '</span>' : '') +
              (file === 0 ? '<span class="coord coord-rank">' + squareName[1] + '</span>' : '');
            boardEl.appendChild(square);
          }
        }

        const history = game.history();
        const rows = [];
        for (let i = 0; i < history.length; i += 2) {
          rows.push(String(i / 2 + 1).padStart(2, ' ') + '. ' + history[i] + (history[i + 1] ? '   ' + history[i + 1] : ''))
        }
        movesEl.textContent = rows.length ? rows.slice(-10).join('\\n') : '1. ...';
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
