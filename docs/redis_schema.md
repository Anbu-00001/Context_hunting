# QUORUM — Redis Schema Design

> **Version:** 1.0.0 (Day 1)  
> **Last Updated:** 2026-05-06  
> **Status:** Foundation — subject to iteration as features are built

---

## Table of Contents

1. [Design Principles](#design-principles)
2. [Key Namespace Convention](#key-namespace-convention)
3. [Schema Overview](#schema-overview)
4. [Module 1: Soft-Claim Engine](#module-1-soft-claim-engine)
5. [Module 2: User History & Reputation](#module-2-user-history--reputation)
6. [Module 3: Decision Memory (Case Law)](#module-3-decision-memory-case-law)
7. [Module 4: Training Mode](#module-4-training-mode)
8. [Module 5: Style Fingerprint](#module-5-style-fingerprint)
9. [Operational Keys](#operational-keys)
10. [Devvit Redis Constraints](#devvit-redis-constraints)
11. [Key Expiration Strategy](#key-expiration-strategy)
12. [Migration Notes](#migration-notes)

---

## Design Principles

| Principle | Rationale |
|---|---|
| **Flat keys with delimiters** | Devvit Redis does not support `SELECT` (multi-DB). Use `:` delimited namespaces to simulate logical separation. |
| **Minimize key count** | Devvit has per-installation storage limits. Prefer Hashes over many individual String keys. |
| **TTL-first design** | Ephemeral data (claims, sessions) must self-expire to prevent storage bloat. |
| **JSON-in-String pattern** | Devvit Redis supports `String`, `Hash`, `Sorted Set`, and `List`. Complex objects are stored as `JSON.stringify()` Strings inside Hash fields or String values. |
| **Subreddit-scoped by default** | All keys are implicitly scoped to the Devvit installation (one per subreddit). No need to embed `subredditId` in every key unless cross-sub queries are needed. |

---

## Key Namespace Convention

```
<module>:<entityType>:<identifier>[:<sub-identifier>]
```

**Examples:**
```
claim:post:t3_abc123
user:history:t2_xyz789
memory:rule:rule_3:fingerprint_a1b2c3
train:session:t2_trainee01
style:baseline:t2_xyz789
```

> All identifiers use Reddit's **fullname** format (e.g., `t3_` for posts, `t2_` for users) to avoid collisions.

---

## Schema Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     QUORUM Redis Keyspace                     │
├──────────────┬──────────┬────────┬──────────────────────────┤
│   Module     │   Type   │  TTL   │  Key Pattern             │
├──────────────┼──────────┼────────┼──────────────────────────┤
│ Claims       │ Hash     │ 5 min  │ claim:post:{postId}      │
│ Claims Index │ Sorted   │ None   │ claim:active             │
│ User History │ Hash     │ 90 day │ user:history:{userId}    │
│ User Warns   │ List     │ None   │ user:warns:{userId}      │
│ Decision Mem │ Hash     │ None   │ memory:case:{caseId}     │
│ Rule Index   │ Sorted   │ None   │ memory:rule:{ruleId}     │
│ Fingerprints │ Sorted   │ None   │ memory:fp:index          │
│ Training Ses │ Hash     │ 24 hr  │ train:session:{odId}     │
│ Training Log │ List     │ 30 day │ train:log:{traineeId}    │
│ Alignment    │ Hash     │ None   │ train:align:{traineeId}  │
│ Style Base   │ Hash     │ 60 day │ style:baseline:{userId}  │
│ Style Alerts │ Sorted   │ 7 day  │ style:alerts             │
│ Config       │ Hash     │ None   │ config:settings          │
└──────────────┴──────────┴────────┴──────────────────────────┘
```

---

## Module 1: Soft-Claim Engine

### Purpose
Prevent two moderators from working on the same reported post simultaneously.

---

### Key: `claim:post:{postId}`

| Property | Value |
|---|---|
| **Type** | Hash |
| **TTL** | `300` seconds (5 minutes) |
| **Created by** | `claimPost(postId, modId)` |
| **Deleted by** | `releaseClaim(postId, modId)` or TTL auto-expiry |

**Hash Fields:**

| Field | Type | Description |
|---|---|---|
| `modId` | String | Reddit fullname of the claiming mod (`t2_abc123`) |
| `modName` | String | Display name for UI rendering |
| `claimedAt` | String (ISO 8601) | Timestamp of claim creation |
| `expiresAt` | String (ISO 8601) | Computed: `claimedAt + 300s` |
| `postTitle` | String | Truncated post title (max 100 chars) for UI display |
| `status` | String | `active` \| `released` \| `completed` |

**Example Stored Data:**
```json
{
  "modId": "t2_mod456",
  "modName": "ModAlice",
  "claimedAt": "2026-05-06T16:30:00Z",
  "expiresAt": "2026-05-06T16:35:00Z",
  "postTitle": "Is this post violating Rule 3? Need second opinion...",
  "status": "active"
}
```

**Operations:**
```typescript
// Claim a post (atomic check-and-set)
await redis.hSet("claim:post:t3_abc123", {
  modId: "t2_mod456",
  modName: "ModAlice",
  claimedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 300_000).toISOString(),
  postTitle: truncate(post.title, 100),
  status: "active"
});
await redis.expire("claim:post:t3_abc123", 300);

// Check if post is claimed
const claim = await redis.hGetAll("claim:post:t3_abc123");
if (claim && claim.status === "active") {
  // Show "Claimed by ModAlice — 2 min ago"
}

// Release claim
await redis.del("claim:post:t3_abc123");
```

---

### Key: `claim:active`

| Property | Value |
|---|---|
| **Type** | Sorted Set |
| **TTL** | None (entries are pruned by scheduled job) |
| **Score** | Claim expiry timestamp (Unix epoch ms) |
| **Member** | `{postId}` |

**Purpose:** Fast lookup of all currently active claims for the dashboard UI. Entries with scores in the past are stale and pruned by the N8N cleanup workflow.

**Operations:**
```typescript
// Add to active index
await redis.zAdd("claim:active", {
  member: "t3_abc123",
  score: Date.now() + 300_000
});

// Get all active claims (not yet expired)
const activeClaims = await redis.zRange("claim:active", Date.now(), "+inf");

// Prune expired entries
await redis.zRemRangeByScore("claim:active", 0, Date.now());
```

---

## Module 2: User History & Reputation

### Purpose
Provide instant context about any post author — their warning history, past violations, and overall reputation score — eliminating the manual profile-diving time sink.

---

### Key: `user:history:{userId}`

| Property | Value |
|---|---|
| **Type** | Hash |
| **TTL** | `7,776,000` seconds (90 days), refreshed on update |
| **Created by** | First mod action involving this user |
| **Updated by** | Every subsequent mod action |

**Hash Fields:**

| Field | Type | Description |
|---|---|---|
| `totalActions` | String (number) | Total mod actions taken on this user's content |
| `removals` | String (number) | Number of content removals |
| `approvals` | String (number) | Number of content approvals |
| `warnings` | String (number) | Number of warnings issued |
| `bans` | String (number) | Number of temp/perma bans |
| `lastActionAt` | String (ISO 8601) | Timestamp of most recent mod action |
| `lastActionType` | String | `remove` \| `approve` \| `warn` \| `ban` |
| `reputationScore` | String (number) | Computed score: `0–100` (100 = perfect citizen) |
| `ruleBreaks` | String (JSON) | `{ "rule_3": 5, "rule_7": 2 }` — breakdown by rule |
| `notes` | String (JSON) | Mod notes array, last 5 entries |

**Example Stored Data:**
```json
{
  "totalActions": "12",
  "removals": "4",
  "approvals": "6",
  "warnings": "2",
  "bans": "0",
  "lastActionAt": "2026-05-05T10:00:00Z",
  "lastActionType": "warn",
  "reputationScore": "62",
  "ruleBreaks": "{\"rule_3\":3,\"rule_5\":1}",
  "notes": "[{\"modId\":\"t2_mod456\",\"text\":\"Repeated low-effort posting\",\"at\":\"2026-05-05T10:00:00Z\"}]"
}
```

---

### Key: `user:warns:{userId}`

| Property | Value |
|---|---|
| **Type** | List |
| **TTL** | None (capped at 20 entries via `LTRIM`) |
| **Created by** | `issueWarning()` |

Each list entry is a JSON string:

```json
{
  "warnId": "w_001",
  "modId": "t2_mod456",
  "modName": "ModAlice",
  "ruleId": "rule_3",
  "postId": "t3_abc123",
  "reason": "Harassment in comments",
  "severity": "medium",
  "issuedAt": "2026-05-04T14:22:00Z"
}
```

**Operations:**
```typescript
// Add warning (push to head, trim to 20)
await redis.lPush("user:warns:t2_xyz789", JSON.stringify(warning));
await redis.lTrim("user:warns:t2_xyz789", 0, 19);

// Get recent warnings
const warnings = await redis.lRange("user:warns:t2_xyz789", 0, 4); // last 5
```

---

## Module 3: Decision Memory (Case Law)

### Purpose
Build a searchable archive of past mod decisions so that similar future cases can reference historical precedent, ensuring consistent enforcement.

---

### Key: `memory:case:{caseId}`

| Property | Value |
|---|---|
| **Type** | Hash |
| **TTL** | None (persistent — this is institutional memory) |
| **Created by** | Post-action hook after any mod decision |

**`caseId` generation:** `SHA-256(postId + modAction + timestamp)` truncated to 12 hex chars.

**Hash Fields:**

| Field | Type | Description |
|---|---|---|
| `postId` | String | Original post fullname |
| `postTitle` | String | Post title (truncated to 200 chars) |
| `contentHash` | String | Semantic fingerprint from Gemini (64-char hex) |
| `authorId` | String | Post author's fullname |
| `modId` | String | Acting moderator's fullname |
| `modName` | String | Acting moderator's display name |
| `action` | String | `remove` \| `approve` \| `warn` \| `ban` \| `ignore` |
| `ruleId` | String | The rule ID invoked (e.g., `rule_3`) |
| `rationale` | String | Free-text mod rationale (max 500 chars) |
| `confidence` | String (number) | Mod's self-assessed confidence `1–5` |
| `keywords` | String (JSON) | Gemini-extracted topic keywords `["spam", "self-promo"]` |
| `decidedAt` | String (ISO 8601) | Timestamp of the decision |
| `metadata` | String (JSON) | Extensible metadata bag |

**Example Stored Data:**
```json
{
  "postId": "t3_abc123",
  "postTitle": "Check out my new crypto course!! Limited time...",
  "contentHash": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
  "authorId": "t2_spammer01",
  "modId": "t2_mod456",
  "modName": "ModAlice",
  "action": "remove",
  "ruleId": "rule_5",
  "rationale": "Clear self-promotion and spam. No prior engagement in community.",
  "confidence": "5",
  "keywords": "[\"crypto\",\"self-promotion\",\"spam\",\"course\"]",
  "decidedAt": "2026-05-06T12:00:00Z",
  "metadata": "{\"reportCount\":7,\"upvoteRatio\":0.12}"
}
```

---

### Key: `memory:rule:{ruleId}`

| Property | Value |
|---|---|
| **Type** | Sorted Set |
| **TTL** | None |
| **Score** | Decision timestamp (Unix epoch ms) |
| **Member** | `{caseId}` |

**Purpose:** Index all cases by rule, ordered chronologically. Enables queries like *"Show me the last 10 Rule 3 removals"*.

**Operations:**
```typescript
// Index a new case under its rule
await redis.zAdd("memory:rule:rule_5", {
  member: "a1b2c3d4e5f6",
  score: Date.now()
});

// Query recent precedents for Rule 5 (last 10)
const recentCases = await redis.zRange("memory:rule:rule_5", 0, 9, { reverse: true });

// For each caseId, hydrate the full case:
for (const caseId of recentCases) {
  const caseData = await redis.hGetAll(`memory:case:${caseId}`);
}
```

---

### Key: `memory:fp:index`

| Property | Value |
|---|---|
| **Type** | Sorted Set |
| **TTL** | None |
| **Score** | Numeric hash bucket (first 8 hex chars of `contentHash` → decimal) |
| **Member** | `{caseId}` |

**Purpose:** Approximate nearest-neighbor lookup for content fingerprints. When a new post arrives, compute its fingerprint, convert the first 8 hex chars to a decimal score, and query a range `[score - delta, score + delta]` to find candidate matches. Final similarity is confirmed by full hash comparison or Gemini re-analysis.

**Operations:**
```typescript
// Index a case by fingerprint bucket
const bucket = parseInt(contentHash.substring(0, 8), 16);
await redis.zAdd("memory:fp:index", {
  member: caseId,
  score: bucket
});

// Find similar content (approximate)
const delta = 65536; // tunable similarity window
const candidates = await redis.zRange("memory:fp:index", bucket - delta, bucket + delta);
```

---

## Module 4: Training Mode

### Purpose
Allow junior moderators to practice on real content in a "shadow" mode, capturing their decisions for comparison against senior mod actions.

---

### Key: `train:session:{modId}`

| Property | Value |
|---|---|
| **Type** | Hash |
| **TTL** | `86,400` seconds (24 hours) |
| **Created by** | `startTrainingSession(traineeModId)` |

**Hash Fields:**

| Field | Type | Description |
|---|---|---|
| `traineeId` | String | Trainee's user fullname |
| `traineeName` | String | Trainee's display name |
| `mentorId` | String | Assigned senior mod fullname |
| `mentorName` | String | Senior mod display name |
| `startedAt` | String (ISO 8601) | Session start time |
| `casesReviewed` | String (number) | Count of cases reviewed this session |
| `status` | String | `active` \| `paused` \| `completed` |

**Example Stored Data:**
```json
{
  "traineeId": "t2_trainee01",
  "traineeName": "NewModBob",
  "mentorId": "t2_mod456",
  "mentorName": "ModAlice",
  "startedAt": "2026-05-06T14:00:00Z",
  "casesReviewed": "12",
  "status": "active"
}
```

---

### Key: `train:log:{traineeId}`

| Property | Value |
|---|---|
| **Type** | List |
| **TTL** | `2,592,000` seconds (30 days) |
| **Capped at** | 200 entries via `LTRIM` |

Each list entry is a JSON string representing one shadow-decision:

```json
{
  "postId": "t3_abc123",
  "traineeAction": "remove",
  "traineeRuleId": "rule_3",
  "traineeRationale": "Seems like targeted harassment",
  "seniorAction": "remove",
  "seniorRuleId": "rule_3",
  "seniorRationale": "Clear Rule 3 violation — personal attack",
  "match": true,
  "decidedAt": "2026-05-06T14:15:00Z",
  "reviewedBySenior": true,
  "seniorFeedback": "Good call. Note the pattern in comment history."
}
```

**Operations:**
```typescript
// Record a shadow decision
await redis.lPush(`train:log:t2_trainee01`, JSON.stringify(decision));
await redis.lTrim(`train:log:t2_trainee01`, 0, 199);

// Retrieve last 10 decisions for review
const recent = await redis.lRange(`train:log:t2_trainee01`, 0, 9);
```

---

### Key: `train:align:{traineeId}`

| Property | Value |
|---|---|
| **Type** | Hash |
| **TTL** | None (persistent for the trainee's lifetime) |

**Hash Fields:**

| Field | Type | Description |
|---|---|---|
| `totalCases` | String (number) | Total cases reviewed in training |
| `matchCount` | String (number) | Decisions that matched senior action |
| `mismatchCount` | String (number) | Decisions that diverged |
| `alignmentPct` | String (number) | `(matchCount / totalCases) * 100` |
| `ruleAccuracy` | String (JSON) | Per-rule accuracy: `{"rule_3": 90, "rule_5": 75}` |
| `lastUpdated` | String (ISO 8601) | Last alignment recalculation |
| `readinessLevel` | String | `beginner` \| `intermediate` \| `ready` |

**Example Stored Data:**
```json
{
  "totalCases": "47",
  "matchCount": "41",
  "mismatchCount": "6",
  "alignmentPct": "87.2",
  "ruleAccuracy": "{\"rule_3\":92,\"rule_5\":78,\"rule_7\":100}",
  "lastUpdated": "2026-05-06T16:00:00Z",
  "readinessLevel": "intermediate"
}
```

**Readiness Thresholds:**
| Level | Criteria |
|---|---|
| `beginner` | `alignmentPct < 70` OR `totalCases < 20` |
| `intermediate` | `alignmentPct >= 70` AND `totalCases >= 20` |
| `ready` | `alignmentPct >= 85` AND `totalCases >= 50` AND no rule below 70% |

---

## Module 5: Style Fingerprint

### Purpose
Maintain a behavioral baseline for active users and detect anomalous posts that may indicate account compromise or bot takeover.

---

### Key: `style:baseline:{userId}`

| Property | Value |
|---|---|
| **Type** | Hash |
| **TTL** | `5,184,000` seconds (60 days), refreshed on update |
| **Created by** | First Gemini analysis of user's content |
| **Updated by** | Rolling average on each new analyzed post |

**Hash Fields:**

| Field | Type | Description |
|---|---|---|
| `avgSentenceLen` | String (number) | Average sentence length in words |
| `vocabDiversity` | String (number) | Type-token ratio `0.0–1.0` |
| `avgPostLen` | String (number) | Average post length in characters |
| `topicVector` | String (JSON) | Top-5 topic distribution `[["gaming", 0.4], ["tech", 0.3], ...]` |
| `postingCadence` | String (JSON) | `{"avgPerDay": 2.3, "peakHourUTC": 14}` |
| `sentimentBaseline` | String (number) | Average sentiment score `-1.0` to `1.0` |
| `sampleSize` | String (number) | Number of posts analyzed to build baseline |
| `lastUpdated` | String (ISO 8601) | Last baseline refresh |
| `modelVersion` | String | Gemini model version used for analysis |

**Example Stored Data:**
```json
{
  "avgSentenceLen": "14.2",
  "vocabDiversity": "0.72",
  "avgPostLen": "847",
  "topicVector": "[[\"gaming\",0.42],[\"tech\",0.28],[\"memes\",0.15],[\"news\",0.10],[\"other\",0.05]]",
  "postingCadence": "{\"avgPerDay\":2.3,\"peakHourUTC\":14}",
  "sentimentBaseline": "0.15",
  "sampleSize": "34",
  "lastUpdated": "2026-05-05T20:00:00Z",
  "modelVersion": "gemini-2.0-flash"
}
```

---

### Key: `style:alerts`

| Property | Value |
|---|---|
| **Type** | Sorted Set |
| **TTL** | Auto-prune entries older than 7 days via scheduled job |
| **Score** | Alert timestamp (Unix epoch ms) |
| **Member** | JSON string of the alert payload |

**Alert Payload:**
```json
{
  "alertId": "sa_001",
  "userId": "t2_xyz789",
  "userName": "SuspectUser",
  "postId": "t3_flagged01",
  "deviationScore": 4.2,
  "deviationDetails": {
    "sentenceLenDelta": 2.1,
    "vocabDelta": 1.8,
    "topicDelta": 3.5,
    "sentimentDelta": 0.9
  },
  "severity": "high",
  "detectedAt": "2026-05-06T15:30:00Z",
  "reviewed": false,
  "reviewedBy": null
}
```

**Severity Thresholds:**
| Severity | Composite Deviation Score |
|---|---|
| `low` | `2.0σ – 3.0σ` |
| `medium` | `3.0σ – 4.0σ` |
| `high` | `> 4.0σ` |

---

## Operational Keys

### Key: `config:settings`

| Property | Value |
|---|---|
| **Type** | Hash |
| **TTL** | None |

**Hash Fields:**

| Field | Default | Description |
|---|---|---|
| `claimTTL` | `300` | Claim duration in seconds |
| `maxClaimsPerMod` | `3` | Max concurrent claims per mod |
| `trainingEnabled` | `true` | Global toggle for training mode |
| `styleDetectionEnabled` | `true` | Global toggle for style break detection |
| `styleAlertThreshold` | `3.0` | Sigma threshold for style alerts |
| `memoryRetentionDays` | `180` | Days to retain decision memory |
| `geminiModel` | `gemini-2.0-flash` | Gemini model for analysis |

---

## Devvit Redis Constraints

> ⚠️ These constraints inform the schema design decisions above.

| Constraint | Limit | Mitigation |
|---|---|---|
| **No `SELECT`** | Single logical database | Namespace keys with `:` delimiters |
| **No `SCAN`** | Cannot iterate all keys | Maintain explicit index Sorted Sets |
| **No `LUA` scripting** | Cannot run server-side scripts | Use sequential `GET`→check→`SET` with TTL as optimistic lock |
| **Storage per install** | ~500 KB (soft limit, may vary) | Aggressive TTL, capped Lists, periodic compaction |
| **Supported types** | String, Hash, List, Sorted Set | Complex objects serialized as JSON strings |
| **No `WATCH`/`MULTI`** | No true transactions | Design for idempotency; use TTL-based claim expiry instead of locks |

---

## Key Expiration Strategy

| Category | TTL | Rationale |
|---|---|---|
| **Claims** | 5 min | Short-lived by design; stale claims auto-clear |
| **User History** | 90 days | Balance context depth vs. storage; refresh on activity |
| **User Warnings** | None (capped) | Keep last 20 via `LTRIM`; old warnings fall off |
| **Decision Memory** | None | Permanent institutional knowledge; compacted via N8N jobs |
| **Training Sessions** | 24 hours | Sessions are daily; auto-expire overnight |
| **Training Logs** | 30 days | Sufficient for review cycles; old logs are archived |
| **Training Alignment** | None | Persistent trainee record |
| **Style Baselines** | 60 days | Baselines go stale; refresh or rebuild |
| **Style Alerts** | 7 days | Alerts older than a week are no longer actionable |
| **Config** | None | Persistent settings |

---

## Migration Notes

### Version 1.0 → Future

- **v1.1:** Consider adding `memory:embedding:{caseId}` keys to store full vector embeddings if Gemini supports sub-100ms embedding generation. This would replace the approximate fingerprint bucket approach.
- **v1.2:** If cross-subreddit features are added, prefix all keys with `sub:{subredditId}:` and update all key helpers.
- **v1.3:** Evaluate Redis `JSON` module availability in Devvit for native JSON path queries, replacing the `JSON.stringify` pattern.

---

<p align="center"><em>This schema is the foundation. Every feature in QUORUM reads from and writes to these keys.</em></p>
