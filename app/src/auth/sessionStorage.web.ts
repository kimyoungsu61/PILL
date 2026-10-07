export type SecureStoreOptions = { keychainAccessible?: string };
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 'web-session';

export async function getItemAsync(key: string): Promise<string | null> {
  return window.sessionStorage.getItem(key);
}

export async function setItemAsync(key: string, value: string, _options?: SecureStoreOptions): Promise<void> {
  window.sessionStorage.setItem(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  window.sessionStorage.removeItem(key);
}
