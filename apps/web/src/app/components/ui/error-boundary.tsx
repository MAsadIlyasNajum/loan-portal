import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
  type ReactElement,
} from 'react';
import { Button } from './button';

export interface ErrorMessageProps {
  readonly message: string;
  readonly className?: string;
}

export function ErrorMessage({
  message,
  className,
}: ErrorMessageProps): ReactElement {
  return (
    <div
      className={`alert alert-error ${className ?? ''}`.trim()}
      role="alert"
    >
      {message}
    </div>
  );
}

export interface ErrorBoundaryProps {
  readonly fallback:
    | ReactNode
    | ((error: Error, reset: () => void) => ReactNode);
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null };

  override componentDidCatch(error: Error, _info: ErrorInfo): void {
    this.setState({ error });
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (error) {
      const { fallback } = this.props;
      if (typeof fallback === 'function') {
        return <>{fallback(error, this.reset)}</>;
      }
      return <>{fallback}</>;
    }
    return this.props.children;
  }
}

export function DefaultErrorFallback({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}): ReactElement {
  return (
    <div className="center">
      <ErrorMessage message={error.message} />
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}

export type { ComponentType };
