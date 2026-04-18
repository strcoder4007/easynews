const API_KEY_STORAGE_KEY = 'news-center-api-key'

function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function getStoredApiKey(): string | null {
  if (!isBrowserEnvironment()) return null
  try {
    const value = window.localStorage.getItem(API_KEY_STORAGE_KEY)
    const trimmed = value?.trim() ?? ''
    return trimmed.length ? trimmed : null
  } catch (error) {
    console.warn('Unable to read API key from localStorage.', error)
    return null
  }
}

export function saveApiKey(value: string): void {
  if (!isBrowserEnvironment()) return
  try {
    window.localStorage.setItem(API_KEY_STORAGE_KEY, value.trim())
  } catch (error) {
    console.warn('Unable to save API key to localStorage.', error)
  }
}

export function removeStoredApiKey(): void {
  if (!isBrowserEnvironment()) return
  try {
    window.localStorage.removeItem(API_KEY_STORAGE_KEY)
  } catch (error) {
    console.warn('Unable to remove API key from localStorage.', error)
  }
}

export function hasStoredApiKey(): boolean {
  return Boolean(getStoredApiKey())
}

export { API_KEY_STORAGE_KEY }
