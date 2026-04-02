import { Alert, Badge, Group, Paper, Stack, Text, Title } from '@mantine/core'
import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import { Chess, type Move } from 'chess.js'
import { parsePlatformToAppEvent, type AppResult } from '../../plugin-runtime/types'

type AppState = {
  game: Chess
  activeSessionId: string | null
  error: string | null
  selectedSquare: string | null
  legalTargets: Move[]
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const

const PIECE_GLYPHS: Record<string, string> = {
  wp: '♙',
  wn: '♘',
  wb: '♗',
  wr: '♖',
  wq: '♕',
  wk: '♔',
  bp: '♟',
  bn: '♞',
  bb: '♝',
  br: '♜',
  bq: '♛',
  bk: '♚',
}

function summarizeBoard(game: Chess) {
  const history = game.history()
  const suffix = game.isGameOver() ? (game.isCheckmate() ? 'Checkmate.' : game.isDraw() ? 'Draw.' : 'Game over.') : game.inCheck() ? 'Check.' : 'In progress.'
  return `Moves: ${history.length}. Turn: ${game.turn() === 'w' ? 'white' : 'black'}. Recent moves: ${history.slice(-4).join(', ') || 'none'}. ${suffix}`
}

function getCompletionResult(game: Chess): AppResult {
  return {
    summary: game.isCheckmate()
      ? `Checkmate. ${game.turn() === 'w' ? 'Black' : 'White'} wins.`
      : game.isDraw()
        ? 'Draw.'
        : 'Game over.',
    data: {
      outcome: game.isCheckmate() ? (game.turn() === 'w' ? 'black-win' : 'white-win') : 'draw',
      pgn: game.pgn(),
      fen: game.fen(),
      stateSummary: summarizeBoard(game),
    },
  }
}

function postToParent(payload: Record<string, unknown>) {
  window.parent.postMessage(payload, '*')
}

function getSquareName(fileIndex: number, rankIndex: number) {
  return `${FILES[fileIndex]}${RANKS[rankIndex]}`
}

function getPieceGlyph(game: Chess, square: string) {
  const piece = game.get(square)
  if (!piece) {
    return null
  }
  return PIECE_GLYPHS[`${piece.color}${piece.type}`]
}

export default function EmbeddedChessApp() {
  const [state, setState] = useState<AppState>({
    game: new Chess(),
    activeSessionId: null,
    error: null,
    selectedSquare: null,
    legalTargets: [],
  })

  const turnLabel = state.game.turn() === 'w' ? 'White to move' : 'Black to move'
  const historyRows = useMemo(() => {
    const history = state.game.history()
    const rows: string[] = []
    for (let i = 0; i < history.length; i += 2) {
      rows.push(`${String(i / 2 + 1).padStart(2, ' ')}. ${history[i]}${history[i + 1] ? `   ${history[i + 1]}` : ''}`)
    }
    return rows
  }, [state.game])

  const legalTargetSquares = useMemo(() => new Set(state.legalTargets.map((move) => move.to)), [state.legalTargets])

  useEffect(() => {
    const onMessage = (rawEvent: MessageEvent) => {
      let event
      try {
        event = parsePlatformToAppEvent(rawEvent.data)
      } catch {
        return
      }

      if (event.type === 'INIT_APP') {
        const game = new Chess()
        setState({
          game,
          activeSessionId: event.sessionId,
          error: null,
          selectedSquare: null,
          legalTargets: [],
        })
        postToParent({ type: 'APP_READY', sessionId: event.sessionId })
        postToParent({
          type: 'APP_STATE_UPDATE',
          sessionId: event.sessionId,
          seq: 0,
          stateSummary: summarizeBoard(game),
        })
        return
      }

      setState((current) => {
        if (!current.activeSessionId || event.sessionId !== current.activeSessionId) {
          return current
        }

        if (event.type === 'APP_ERROR') {
          return { ...current, error: event.error }
        }

        if (event.type === 'INVOKE_TOOL') {
          if (event.toolName === 'chess_start') {
            const game = new Chess()
            postToParent({
              type: 'APP_STATE_UPDATE',
              sessionId: event.sessionId,
              seq: event.seq,
              stateSummary: summarizeBoard(game),
            })
            postToParent({
              type: 'APP_RESULT',
              sessionId: event.sessionId,
              seq: event.seq,
              toolName: event.toolName,
              result: {
                accepted: true,
                pgn: game.pgn(),
                fen: game.fen(),
                stateSummary: summarizeBoard(game),
              },
            })
            return { game, activeSessionId: current.activeSessionId, error: null, selectedSquare: null, legalTargets: [] }
          }

          if (event.toolName === 'chess_move') {
            const nextGame = new Chess(current.game.fen())
            try {
              const moveResult = nextGame.move(String(event.params.move || ''), { strict: false })
              postToParent({
                type: 'APP_STATE_UPDATE',
                sessionId: event.sessionId,
                seq: event.seq,
                stateSummary: summarizeBoard(nextGame),
              })
              postToParent({
                type: 'APP_RESULT',
                sessionId: event.sessionId,
                seq: event.seq,
                toolName: event.toolName,
                result: {
                  accepted: true,
                  move: moveResult.san,
                  lan: moveResult.lan,
                  pgn: nextGame.pgn(),
                  fen: nextGame.fen(),
                  stateSummary: summarizeBoard(nextGame),
                },
              })
              if (nextGame.isGameOver()) {
                postToParent({
                  type: 'APP_COMPLETE',
                  sessionId: event.sessionId,
                  result: getCompletionResult(nextGame),
                })
              }
              return { ...current, game: nextGame, error: null, selectedSquare: null, legalTargets: [] }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error)
              postToParent({
                type: 'APP_RESULT',
                sessionId: event.sessionId,
                seq: event.seq,
                toolName: event.toolName,
                result: { error: 'illegal_move', description: message },
              })
              return { ...current, error: message }
            }
          }
        }

        return current
      })
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const applyInteractiveMove = (from: string, to: string) => {
    if (!state.activeSessionId) return false
    const nextGame = new Chess(state.game.fen())
    try {
      nextGame.move({ from, to, promotion: 'q' })
      const seq = Date.now()
      postToParent({
        type: 'APP_STATE_UPDATE',
        sessionId: state.activeSessionId,
        seq,
        stateSummary: summarizeBoard(nextGame),
      })
      if (nextGame.isGameOver()) {
        postToParent({
          type: 'APP_COMPLETE',
          sessionId: state.activeSessionId,
          result: getCompletionResult(nextGame),
        })
      }
      setState((current) => ({
        ...current,
        game: nextGame,
        error: null,
        selectedSquare: null,
        legalTargets: [],
      }))
      return true
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : String(error),
      }))
      return false
    }
  }

  const onSquareClick = (square: string) => {
    if (state.game.isGameOver()) {
      setState((current) => ({ ...current, error: 'The game is over. Start a new game to keep playing.' }))
      return
    }

    const piece = state.game.get(square)
    const pieceIsCurrentTurn = piece && piece.color === state.game.turn()

    if (!state.selectedSquare) {
      if (!pieceIsCurrentTurn) {
        setState((current) => ({ ...current, error: 'Select one of the pieces for the current turn.' }))
        return
      }
      setState((current) => ({
        ...current,
        selectedSquare: square,
        legalTargets: current.game.moves({ square, verbose: true }),
        error: null,
      }))
      return
    }

    if (state.selectedSquare === square) {
      setState((current) => ({ ...current, selectedSquare: null, legalTargets: [], error: null }))
      return
    }

    if (pieceIsCurrentTurn) {
      setState((current) => ({
        ...current,
        selectedSquare: square,
        legalTargets: current.game.moves({ square, verbose: true }),
        error: null,
      }))
      return
    }

    const target = state.legalTargets.find((move) => move.to === square)
    if (!target) {
      setState((current) => ({ ...current, error: 'That is not a legal destination for the selected piece.' }))
      return
    }

    void applyInteractiveMove(state.selectedSquare, square)
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.82),transparent_34%),linear-gradient(180deg,#f6efe3_0%,#ecdfc8_100%)] p-4 text-[#2e2418]">
      <Stack gap="md" maw={980} mx="auto">
        <Group justify="space-between" align="center">
          <div>
            <Text size="10px" tt="uppercase" fw={800} c="#857052" style={{ letterSpacing: '0.22em' }}>
              Interactive App
            </Text>
            <Title order={2}>Chess</Title>
            <Text size="sm" c="#5e4f3b">
              {state.activeSessionId
                ? state.game.isCheckmate()
                  ? `Checkmate. ${state.game.turn() === 'w' ? 'Black' : 'White'} wins.`
                  : state.game.isDraw()
                    ? 'Draw.'
                    : `${turnLabel}${state.game.inCheck() ? ' • check' : ''}`
                : 'Waiting for game…'}
            </Text>
          </div>
          <Badge radius="xl" size="lg" color={state.game.turn() === 'w' ? 'gray' : 'dark'}>
            {state.activeSessionId ? turnLabel : 'Waiting'}
          </Badge>
        </Group>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <Paper radius="xl" p="md" bg="rgba(255,255,255,0.48)" style={{ border: '1px solid rgba(124, 97, 65, 0.16)' }}>
            <div
              id="chatbridge-chessboard"
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto repeat(8, minmax(0, 1fr))',
                gridTemplateRows: 'repeat(8, minmax(0, 1fr)) auto',
                gap: 0,
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: '0 18px 30px rgba(93,61,26,0.16)',
                border: '1px solid rgba(93,61,26,0.18)',
                aspectRatio: '1 / 1',
                userSelect: 'none',
              }}
            >
              {RANKS.map((rank, rankIndex) => (
                <Text
                  key={`rank-${rank}`}
                  size="sm"
                  fw={700}
                  c="#6b5337"
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    background: '#e5d4b9',
                    borderBottom: rankIndex === RANKS.length - 1 ? '1px solid rgba(93,61,26,0.12)' : undefined,
                  }}
                >
                  {rank}
                </Text>
              ))}
              {RANKS.flatMap((rank, rankIndex) =>
                FILES.map((file, fileIndex) => {
                  const square = getSquareName(fileIndex, rankIndex)
                  const glyph = getPieceGlyph(state.game, square)
                  const isDark = (fileIndex + rankIndex) % 2 === 1
                  const isSelected = state.selectedSquare === square
                  const isTarget = legalTargetSquares.has(square)
                  const piece = state.game.get(square)
                  const isCaptureTarget = isTarget && !!piece

                  let background = isDark ? '#9a6231' : '#f1dfb7'
                  if (isSelected) {
                    background = '#6f95f4'
                  } else if (isCaptureTarget) {
                    background = '#d97070'
                  } else if (isTarget) {
                    background = isDark ? '#b07f53' : '#dfe8ff'
                  }

                  return (
                    <button
                      key={square}
                      type="button"
                      aria-label={`square ${square}`}
                      onClick={() => onSquareClick(square)}
                      style={{
                        appearance: 'none',
                        border: 0,
                        margin: 0,
                        padding: 0,
                        background,
                        color: glyph && piece?.color === 'w' ? '#fffaf0' : '#1f1711',
                        cursor: 'pointer',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 'clamp(26px, 3vw, 46px)',
                        lineHeight: 1,
                        textShadow: glyph && piece?.color === 'w' ? '0 1px 1px rgba(0,0,0,0.35)' : '0 1px 0 rgba(255,255,255,0.28)',
                        transition: 'background 120ms ease, transform 120ms ease',
                      }}
                    >
                      <span style={{ transform: glyph ? 'translateY(-2px)' : 'none' }}>{glyph}</span>
                    </button>
                  )
                })
              )}
              <div style={{ background: '#e5d4b9' }} />
              {FILES.map((file) => (
                <Text
                  key={`file-${file}`}
                  size="sm"
                  fw={700}
                  c="#6b5337"
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    background: '#e5d4b9',
                  }}
                >
                  {file}
                </Text>
              ))}
            </div>
          </Paper>
          <Paper radius="xl" p="md" bg="rgba(255,255,255,0.56)" style={{ border: '1px solid rgba(124, 97, 65, 0.12)' }}>
            <Text size="11px" fw={800} tt="uppercase" c="#7f6849" style={{ letterSpacing: '0.18em' }}>
              Moves
            </Text>
            <Text component="pre" fz="12px" lh={1.7} ff="monospace" c="#4d3f2f" mt="sm" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
              {historyRows.length ? historyRows.slice(-10).join('\n') : '1. ...'}
            </Text>
          </Paper>
        </div>

        <Paper radius="lg" p="md" bg="rgba(255,255,255,0.72)">
          <Text size="sm">Click or drag pieces to move. Typed moves like `e4`, `Nf3`, or `e2e4` still work from chat.</Text>
        </Paper>

        <Text size="xs" c="#5e4f3b">
          FEN: {state.game.fen()}
        </Text>

        {state.error && (
          <Alert color="red" title="Move rejected">
            {state.error}
          </Alert>
        )}
      </Stack>
    </div>
  )
}
