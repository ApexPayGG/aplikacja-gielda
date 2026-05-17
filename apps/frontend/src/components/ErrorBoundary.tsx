import type { ErrorInfo, ReactNode } from "react";
import React from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import { colors } from "../styles/designSystem";

type ErrorBoundaryProps = {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  public render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isDevMode = import.meta.env.DEV;

    return (
      <div
        className="flex min-h-screen items-center justify-center px-4 py-16"
        style={{
          backgroundColor: colors.bgSecondary,
          backgroundImage: `radial-gradient(circle at top, ${colors.brandDark}14 0%, ${colors.bgSecondary} 60%)`,
        }}
      >
        <div
          className="w-full max-w-xl rounded-3xl border p-8 shadow-[0_20px_60px_rgba(13,13,26,0.12)]"
          style={{
            borderColor: colors.border,
            backgroundColor: colors.bgPrimary,
          }}
        >
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${colors.brandGold}26` }}
          >
            <ExclamationTriangleIcon className="h-8 w-8" style={{ color: colors.brandGold }} />
          </div>

          <h1 className="mt-6 text-center text-3xl font-bold" style={{ color: colors.textPrimary }}>
            Coś poszło nie tak
          </h1>
          <p className="mt-3 text-center text-sm leading-6" style={{ color: colors.textSecondary }}>
            Wystąpił nieoczekiwany błąd. Spróbuj odświeżyć stronę albo wróć do strony głównej.
          </p>

          {isDevMode && this.state.error ? (
            <pre
              className="mt-6 max-h-64 overflow-auto rounded-xl border p-4 text-left text-xs"
              style={{
                borderColor: colors.borderStrong,
                backgroundColor: colors.bgTertiary,
                color: colors.textSecondary,
              }}
            >
              {this.state.error.message}
              {this.state.errorInfo?.componentStack ? `\n\n${this.state.errorInfo.componentStack}` : ""}
            </pre>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
              style={{ backgroundColor: colors.brandDark }}
            >
              Odśwież stronę
            </button>
            <button
              type="button"
              onClick={() => window.location.assign("/")}
              className="rounded-xl border px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
              style={{
                borderColor: colors.borderStrong,
                color: colors.textPrimary,
                backgroundColor: colors.bgPrimary,
              }}
            >
              Wróć do strony głównej
            </button>
          </div>
        </div>
      </div>
    );
  }
}
