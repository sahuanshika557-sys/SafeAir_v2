import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  sectionTitle: string;
  bodyText?: string;
  retryLabel?: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Isolates rendering errors within major sections so the rest of the app stays usable.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
  };

  /**
   * Transitions boundary state into fallback display when a child throws during render.
   *
   * @returns Updated error boundary state flag.
   */
  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  /**
   * Lifecycle hook intentionally kept free of sensitive user-data logging.
   */
  public override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Avoid logging sensitive user data in error boundaries.
  }

  private handleReset = (): void => {
    this.setState({ hasError: false });
  };

  /**
   * Renders children normally or a localized accessible retry panel when an error occurred.
   *
   * @returns Rendered section subtree or fallback alert UI.
   */
  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <section
          role="alert"
          className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/50 p-6 text-red-900 dark:text-red-100"
        >
          <h2 className="text-lg font-semibold">{this.props.sectionTitle}</h2>
          <p className="mt-2 text-sm">
            {this.props.bodyText ??
              'Something went wrong while displaying this section. Please reload this panel.'}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-red-800 px-4 py-2 text-sm font-medium text-white hover:bg-red-900 transition-colors"
          >
            {this.props.retryLabel ?? 'Try Again'}
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}
