import '@testing-library/jest-dom';

Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      env: {
        VITE_API_URL: '/api',
        VITE_POLL_INTERVAL_MS: '10000',
      },
    },
  },
  writable: true,
});