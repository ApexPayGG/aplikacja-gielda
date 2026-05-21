import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../db/index";
import { daysUntilEventDate } from "./dedupe";
import {
  buildWatchlistDailyDigest,
  ensureSystemAnchorEvent,
  listWatchlistMarketEvents,
  upsertDefaultSubscription,
} from "./marketEventsService";
import type { EventImportance } from "./types";
import { meetsMinImportance } from "./types";

function deliveryDedupeKey(userId: string, eventId: string, channel: string, subtype: string): string {
  return `del:${userId}:${eventId}:${channel}:${subtype}`;
}

export async function deliverUpcomingEventAlerts(
  db: PrismaClient = defaultPrisma,
): Promise<{ notifications: number; skipped: number }> {
  const subs = await db.eventSubscription.findMany({ where: { isActive: true } });
  let notifications = 0;
  let skipped = 0;

  for (const sub of subs) {
    await upsertDefaultSubscription(sub.userId, db);
    const symbols = sub.watchlistOnly
      ? (
          await db.watchlist.findMany({
            where: { userId: sub.userId },
            select: { symbol: true },
          })
        ).map((w) => w.symbol.trim().toUpperCase())
      : [];

    if (sub.watchlistOnly && symbols.length === 0) {
      skipped += 1;
      continue;
    }

    const { events } = sub.watchlistOnly
      ? await listWatchlistMarketEvents(sub.userId, { limit: 60 })
      : { events: [] };

    const allowedTypes = new Set(
      sub.eventTypes.length > 0 ? sub.eventTypes : ["earnings", "dividend", "macro"],
    );
    const minImp = (sub.minImportance ?? "medium") as EventImportance;
    const daysBefore = sub.daysBefore.length > 0 ? sub.daysBefore : [7, 3, 1, 0];

    for (const event of events) {
      if (!allowedTypes.has(event.eventType)) continue;
      if (!meetsMinImportance(event.importance as EventImportance, minImp)) continue;

      const daysTo = daysUntilEventDate(event.eventDate);
      if (!daysBefore.includes(daysTo) && !(daysTo <= 0 && daysBefore.includes(0))) continue;

      if (!sub.channels.includes("in_app")) continue;

      const dedupeKey = deliveryDedupeKey(
        sub.userId,
        event.id,
        "in_app",
        `d${daysTo}`,
      );

      const existing = await db.eventDelivery.findUnique({ where: { dedupeKey } });
      if (existing?.status === "sent") {
        skipped += 1;
        continue;
      }

      try {
        await db.notification.create({
          data: {
            userId: sub.userId,
            type: "market_event",
            title: event.title,
            message: event.summary ?? event.title,
            link: event.symbol ? `/companies/${encodeURIComponent(event.symbol)}` : "/dashboard",
          },
        });

        await db.eventDelivery.upsert({
          where: { dedupeKey },
          create: {
            eventId: event.id,
            userId: sub.userId,
            channel: "in_app",
            status: "sent",
            attempts: 1,
            dedupeKey,
            sentAt: new Date(),
          },
          update: {
            status: "sent",
            attempts: { increment: 1 },
            sentAt: new Date(),
            lastError: null,
          },
        });
        notifications += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await db.eventDelivery.upsert({
          where: { dedupeKey },
          create: {
            eventId: event.id,
            userId: sub.userId,
            channel: "in_app",
            status: "failed",
            attempts: 1,
            dedupeKey,
            lastError: msg,
          },
          update: {
            status: "failed",
            attempts: { increment: 1 },
            lastError: msg,
          },
        });
      }
    }
  }

  return { notifications, skipped };
}

export async function deliverWatchlistDailyDigest(
  db: PrismaClient = defaultPrisma,
): Promise<{ digests: number }> {
  const userIds = await db.watchlist.findMany({
    select: { userId: true },
    distinct: ["userId"],
  });

  let digests = 0;
  const dayKey = new Date().toISOString().slice(0, 10);
  const anchor = await ensureSystemAnchorEvent(db);

  for (const { userId } of userIds) {
    const digest = await buildWatchlistDailyDigest(userId, db);
    if (digest.items.length === 0) continue;

    const dedupeKey = `digest:${userId}:${dayKey}`;
    const existing = await db.eventDelivery.findUnique({ where: { dedupeKey } });
    if (existing?.status === "sent") continue;

    const lines = digest.items.slice(0, 8).map((i) => `• ${i.title}`);
    const message = [digest.headline, "", ...lines].join("\n");

    await db.notification.create({
      data: {
        userId,
        type: "market_event_digest",
        title: "Event Risk Radar — dzisiejszy przegląd watchlisty",
        message,
        link: "/dashboard",
      },
    });

    await db.eventDelivery.upsert({
      where: { dedupeKey },
      create: {
        eventId: anchor.id,
        userId,
        channel: "in_app",
        status: "sent",
        attempts: 1,
        dedupeKey,
        sentAt: new Date(),
      },
      update: { status: "sent", sentAt: new Date() },
    });
    digests += 1;
  }

  return { digests };
}
