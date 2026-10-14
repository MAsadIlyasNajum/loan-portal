import type { AuthenticatedUser } from './types';

type Listener = () => void;

let accessToken: string | null = null;
let user: AuthenticatedUser | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export const authStorage = {
  getAccessToken(): string | null {
    return accessToken;
  },
  getUser(): AuthenticatedUser | null {
    return user;
  },
  getRole(): AuthenticatedUser['role'] | null {
    return user?.role ?? null;
  },
  isAuthenticated(): boolean {
    return accessToken !== null;
  },
  setSession(token: string, authenticatedUser: AuthenticatedUser): void {
    accessToken = token;
    user = authenticatedUser;
    emit();
  },
  clearSession(): void {
    accessToken = null;
    user = null;
    emit();
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};