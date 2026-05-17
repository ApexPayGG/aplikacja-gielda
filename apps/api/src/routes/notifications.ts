import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import {
  getNotificationPreferences,
  sendSignalTestNotification,
  updateNotificationPreferences,
  type NotificationDeliveryResult,
  type NotificationPreferencesUpdateInput,
  type UserNotificationPreferences,
} from "../modules/notifications/notificationsModule";

type NotificationsRouteDeps = {
  getPreferencesFn: typeof getNotificationPreferences;
  updatePreferencesFn: typeof updateNotificationPreferences;
  sendTestNotificationFn: typeof sendSignalTestNotification;
};

function mapErrorToStatus(error: unknown): number {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("Missing userId")) return 400;
  if (msg.includes("Invalid Discord webhook URL")) return 400;
  if (msg.includes("User not found")) return 404;
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

  return router;
}
