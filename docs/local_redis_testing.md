# QUORUM — Local Redis Testing Guide

> For testing our Day 1 Redis schema locally with Redis Insight before deploying to Devvit's cloud Redis.

---

## 1. Start Local Redis via Docker

```bash
docker run -d --name quorum-redis -p 6379:6379 redis:7-alpine
```

| Flag | Purpose |
|---|---|
| `-d` | Run in background (detached) |
| `--name quorum-redis` | Name the container for easy management |
| `-p 6379:6379` | Expose Redis on localhost:6379 |
| `redis:7-alpine` | Lightweight Redis 7 image (~13MB) |

### Container Management

```bash
# Stop the container
docker stop quorum-redis

# Start it again (data persists)
docker start quorum-redis

# Remove the container entirely
docker rm -f quorum-redis

# View logs
docker logs quorum-redis
```

---

## 2. Connect Redis Insight

1. Download [Redis Insight](https://redis.io/insight/) (free)
2. Open Redis Insight → **Add Redis Database**
3. Enter connection details:

| Field | Value |
|---|---|
| **Host** | `127.0.0.1` |
| **Port** | `6379` |
| **Database Alias** | `QUORUM Local` |
| **Username** | *(leave blank)* |
| **Password** | *(leave blank)* |

4. Click **Add Redis Database** → You're connected

---

## 3. Test the QUORUM Schema

Once connected, you can manually test our Redis schema keys from `docs/redis_schema.md`.

### Quick Test Commands (in Redis Insight CLI or `redis-cli`)

```bash
# Connect via CLI
docker exec -it quorum-redis redis-cli
```

#### Test Soft-Claim Engine
```redis
HSET claim:post:t3_test01 modId "t2_mod456" modName "ModAlice" claimedAt "2026-05-07T00:00:00Z" expiresAt "2026-05-07T00:05:00Z" postTitle "Test post" status "active"
EXPIRE claim:post:t3_test01 300
HGETALL claim:post:t3_test01
TTL claim:post:t3_test01
```

#### Test User History
```redis
HSET user:history:t2_xyz789 totalActions "5" removals "2" approvals "3" warnings "0" bans "0" reputationScore "78"
HGETALL user:history:t2_xyz789
```

#### Test Decision Memory
```redis
HSET memory:case:abc123def456 postId "t3_test01" action "remove" ruleId "rule_3" rationale "Spam" decidedAt "2026-05-07T00:00:00Z"
ZADD memory:rule:rule_3 1746576000000 "abc123def456"
ZRANGE memory:rule:rule_3 0 -1 WITHSCORES
```

#### Test Training Mode
```redis
HSET train:align:t2_trainee01 totalCases "25" matchCount "22" alignmentPct "88.0" readinessLevel "intermediate"
HGETALL train:align:t2_trainee01
```

#### Cleanup
```redis
FLUSHDB
```

---

## 4. Devvit Redis vs Local Redis

| Aspect | Local Docker Redis | Devvit Cloud Redis |
|---|---|---|
| **Purpose** | Schema prototyping & testing | Production |
| **Access** | `redis-cli` / Redis Insight | `import { redis } from "@devvit/web/server"` |
| **Data types** | Full Redis feature set | String, Hash, List, Sorted Set only |
| **Persistence** | Container-local | Managed by Reddit |
| **Transactions** | Full MULTI/EXEC support | No WATCH/MULTI |
| **Key scanning** | SCAN available | No SCAN — use index Sorted Sets |

> **⚠️ Important:** Devvit Redis has constraints (no SCAN, no LUA, no MULTI). Always validate your approach against the limits documented in `docs/redis_schema.md` § Devvit Redis Constraints.

---

## 5. Architecture Note

This project uses the **Devvit Web SDK** (`@devvit/web` v0.12.x), not the older `@devvit/public-api`.

- **No `Devvit.configure()` call needed** — Redis and Reddit API are enabled automatically
- Server entry point: `src/server/index.ts`
- Redis access: `import { redis } from "@devvit/web/server"` (already configured in `server.ts`)
- Reddit API: `import { reddit } from "@devvit/web/server"` (already configured in `server.ts`)
