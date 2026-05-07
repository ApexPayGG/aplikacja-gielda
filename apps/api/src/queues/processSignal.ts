import { Queue } from "bullmq";
import { getCacheRedis } from "../redis";
import { PROCESS_SIGNAL_QUEUE_NAME } from "../jobs/processSignal";

let queueInstance: Queue | null = null;

function getOrCreateQueue(): Queue {
  if (queueInstance) return queueInstance;
  queueInstance = new Queue(PROCESS_SIGNAL_QUEUE_NAME, {
    connection: getCacheRedis(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    },
  });
  return queueInstance;
}

export const processSignalQueue: Pick<Queue, "add"> = {
  add: (...args) => getOrCreateQueue().add(...args),
};
