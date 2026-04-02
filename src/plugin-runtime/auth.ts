import storage from '../renderer/storage'

const PLUGIN_AUTH_TOKEN_STORAGE_KEY = 'chatbridge-auth-token'

let pluginAuthToken: string | null = null
let authInitPromise: Promise<string | null> | null = null

export function getPluginAuthToken() {
  return pluginAuthToken
}

export function setPluginAuthToken(token: string | null) {
  pluginAuthToken = token
}

export async function initializePluginAuth() {
  if (!authInitPromise) {
    authInitPromise = storage
      .getItem<string | null>(PLUGIN_AUTH_TOKEN_STORAGE_KEY, null)
      .then((token) => {
        pluginAuthToken = token
        return token
      })
  }

  return authInitPromise
}

export async function persistPluginAuthToken(token: string | null) {
  pluginAuthToken = token
  authInitPromise = Promise.resolve(token)
  await storage.setItemNow(PLUGIN_AUTH_TOKEN_STORAGE_KEY, token)
}

export async function clearPluginAuthToken() {
  pluginAuthToken = null
  authInitPromise = Promise.resolve(null)
  await storage.removeItem(PLUGIN_AUTH_TOKEN_STORAGE_KEY)
}
