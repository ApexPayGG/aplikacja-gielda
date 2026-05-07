import "../src/load-env";
import { Queue } from "bullmq";
import { FETCH_QUOTES_JOB_NAME, FETCH_QUOTES_QUEUE_NAME } from "../src/jobs/fetchPolygonQuotes";
import { createRedisConnection } from "../src/redis";

const connection = createRedisConnection();
const queue = new Queue(FETCH_QUOTES_QUEUE_NAME, { connection });
await queue.add(FETCH_QUOTES_JOB_NAME, {}, { removeOnComplete: 200 });
await queue.close();
await connection.quit();
