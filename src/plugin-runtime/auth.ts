let pluginAuthToken: string | null = null

export function getPluginAuthToken() {
  return pluginAuthToken
}

export function setPluginAuthToken(token: string | null) {
  pluginAuthToken = token
}
