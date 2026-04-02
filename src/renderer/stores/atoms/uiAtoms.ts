import { atom, getDefaultStore } from 'jotai'
import { atomFamily, atomWithStorage } from 'jotai/utils'
import type React from 'react'
import type { RefObject } from 'react'
import type { VirtuosoHandle } from 'react-virtuoso'
import type {
  ActiveAppSessionRef,
  PluginBackendState,
  PluginFrameEntry,
  PluginRegistryState,
} from '../../../plugin-runtime/atoms'
import { fetchRegistry } from '../../../plugin-runtime/registry'
import platform from '@/platform'
import type { KnowledgeBase, MessagePicture, Toast } from '../../../shared/types'
import type { PreConstructedMessageState } from '../../types/input-box'

// Input box related state
const defaultPreConstructedMessageState = (): PreConstructedMessageState => ({
  text: '',
  pictureKeys: [],
  attachments: [],
  links: [],
  preprocessedFiles: [],
  preprocessedLinks: [],
  preprocessingStatus: {
    files: {},
    links: {},
  },
  preprocessingPromises: {
    files: new Map<string, Promise<unknown>>(),
    links: new Map<string, Promise<unknown>>(),
  },
})

export const inputBoxLinksFamily = atomFamily((_sessionId: string) => atom<{ url: string }[]>([]))
export const inputBoxPreConstructedMessageFamily = atomFamily((_sessionId: string) =>
  atom(defaultPreConstructedMessageState())
)

// Atom to store collapsed state of providers
export const collapsedProvidersAtom = atomWithStorage<Record<string, boolean>>('collapsedProviders', {})

export const activeAppSessionAtom = atom<ActiveAppSessionRef | null>(null)

export const pluginRegistryStatusAtom = atom<PluginBackendState>({
  status: 'idle',
})

export const pluginRegistryAtom = atom<PluginRegistryState>([])

const pluginRegistryLoader = async (setAtom: (apps: PluginRegistryState) => void, cancelled: () => boolean) => {
  const store = getDefaultStore()
  store.set(pluginRegistryStatusAtom, { status: 'loading' })
  const result = await fetchRegistry()
  if (cancelled()) {
    return
  }
  setAtom(result.apps)
  store.set(pluginRegistryStatusAtom, {
    status: result.status,
    error: result.error,
    loadedAt: Date.now(),
  })
}

pluginRegistryAtom.onMount = (setAtom) => {
  let isCancelled = false

  void pluginRegistryLoader(setAtom, () => isCancelled)

  return () => {
    isCancelled = true
  }
}

export const pluginFramesAtom = atom<Record<string, PluginFrameEntry>>({})

export const refreshPluginRegistryAtom = atom(null, async (_get, set) => {
  await pluginRegistryLoader((apps) => set(pluginRegistryAtom, apps), () => false)
})
