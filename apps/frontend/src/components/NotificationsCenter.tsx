import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ComponentType } from "react";
import {
  AcademicCapIcon,
  BellAlertIcon,
  BellIcon,
  ChartBarSquareIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getNotificationsApi,
  markAllNotificationsReadApi,
  markNotificationReadApi,
  type NotificationItem,
  type NotificationType,
} from "../services/api";
import { colors } from "../styles/designSystem";

type IconProps = ComponentProps<"svg">;
type NotificationIcon = ComponentType<IconProps>;

function formatRelativeTime(value: string): string {
  const nowMs = Date.now();
  const createdAtMs = new Date(value).getTime();
  if (!Number.isFinite(createdAtMs)) return "";
  const diffSec = Math.max(0, Math.floor((nowMs - createdAtMs) / 1000));
  if (diffSec < 60) return "przed chwilą";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min temu`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} godz temu`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} d temu`;
}

function typeColor(type: NotificationType): string {
  if (type === "SIGNAL") return colors.brandCyan;
  if (type === "DIVIDEND") return colors.brandGold;
  if (type === "COACH") return colors.brandMedium;
  return colors.textMuted;
}

function typeIcon(type: NotificationType): NotificationIcon {
  if (type === "SIGNAL") return ChartBarSquareIcon;
  if (type === "DIVIDEND") return CurrencyDollarIcon;
  if (type === "COACH") return AcademicCapIcon;
  return BellAlertIcon;
}

export function NotificationsCenter() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const data = await getNotificationsApi(user.id, 20);
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(Number(data.unreadCount) || 0);
    } catch {
      // Keep previous state when polling fails.
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setItems([]);
      setUnreadCount(0);
      return;
    }

    let cancelled = false;
    const load = async () => {
      if (cancelled) return;
      await refresh();
    };
    void load();

    const pollId = window.setInterval(() => {
      void refresh();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [refresh, user?.id]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const hasUnread = unreadCount > 0;
  const displayCount = useMemo(() => (unreadCount > 99 ? "99+" : String(unreadCount)), [unreadCount]);

  const handleMarkAllRead = async () => {
    if (!user?.id || unreadCount <= 0) return;
    await markAllNotificationsReadApi(user.id);
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
  };

  const handleOpenNotification = async (notification: NotificationItem) => {
    if (!notification.read) {
      try {
        await markNotificationReadApi(notification.id);
        setItems((prev) =>
          prev.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Best effort: still allow navigation.
      }
    }

    if (notification.link?.trim()) {
      navigate(notification.link);
      setOpen(false);
    }
  };

  if (!user) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border transition hover:border-brandDark/35"
        aria-label="Powiadomienia"
        aria-expanded={open}
      >
        <BellIcon className="h-5 w-5" style={{ color: colors.brandDark }} aria-hidden />
        {hasUnread ? (
          <span
            className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none"
            style={{ backgroundColor: colors.negative, color: colors.bgPrimary }}
          >
            {displayCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[24rem] max-w-[90vw] rounded-xl border border-border bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold" style={{ color: colors.brandDark }}>
              Powiadomienia
            </h3>
            <button
              type="button"
              onClick={() => void handleMarkAllRead()}
              disabled={!hasUnread || isLoading}
              className="text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{ color: colors.brandMedium }}
            >
              Oznacz wszystkie jako przeczytane
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm" style={{ color: colors.textMuted }}>
                Brak powiadomień
              </div>
            ) : (
              items.map((notification) => {
                const Icon = typeIcon(notification.type);
                const iconColor = typeColor(notification.type);
                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => void handleOpenNotification(notification)}
                    className="w-full border-b border-border px-4 py-3 text-left transition last:border-b-0 hover:bg-bgSecondary/70"
                    style={{ backgroundColor: notification.read ? colors.bgPrimary : colors.bgSecondary }}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: iconColor }} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-sm"
                          style={{
                            color: colors.textPrimary,
                            fontWeight: notification.read ? 500 : 700,
                          }}
                        >
                          {notification.title}
                        </p>
                        <p className="mt-1 text-xs" style={{ color: colors.textSecondary }}>
                          {notification.message}
                        </p>
                        <p className="mt-1 text-[11px]" style={{ color: colors.textMuted }}>
                          {formatRelativeTime(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
