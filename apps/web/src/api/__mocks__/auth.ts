export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface RegisterRequest {
  readonly email: string;
  readonly password: string;
}

export async function register(): Promise<never> {
  throw new Error('API not mocked');
}

export async function login(): Promise<never> {
  throw new Error('API not mocked');
}

export function authenticatedClient() {
  return {
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
}