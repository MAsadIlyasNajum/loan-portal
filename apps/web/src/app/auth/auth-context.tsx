import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type ReactElement,
} from 'react';
import { login as apiLogin, register as apiRegister } from '../../api/auth';
import { authStorage, onUnauthorized, type AuthenticatedUser } from '../../api';
import type { LoginResult } from '../../api/types';

export interface AuthState {
  readonly user: AuthenticatedUser | null;
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
}

export interface AuthContextValue extends AuthState {
  readonly login: (
    email: string,
    password: string,
  ) => Promise<LoginResult>;
  readonly register: (
    email: string,
    password: string,
  ) => Promise<AuthenticatedUser>;
  readonly logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
}

export interface AuthProviderProps {
  readonly children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): ReactElement {
  const [state, setState] = useState<AuthState>(() => ({
    user: authStorage.getUser(),
    isAuthenticated: authStorage.isAuthenticated(),
    isLoading: false,
  }));

  useEffect(() => {
    const unregister = onUnauthorized(() => {
      authStorage.clearSession();
    });
    return () => {
      unregister();
    };
  }, []);

  useEffect(() => {
    const update = () => {
      setState({
        user: authStorage.getUser(),
        isAuthenticated: authStorage.isAuthenticated(),
        isLoading: false,
      });
    };
    return authStorage.subscribe(update);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const result = await apiLogin({ email, password });
        authStorage.setSession(result.accessToken, result.user);
        setState({
          user: result.user,
          isAuthenticated: true,
          isLoading: false,
        });
        return result;
      } catch (error) {
        setState((s) => ({ ...s, isLoading: false }));
        throw error;
      }
    },
    [],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const result = await apiRegister({ email, password });
        setState((s) => ({ ...s, isLoading: false }));
        return result;
      } catch (error) {
        setState((s) => ({ ...s, isLoading: false }));
        throw error;
      }
    },
    [],
  );

  const logout = useCallback(() => {
    authStorage.clearSession();
    setState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  const value: AuthContextValue = {
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
