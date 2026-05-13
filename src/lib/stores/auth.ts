import { writable, type Readable } from 'svelte/store';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  role: 'user' | 'admin';
}

const store = writable<AuthUser | null>(null);
export const auth: Readable<AuthUser | null> = { subscribe: store.subscribe };

export function setAuthUser(user: AuthUser | null): void {
  store.set(user);
}

export async function refreshAuth(fetchFn: typeof fetch = fetch): Promise<void> {
  try {
    const res = await fetchFn('/api/me', { credentials: 'same-origin' });
    if (!res.ok) return setAuthUser(null);
    const data = (await res.json()) as { user: AuthUser | null };
    setAuthUser(data.user);
  } catch {
    setAuthUser(null);
  }
}

export async function logout(fetchFn: typeof fetch = fetch): Promise<void> {
  await fetchFn('/auth/logout', { method: 'POST', credentials: 'same-origin' });
  setAuthUser(null);
}
