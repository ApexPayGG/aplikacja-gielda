import { Queue } from "bullmq";
import {
  DISCORD_SIGNAL_ALERTS_QUEUE_NAME,
  type DiscordSignalAlertJobInput,
} from "../jobs/discordSignalAlerts";
import { getCacheRedis } from "../redis";

let queueInstance: Queue | null = null;

function getOrCreateQueue(): Queue {
  if (queueInstance) return queueInstance;
  queueInstance = new Queue(DISCORD_SIGNAL_ALERTS_QUEUE_NAME, {
    connection: getCacheRedis(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    },
  });
  return queueInstance;
}

export const discordSignalAlertsQueue: Pick<Queue, "add"> = {
  add: (...args) => getOrCreateQueue().add(...args),
};

export async function enqueueDiscordSignalAlert(
  input: DiscordSignalAlertJobInput,
  opts?: { delay?: number },
): Promise<void> {
  await discordSignalAlertsQueue.add("discord:signal:dispatch", input, opts);
}
