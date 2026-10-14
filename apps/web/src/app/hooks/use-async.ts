import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  readonly data: T | null;
  readonly isLoading: boolean;
  readonly error: Error | null;
}

export interface AsyncHandle<T> extends AsyncState<T> {
  readonly refetch: () => Promise<T | undefined>;
  readonly retry: () => Promise<T | undefined>;
}

export function useAsync<T>(
  asyncFn: () => Promise<T>,
  options?: { readonly immediate?: boolean },
): AsyncHandle<T> {
  const { immediate = true } = options ?? {};
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    isLoading: immediate,
    error: null,
  });

  const activeRef = useRef(true);

  const run = useCallback(
    async function run(): Promise<T | undefined> {
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const data = await asyncFn();
        if (activeRef.current) {
          setState({ data, isLoading: false, error: null });
        }
        return data;
      } catch (error: unknown) {
        if (activeRef.current) {
          setState({
            data: null,
            isLoading: false,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
        return undefined;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [asyncFn],
  );

  useEffect(() => {
    activeRef.current = true;
    if (immediate) {
      void run();
    }
    return () => {
      activeRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refetch = useCallback(() => run(), [run]);
  const retry = refetch;

  return {
    data: state.data,
    isLoading: state.isLoading,
    error: state.error,
    refetch,
    retry,
  };
}
