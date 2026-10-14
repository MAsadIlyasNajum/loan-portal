export function useAsync<T>(): {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  return {
    data: null,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  };
}