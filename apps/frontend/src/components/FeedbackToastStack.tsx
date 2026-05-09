type FeedbackTone = "success" | "error" | "info";

export type FeedbackToast = {
  id: string;
  tone: FeedbackTone;
  title: string;
  message?: string;
};

export function FeedbackToastStack(props: { toasts: FeedbackToast[] }) {
  if (props.toasts.length === 0) return null;

  return (
    <div className="feedback-layer" aria-live="polite" aria-atomic="true">
      {props.toasts.map((toast) => (
        <article
          key={toast.id}
          className={`feedback-toast ${
            toast.tone === "success"
              ? "feedback-toast-success"
              : toast.tone === "error"
                ? "feedback-toast-error"
                : "feedback-toast-info"
          }`}
        >
          <div
            className={`text-sm font-semibold ${
              toast.tone === "success" ? "text-brand-green" : toast.tone === "error" ? "text-brand-red" : "text-brand-blue"
            }`}
          >
            {toast.title}
          </div>
          {toast.message && <div className="mt-1 text-xs text-slate-300">{toast.message}</div>}
        </article>
      ))}
    </div>
  );
}

