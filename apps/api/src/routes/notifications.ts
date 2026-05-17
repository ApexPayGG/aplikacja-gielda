import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { getAuthenticatedUserId, requireAuth } from "../modules/auth/authMiddleware";
import {
  getNotificationPreferences,
  getUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  sendSignalTestNotification,
  type MarkAllNotificationsReadResponse,
  type NotificationCenterItem,
  updateNotificationPreferences,
  type NotificationDeliveryResult,
  type NotificationsListResponse,
  type NotificationPreferencesUpdateInput,
  type UserNotificationPreferences,
} from "../modules/notifications/notificationsModule";

type NotificationsRouteDeps = {
  getPreferencesFn: typeof getNotificationPreferences;
  updatePreferencesFn: typeof updateNotificationPreferences;
  sendTestNotificationFn: typeof sendSignalTestNotification;
  listNotificationsFn: typeof getUserNotifications;
  markAllAsReadFn: typeof markAllNotificationsAsRead;
  markNotificationAsReadFn: typeof markNotificationAsRead;
};

function mapErrorToStatus(error: unknown): number {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("Missing userId")) return 400;
  if (msg.includes("Missing notificationId")) return 400;
  if (msg.includes("Invalid Discord webhook URL")) return 400;
  if (msg.includes("Invalid notifications limit")) return 400;
  if (msg.includes("User not found")) return 404;
  if (msg.includes("Notification not found")) return 404;
  return 500;
}

function mapErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createNotificationsRouter(depsInput?: Partial<NotificationsRouteDeps>): Router {
  const deps: NotificationsRouteDeps = {
    getPreferencesFn: depsInput?.getPreferencesFn ?? getNotificationPreferences,
    updatePreferencesFn: depsInput?.updatePreferencesFn ?? updateNotificationPreferences,
    sendTestNotificationFn: depsInput?.sendTestNotificationFn ?? sendSignalTestNotification,
    listNotificationsFn: depsInput?.listNotificationsFn ?? getUserNotifications,
    markAllAsReadFn: depsInput?.markAllAsReadFn ?? markAllNotificationsAsRead,
    markNotificationAsReadFn: depsInput?.markNotificationAsReadFn ?? markNotificationAsRead,
  };
  const router = Router();

  router.get("/api/notifications/preferences/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      const prefs: UserNotificationPreferences = await deps.getPreferencesFn(userId);
      res.json(prefs);
    } catch (error) {
      const status = mapErrorToStatus(error);
      if (status !== 500) return res.status(status).json({ error: mapErrorMessage(error) });
      next(error);
    }
  });

  router.put("/api/notifications/preferences/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      const body = (req.body ?? {}) as NotificationPreferencesUpdateInput;
      const prefs: UserNotificationPreferences = await deps.updatePreferencesFn(userId, body);
      res.json(prefs);
    } catch (error) {
      const status = mapErrorToStatus(error);
      if (status !== 500) return res.status(status).json({ error: mapErrorMessage(error) });
      next(error);
    }
  });

  router.post(
    "/api/notifications/preferences/:userId/test",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = String(req.params.userId ?? "").trim();
        const result: NotificationDeliveryResult = await deps.sendTestNotificationFn(userId);
        res.json(result);
      } catch (error) {
        const status = mapErrorToStatus(error);
        if (status !== 500) return res.status(status).json({ error: mapErrorMessage(error) });
        next(error);
      }
    },
  );

  router.get("/api/notifications/:userId", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (getAuthenticatedUserId(req) !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const limit = req.query.limit != null ? Number(req.query.limit) : undefined;
      const payload: NotificationsListResponse = await deps.listNotificationsFn(userId, limit);
      res.json(payload);
    } catch (error) {
      const status = mapErrorToStatus(error);
      if (status !== 500) return res.status(status).json({ error: mapErrorMessage(error) });
      next(error);
    }
  });

  router.put("/api/notifications/:userId/read-all", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (getAuthenticatedUserId(req) !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const payload: MarkAllNotificationsReadResponse = await deps.markAllAsReadFn(userId);
      res.json(payload);
    } catch (error) {
      const status = mapErrorToStatus(error);
      if (status !== 500) return res.status(status).json({ error: mapErrorMessage(error) });
      next(error);
    }
  });

  router.put("/api/notifications/:id/read", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notificationId = String(req.params.id ?? "").trim();
      const userId = getAuthenticatedUserId(req);
      const payload: NotificationCenterItem = await deps.markNotificationAsReadFn(notificationId, userId);
      res.json(payload);
    } catch (error) {
      const status = mapErrorToStatus(error);
      if (status !== 500) return res.status(status).json({ error: mapErrorMessage(error) });
      next(error);
    }
  });

  return router;
}
