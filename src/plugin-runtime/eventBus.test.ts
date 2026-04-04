// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { __resetEventBusForTests, registerAppListener } from './eventBus'

describe('plugin event bus', () => {
  afterEach(() => {
    __resetEventBusForTests()
    vi.restoreAllMocks()
  })

  it('delivers validated app events to the matching session listener', () => {
    const handler = vi.fn()
    const dispose = registerAppListener('session-1', handler)

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'APP_READY',
          sessionId: 'session-1',
        },
      })
    )

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({
      type: 'APP_READY',
      sessionId: 'session-1',
    })

    dispose()
  })

  it('discards malformed app events without invoking listeners', () => {
    const handler = vi.fn()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    registerAppListener('session-1', handler)

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'BROKEN_EVENT',
          sessionId: 'session-1',
        },
      })
    )

    expect(handler).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('accepts sandboxed iframe events with origin null even when the source window proxy differs', () => {
    const handler = vi.fn()
    registerAppListener('session-1', handler, { sourceWindow: window })

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'APP_READY',
          sessionId: 'session-1',
        },
        origin: 'null',
        source: {} as MessageEventSource,
      })
    )

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({
      type: 'APP_READY',
      sessionId: 'session-1',
    })
  })
})
