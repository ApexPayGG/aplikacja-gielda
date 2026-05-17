import type { ErrorInfo, ReactNode } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import { trackEvent } from "../utils/analytics";

type PageErrorBoundaryProps = {
  page: string;
  children: ReactNode;
  enableTracking?: boolean;
};

export function PageErrorBoundary({ page, children, enableTracking = true }: PageErrorBoundaryProps) {
  const handleError = (error: Error, _errorInfo: ErrorInfo) => {
    console.error(`[PageErrorBoundary] ${page}`, error);

    if (enableTracking) {
      trackEvent("error", { page, message: error.message });
    }
  };

  return <ErrorBoundary onError={handleError}>{children}</ErrorBoundary>;
}
