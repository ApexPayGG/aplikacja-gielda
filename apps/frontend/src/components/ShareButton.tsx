import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ClipboardDocumentIcon,
  LinkIcon,
  PaperAirplaneIcon,
  ShareIcon,
  ChatBubbleOvalLeftEllipsisIcon,
} from "@heroicons/react/24/outline";
import { colors } from "../styles/designSystem";

type ShareButtonProps = {
  url: string;
  twitterText?: string;
  className?: string;
  label?: string;
};

type ShareAction = {
  key: "twitter" | "linkedin" | "copy" | "whatsapp";
  label: string;
  icon: JSX.Element;
  run: () => void | Promise<void>;
};

function openShareWindow(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function ShareButton({ url, twitterText, className, label }: ShareButtonProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEsc(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEsc);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const encodedTwitterText = encodeURIComponent(twitterText ?? "");
  const encodedUrl = encodeURIComponent(url);
  const encodedWhatsappText = encodeURIComponent(twitterText ? `${twitterText} ${url}` : url);

  const actions: ShareAction[] = [
    {
      key: "twitter",
      label: t("share.twitter", { defaultValue: "Twitter/X" }),
      icon: <PaperAirplaneIcon className="h-4 w-4" aria-hidden="true" />,
      run: () => {
        const link = `https://twitter.com/intent/tweet?text=${encodedTwitterText}&url=${encodedUrl}`;
        openShareWindow(link);
      },
    },
    {
      key: "linkedin",
      label: t("share.linkedin", { defaultValue: "LinkedIn" }),
      icon: <LinkIcon className="h-4 w-4" aria-hidden="true" />,
      run: () => {
        const link = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
        openShareWindow(link);
      },
    },
    {
      key: "copy",
      label: copied ? t("share.copied", { defaultValue: "Skopiowano!" }) : t("share.copy", { defaultValue: "Kopiuj link" }),
      icon: <ClipboardDocumentIcon className="h-4 w-4" aria-hidden="true" />,
      run: async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        if (copyTimeoutRef.current) {
          window.clearTimeout(copyTimeoutRef.current);
        }
        copyTimeoutRef.current = window.setTimeout(() => {
          setCopied(false);
        }, 2000);
      },
    },
    {
      key: "whatsapp",
      label: t("share.whatsapp", { defaultValue: "WhatsApp" }),
      icon: <ChatBubbleOvalLeftEllipsisIcon className="h-4 w-4" aria-hidden="true" />,
      run: () => {
        const link = `https://wa.me/?text=${encodedWhatsappText}`;
        openShareWindow(link);
      },
    },
  ];

  return (
    <div ref={containerRef} className={`relative inline-flex ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition hover:brightness-95"
        style={{
          borderColor: colors.border,
          backgroundColor: colors.bgPrimary,
          color: colors.brandDark,
          boxShadow: "0 8px 20px rgba(13, 13, 26, 0.08)",
        }}
      >
        <ShareIcon className="h-4 w-4" aria-hidden="true" />
        <span>{label ?? t("share.button", { defaultValue: "Udostępnij" })}</span>
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-30 mt-2 min-w-48 rounded-xl border p-2"
          style={{
            backgroundColor: colors.bgPrimary,
            borderColor: colors.border,
            boxShadow: "0 12px 30px rgba(13, 13, 26, 0.16)",
          }}
        >
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => {
                void action.run();
                if (action.key !== "copy") {
                  setOpen(false);
                }
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:brightness-95"
              style={{ color: colors.textPrimary, backgroundColor: "transparent" }}
            >
              <span style={{ color: colors.brandDark }}>{action.icon}</span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
