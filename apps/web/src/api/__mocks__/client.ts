export const authStorage = {
  getAccessToken: jest.fn(() => null),
  getUser: jest.fn(() => null),
  getRole: jest.fn(() => null),
  isAuthenticated: jest.fn(() => false),
  setSession: jest.fn(),
  clearSession: jest.fn(),
  subscribe: jest.fn(() => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return () => {};
  }),
};

export const onUnauthorized = jest.fn(() => {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  return () => {};
});

export const apiClient = {
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
};

export function request() {
  return Promise.reject(new Error('API not mocked'));
}

export const API_BASE_URL = '/api';