// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppFrame from './AppFrame'

const sendToApp = vi.fn()
const registerAppListener = vi.fn(() => () => {})
const markAppFrameStatus = vi.fn()
const registerAppFrame = vi.fn()

vi.mock('./eventBus', () => ({
  registerAppListener: (...args: unknown[]) => registerAppListener(...args),
  sendToApp: (...args: unknown[]) => sendToApp(...args),
}))

vi.mock('./runtime', () => ({
  markAppFrameStatus: (...args: unknown[]) => markAppFrameStatus(...args),
  registerAppFrame: (...args: unknown[]) => registerAppFrame(...args),
}))

describe('AppFrame', () => {
  afterEach(() => {
    sendToApp.mockReset()
    registerAppListener.mockClear()
    markAppFrameStatus.mockClear()
    registerAppFrame.mockClear()
  })

  it('does not resend INIT_APP on a plain rerender for GitHub frames', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    const props = {
      appId: 'github-v1',
      sessionId: 'session-1',
      src: 'about:blank',
      srcDoc: '<!DOCTYPE html><html><body></body></html>',
      origin: 'null',
      initConfig: {
        backendUrl: 'https://backend.example.com',
        authToken: 'token',
      },
    }

    const view = render(
      <MantineProvider>
        <AppFrame {...props} />
      </MantineProvider>
    )
    const iframe = view.container.querySelector('iframe')
    expect(iframe).toBeTruthy()

    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: window,
    })

    fireEvent.load(iframe as HTMLIFrameElement)
    expect(sendToApp).toHaveBeenCalledTimes(1)

    view.rerender(
      <MantineProvider>
        <AppFrame {...props} />
      </MantineProvider>
    )
    expect(sendToApp).toHaveBeenCalledTimes(1)
  })
})
