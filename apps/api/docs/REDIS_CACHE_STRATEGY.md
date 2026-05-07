# Redis cache — StockAI Pro (Dividend Screening)

## Deployment

| Environment | File | Redis |
|-------------|------|--------|
| Local / dev stack | `docker-compose.yml` (repo root) | `redis:7-alpine`, port 6379 |
| Production | `docker-compose.prod.yml` | Same image, no host port exposed |

Server flags (dev & prod):

- `--maxmemory 512mb`
- `--maxmemory-policy allkeys-lru`
- `--appendonly yes`

When memory is full, Redis evicts **any** key using approximate LRU, so hot paths (quotes, active screeners) tend to stay while cold keys drop first. TTLs below still apply for normal expiry.

## TTL policy (application)

Defined in `src/config/redis.ts` as `REDIS_TTL_SEC`:

| Domain | TTL | Constant |
|--------|-----|----------|
| Latest quote (`GET /api/quotes/:symbol`) | 300 s (5 min) | `QUOTES` |
| News list (`GET /api/news/:symbol`) | 1800 s (30 min) | `NEWS` |
| Dividend history (`getDividendHistory`) | 86400 s (24 h) | `DIVIDEND` |
| Company search (`GET /api/companies/search`) | 600 s (10 min) | `SEARCH` |
| Dividend growth screener | 3600 s (1 h) | `SCREENER` |
| AI analysis brief | 3600 s (1 h) | `AI_ANALYSIS` |

Key prefix: `cache:v1:…` (see `redisKeys` in the same file).

## Memory sizing (estimate)

Rough **order of magnitude** for a modest MVP (hundreds of symbols, moderate traffic):

- **Quotes:** ~1 key per actively requested symbol; JSON blob often **0.5–2 KB**.
- **News:** 1 key per `(symbol, limit)`; often **2–15 KB** depending on row count and title length.
- **Dividend history:** 1 key per `(symbol, years)`; often **1–8 KB**.
- **Search:** 1 key per hashed `(query, limit)`; typically **under 5 KB**.
- **Screener:** 1 key per distinct filter + pagination tuple; payload can be **tens of KB** if `limit` is large.

**Ballpark active keys:** from low hundreds (light use) to a few thousand (many unique queries/symbols). **512 MB** is a sensible default for this workload; move to **1 GB** if you expect many concurrent unique search/screener keys, very large universes, or shared Redis with BullMQ job payloads.

## Monitoring

`GET /api/redis/stats` returns parsed `INFO` fields: memory, `maxmemory_policy`, `evicted_keys`, `keyspace_hits` / `keyspace_misses`, etc.

Set `REDIS_STATS_SECRET` and send header `X-Redis-Stats-Secret: <value>` to access when the secret is configured.

## Code map

- `src/config/redis.ts` — TTL constants, key builders
- `src/cache/jsonCache.ts` — JSON get/set with TTL
- `src/routes/redisStats.ts` — stats handler
- `src/services/dividendService.ts` — dividend + screener cache
- `src/ai/analysis.ts` — analysis cache
- `src/server.ts` — quotes, news, company search cache
