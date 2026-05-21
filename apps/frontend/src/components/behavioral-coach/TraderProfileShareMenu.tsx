import {
  CheckIcon,
  ChevronDownIcon,
  ClipboardDocumentIcon,
  LinkIcon,
  ShareIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PsycheRadarPoint } from "../../utils/behavioralCoachData";
import { buildTraderProfileSharePayloads } from "../../utils/traderProfileShare";

type Props = {
  metrics: PsycheRadarPoint[];
  disabled?: boolean;
};

type ShareChannel = "linkedin" | "twitter" | "facebook" | "threads" | "copy";

type ShareOption = {
  id: ShareChannel;
  label: string;
  sublabel: string;
  accent: string;
};

const SHARE_OPTIONS: ShareOption[] = [
  { id: "linkedin", label: "LinkedIn", sublabel: "Professional post + link", accent: "bg-[#0A66C2]/20 text-[#6CB6FF]" },
  { id: "twitter", label: "X (Twitter)", sublabel: "Tweet intent with hashtags", accent: "bg-white/10 text-white" },
  { id: "facebook", label: "Facebook", sublabel: "Share + text to clipboard", accent: "bg-[#1877F2]/20 text-[#7CB8FF]" },
  { id: "threads", label: "Threads", sublabel: "Same payload as X", accent: "bg-white/10 text-white/90" },
  { id: "copy", label: "Copy link", sublabel: "Discord · Telegram · WhatsApp", accent: "bg-[#22d3ee]/15 text-[#22d3ee]" },
];

function openShareWindow(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer,width=640,height=720");
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function TraderProfileShareMenu({ metrics, disabled }: Props) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [copiedChannel, setCopiedChannel] = useState<ShareChannel | null>(null);

  const payloads = useMemo(() => buildTraderProfileSharePayloads(metrics), [metrics]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = (message: string, channel?: ShareChannel) => {
    setToast(message);
    if (channel) setCopiedChannel(channel);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      setCopiedChannel(null);
    }, 4200);
  };

  const handleShare = async (channel: ShareChannel) => {
    if (disabled) return;

    if (channel === "twitter") {
      openShareWindow(payloads.twitterIntentUrl);
      setOpen(false);
      return;
    }

    if (channel === "threads") {
      openShareWindow(payloads.threadsIntentUrl);
      setOpen(false);
      return;
    }

    if (channel === "linkedin") {
      const ok = await writeClipboard(payloads.linkedInPost);
      openShareWindow(payloads.linkedInIntentUrl);
      showToast(
        ok
          ? t("coach.share.toastLinkedInCopied", {
              defaultValue: "LinkedIn post text copied! Paste it (Ctrl+V) in the share window.",
            })
          : t("coach.share.toastLinkedInManual", {
              defaultValue: "LinkedIn opened — copy the post text manually from the Coach page.",
            }),
        "linkedin",
      );
      setOpen(false);
      return;
    }

    if (channel === "facebook") {
      const ok = await writeClipboard(payloads.facebookPost);
      openShareWindow(payloads.facebookIntentUrl);
      showToast(
        ok
          ? t("coach.share.toastFacebookCopied", {
              defaultValue: "Post text copied! Paste it (Ctrl+V) after Facebook opens.",
            })
          : t("coach.share.toastFacebookManual", {
              defaultValue: "Facebook opened — paste the copied text manually (Ctrl+V).",
            }),
        "facebook",
      );
      setOpen(false);
      return;
    }

    const ok = await writeClipboard(payloads.universalClipboard);
    showToast(
      ok
        ? t("coach.share.toastCopied", {
            defaultValue: "Copied to clipboard! Share with friends on Discord or Telegram.",
          })
        : t("coach.share.toastCopyFailed", {
            defaultValue: "Copy failed — check your browser clipboard permissions.",
          }),
      "copy",
    );
    setOpen(false);
  };

  return (
    <div className="relative mt-4" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#22d3ee]/35 bg-gradient-to-r from-[#a855f7]/40 to-[#22d3ee]/20 px-4 py-3.5 text-sm font-semibold text-white shadow-[0_0_24px_rgba(34,211,238,0.12)] backdrop-blur-md transition hover:border-[#22d3ee]/55 hover:shadow-[0_0_28px_rgba(34,211,238,0.2)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        <ShareIcon className="h-5 w-5 text-[#22d3ee]" aria-hidden />
        {t("coach.share.profileCta", { defaultValue: "Share profile" })}
        <ChevronDownIcon className={`h-4 w-4 text-white/70 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-20 bg-black/40 md:hidden"
            aria-label={t("coach.share.closeMenu", { defaultValue: "Close share menu" })}
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="fixed inset-x-3 bottom-3 z-30 max-h-[min(70vh,28rem)] overflow-y-auto rounded-2xl border border-white/10 bg-[#0f111c]/98 shadow-[0_16px_48px_rgba(168,85,247,0.55)] backdrop-blur-md md:absolute md:inset-x-auto md:bottom-auto md:left-0 md:right-auto md:top-full md:mt-2 md:max-h-none md:min-w-[20rem]"
          >
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#22d3ee]">
              {t("coach.share.centerTitle", { defaultValue: "Share center" })}
            </p>
            <p className="mt-0.5 text-xs text-white/55">
              {t("coach.share.scoresLine", {
                discipline: payloads.disciplineScore,
                fomo: payloads.fomoScore,
                defaultValue: "Discipline {{discipline}}% · FOMO {{fomo}}%",
              })}
            </p>
          </div>
          <ul className="p-2">
            {SHARE_OPTIONS.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleShare(option.id)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-white/5"
                >
                  <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${option.accent}`}>
                    {option.id === "copy" ? <LinkIcon className="h-4 w-4" /> : option.label.slice(0, 2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white">
                      {t(`coach.share.channels.${option.id}.label`, { defaultValue: option.label })}
                    </span>
                    <span className="block text-[11px] text-white/45">
                      {t(`coach.share.channels.${option.id}.sublabel`, { defaultValue: option.sublabel })}
                    </span>
                  </span>
                  {copiedChannel === option.id ? (
                    <CheckIcon className="h-4 w-4 shrink-0 text-[#22d3ee]" aria-hidden />
                  ) : option.id === "copy" ? (
                    <ClipboardDocumentIcon className="h-4 w-4 shrink-0 text-white/35" aria-hidden />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
        </>
      ) : null}

      {toast ? (
        <div
          role="status"
          className="absolute left-0 right-0 top-full z-40 mt-2 rounded-xl border border-[#22d3ee]/30 bg-[#1e1b4b]/95 px-4 py-3 text-sm text-white shadow-lg backdrop-blur-md"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
