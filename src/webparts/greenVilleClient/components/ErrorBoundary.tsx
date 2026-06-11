import * as React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  errorMessage?: string;
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = {};

  public static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      errorMessage: ErrorBoundary.getErrorMessage(error)
    };
  }

  public componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('GreenVille Client web part render error:', error, info);
  }

  public render(): React.ReactNode {
    if (this.state.errorMessage) {
      return (
        <div role="alert" style={{ padding: 16, color: '#a4262c' }}>
          <strong>GreenVille Client failed to load.</strong>
          <div>{this.state.errorMessage}</div>
        </div>
      );
    }

    return this.props.children;
  }

  private static getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown error';
    }
  }
}
