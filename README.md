<p align="center">
  <h1 align="center">🏛️ QUORUM</h1>
  <p align="center"><strong>The Collective Intelligence Layer for Reddit Moderation</strong></p>
  <p align="center">
    <em>Stop moderating alone. Start moderating as a system.</em>
  </p>
</p>

<p align="center">
  <a href="#the-problem">Problem</a> •
  <a href="#the-solution">Solution</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#roadmap">Roadmap</a> •
  <a href="#installation">Installation</a> •
  <a href="#license">License</a>
</p>

---

## The Problem

Moderating a subreddit at scale is a coordination nightmare. Today's mod teams face three systemic failures:

```mermaid
flowchart LR
    A["📋 Flagged Post"] --> B["👤 Mod A Reviews"]
    A --> C["👤 Mod B Reviews"]
    B --> D["❌ Remove"]
    C --> E["✅ Approve"]
    D --> F["😵 Contradiction!"]
    E --> F
    F --> G["🔄 User Confusion\n& Trust Erosion"]

    style A fill:#ff6b6b,stroke:#c0392b,color:#fff
    style F fill:#e74c3c,stroke:#c0392b,color:#fff
    style G fill:#e74c3c,stroke:#c0392b,color:#fff
```

### 🔄 Mod Collisions
Two moderators open the same flagged post. Both investigate. Both act—sometimes contradicting each other. There is no "lock" on mod work, leading to **duplicated effort and inconsistent outcomes**.

### 🧠 Institutional Amnesia
A mod removes a post for violating Rule 3. Six weeks later, a nearly identical post appears. A different mod approves it. The team has **no shared memory** of past decisions, so enforcement drifts over time, eroding community trust.

### ⏱️ Context-Hunting Time Sinks
Before acting on a report, a mod must manually open a user's profile, scroll through history, check previous warnings, and look for behavioral patterns. This **context-gathering takes 2–5 minutes per case**, adding up to hours of lost time daily in high-traffic subreddits.

---

## The Solution

**QUORUM** transforms a disconnected group of individual moderators into a synchronized, learning system. It sits inside the Reddit experience via Devvit and provides four core capabilities:

```mermaid
mindmap
  root((🏛️ QUORUM))
    🔒 Soft-Claim Engine
      Temporary 5-min locks
      Auto-expiry
      Collision prevention
    📚 Decision Memory
      Case law archive
      Content fingerprinting
      Precedent matching
    🕵️ Style Break Detector
      Behavioral fingerprints
      Anomaly scoring
      Account takeover alerts
    🎓 Training Accelerator
      Shadow-mod mode
      Alignment tracking
      Readiness scoring
```

### 🔒 Soft-Claim Engine
When a moderator begins reviewing a post, QUORUM places a **temporary 5-minute claim** on it, visible to all other mods. This eliminates collisions without hard-locking content. Claims auto-expire if the mod moves on, and can be extended or released manually.

```mermaid
sequenceDiagram
    participant M1 as 👤 Mod Alice
    participant Q as 🏛️ QUORUM
    participant R as 🗄️ Redis
    participant M2 as 👤 Mod Bob

    M1->>Q: Opens flagged post
    Q->>R: SET claim:post:t3_abc (TTL 5min)
    R-->>Q: ✅ Claimed
    Q-->>M1: "You're reviewing this post"
    M2->>Q: Opens same post
    Q->>R: GET claim:post:t3_abc
    R-->>Q: Claimed by Alice (3 min ago)
    Q-->>M2: "⚠️ Alice is reviewing this — claimed 3 min ago"
    M1->>Q: Takes action (Remove)
    Q->>R: DEL claim:post:t3_abc
    Q-->>M1: ✅ Action recorded
```

> *"Alice is reviewing this — claimed 2 min ago"*

### 📚 Decision Memory (Case Law)
Every mod action—approve, remove, warn—is recorded alongside the content fingerprint, the rule invoked, and the moderator's rationale. When a similar post appears in the future, QUORUM surfaces **relevant precedents** so the current mod can see how the team has handled analogous cases. This creates a living, searchable "case law" for the subreddit.

```mermaid
flowchart TD
    A["📝 New Flagged Post"] --> B["🤖 Gemini: Generate\nContent Fingerprint"]
    B --> C["🔍 Query memory:fp:index\nfor Similar Hashes"]
    C --> D{"Matches Found?"}
    D -->|Yes| E["📚 Retrieve Precedent Cases\nfrom memory:case:*"]
    D -->|No| F["First-of-kind case"]
    E --> G["📋 Display to Mod:\n3 similar posts removed\nunder Rule 5"]
    F --> G2["📋 No precedent —\nMod decides fresh"]
    G --> H["👤 Mod Acts"]
    G2 --> H
    H --> I["💾 Record Decision\n+ Fingerprint to Memory"]

    style A fill:#3498db,stroke:#2980b9,color:#fff
    style D fill:#f39c12,stroke:#e67e22,color:#fff
    style I fill:#2ecc71,stroke:#27ae60,color:#fff
```

> *"3 similar posts were removed under Rule 5 in the last 90 days. Tap to view."*

### 🕵️ Style Break Detector
QUORUM maintains a lightweight **behavioral fingerprint** for frequent posters—average sentence length, vocabulary diversity, posting cadence, and topic distribution. When a post deviates significantly from a user's established baseline, it flags a potential **account takeover or bot compromise**, giving mods an early-warning system that no amount of manual review could replicate.

```mermaid
flowchart LR
    A["📨 New Post by\nu/example_user"] --> B["🤖 Gemini: Analyze\nWriting Style"]
    B --> C["📊 Compare vs\nstyle:baseline"]
    C --> D{"Deviation > 3σ?"}
    D -->|No| E["✅ Normal —\nUpdate Baseline"]
    D -->|Yes| F["🚨 Style Break Alert!\nDeviation: 4.2σ"]
    F --> G["📢 Notify Mod Team\nvia Context Panel"]

    style D fill:#f39c12,stroke:#e67e22,color:#fff
    style F fill:#e74c3c,stroke:#c0392b,color:#fff
    style E fill:#2ecc71,stroke:#27ae60,color:#fff
```

> *"⚠️ Style anomaly detected: This post's writing pattern deviates 4.2σ from u/example_user's baseline."*

### 🎓 New Mod Training Accelerator
Junior mods enter a **shadow-mod training mode** where they make decisions on real content without those decisions taking effect. Their choices are recorded and compared against the actual decisions made by senior moderators. Over time, QUORUM tracks alignment and generates a readiness score, letting the team know when a trainee is ready for full permissions.

```mermaid
flowchart TD
    A["🎓 Trainee Reviews Post"] --> B["📝 Shadow Decision:\nRemove - Rule 3"]
    A --> C["👤 Senior Reviews\nSame Post"]
    C --> D["✅ Senior Decision:\nRemove - Rule 3"]
    B --> E{"Decisions Match?"}
    D --> E
    E -->|"✅ Match"| F["Alignment +1"]
    E -->|"❌ Mismatch"| G["Flag for Review\n+ Senior Feedback"]
    F --> H["📊 Update Alignment Score\ntrain:align:traineeId"]
    G --> H
    H --> I{"Alignment ≥ 85%\n& Cases ≥ 50?"}
    I -->|Yes| J["🎉 Ready for\nFull Permissions!"]
    I -->|No| K["📈 Continue Training"]

    style J fill:#2ecc71,stroke:#27ae60,color:#fff
    style G fill:#e74c3c,stroke:#c0392b,color:#fff
    style F fill:#2ecc71,stroke:#27ae60,color:#fff
```

> *"Trainee alignment: 87% match with senior decisions over the last 50 cases."*

---

## Tech Stack

| Layer | Technology | Role |
|---|---|---|
| **Platform** | [Reddit Devvit](https://developers.reddit.com) (TypeScript/React) | App shell, UI components, Reddit API access |
| **State** | Devvit Redis Plugin | All persistent state — claims, memory, fingerprints |
| **Orchestration** | [N8N](https://n8n.io/) | Off-chain workflows, scheduled jobs, webhook routing |
| **AI** | [Google Gemini API](https://ai.google.dev/) | Content fingerprinting, style analysis, precedent matching |

### Architecture Overview

```mermaid
graph TB
    subgraph Reddit["🔴 Reddit Platform"]
        subgraph Devvit["📦 Devvit App — QUORUM"]
            CP["🖥️ Context Panel"]
            CE["🔒 Claim Engine"]
            DM["📚 Decision Memory"]
            SD["🕵️ Style Detector"]
            TM["🎓 Training Mode"]
            DB["📊 Dashboard"]
        end
        Redis[("🗄️ Devvit Redis")]
    end

    CP & CE & DM & SD & TM & DB <--> Redis

    Redis <-->|"Webhooks /\nScheduled Jobs"| N8N["⚙️ N8N Orchestrator"]
    N8N <-->|"AI Analysis\nRequests"| Gemini["🤖 Google Gemini API"]

    style Reddit fill:#ff4500,stroke:#cc3700,color:#fff
    style Devvit fill:#1a1a2e,stroke:#16213e,color:#fff
    style Redis fill:#dc382c,stroke:#a52a2a,color:#fff
    style N8N fill:#ea4b71,stroke:#c0392b,color:#fff
    style Gemini fill:#4285f4,stroke:#3367d6,color:#fff
    style CP fill:#2d3436,stroke:#636e72,color:#fff
    style CE fill:#2d3436,stroke:#636e72,color:#fff
    style DM fill:#2d3436,stroke:#636e72,color:#fff
    style SD fill:#2d3436,stroke:#636e72,color:#fff
    style TM fill:#2d3436,stroke:#636e72,color:#fff
    style DB fill:#2d3436,stroke:#636e72,color:#fff
```

### Data Flow

```mermaid
flowchart LR
    A["📋 Reported Post"] --> B["🔒 Claim Check"]
    B --> C["📊 Context Panel\nLoads History"]
    C --> D["🤖 Gemini Analysis\nvia N8N"]
    D --> E["📚 Precedent\nLookup"]
    E --> F["👤 Mod Decision"]
    F --> G["💾 Record to\nDecision Memory"]
    G --> H["📈 Update User\nReputation"]
    H --> I["🔓 Release Claim"]

    style A fill:#e74c3c,stroke:#c0392b,color:#fff
    style D fill:#4285f4,stroke:#3367d6,color:#fff
    style F fill:#f39c12,stroke:#e67e22,color:#fff
    style I fill:#2ecc71,stroke:#27ae60,color:#fff
```

---

## Roadmap

### 20-Day Build Plan

```mermaid
gantt
    title QUORUM — 20-Day Build Plan
    dateFormat  YYYY-MM-DD
    axisFormat  Day %e

    section Phase 1: Foundation
    Repo skeleton & Redis schema      :done, d1, 2026-05-06, 1d
    Devvit init & Redis wrapper        :d2, after d1, 1d
    Soft-Claim engine                  :d3, after d2, 1d
    Context Panel UI                   :d4, after d3, 1d

    section Phase 2: Intelligence
    Decision Memory write path         :d5, after d4, 1d
    Content fingerprinting (Gemini)    :d6, after d5, 1d
    Precedent matching                 :d7, after d6, 1d
    Context Panel v2 (precedents)      :d8, after d7, 1d
    N8N scheduled cleanup              :d9, after d8, 1d

    section Phase 3: Detection & Training
    Style fingerprint baseline         :d10, after d9, 1d
    Style Break Detector               :d11, after d10, 1d
    Alert UI                           :d12, after d11, 1d
    Training Mode capture              :d13, after d12, 1d
    Alignment engine                   :d14, after d13, 1d
    Senior review workflow             :d15, after d14, 1d

    section Phase 4: Polish & Ship
    Dashboard custom post              :d16, after d15, 1d
    Dashboard charts                   :d17, after d16, 1d
    Integration testing                :d18, after d17, 1d
    Performance & polish               :d19, after d18, 1d
    Final docs & submission            :crit, d20, after d19, 1d
```

#### Phase 1: Foundation (Days 1–4)
- [x] **Day 1** — Repository skeleton, README, Redis schema design, `.gitignore`, LICENSE
- [ ] **Day 2** — Devvit project initialization, Redis client wrapper, key helper utilities
- [ ] **Day 3** — Soft-Claim engine: `claimPost()`, `releaseClaim()`, `checkClaim()` with 5-min TTL
- [ ] **Day 4** — Context Panel UI: display active claims, author history summary, inline mod actions

#### Phase 2: Intelligence (Days 5–9)
- [ ] **Day 5** — Decision Memory write path: capture mod actions with content hash + rule ID
- [ ] **Day 6** — Content fingerprinting pipeline: Gemini integration for semantic hashing
- [ ] **Day 7** — Precedent matching: query Decision Memory for similar past cases
- [ ] **Day 8** — Context Panel v2: surface precedent cards with "How was this handled before?"
- [ ] **Day 9** — N8N workflow: scheduled memory compaction and stale-entry cleanup

#### Phase 3: Detection & Training (Days 10–15)
- [ ] **Day 10** — Style fingerprint baseline: compute per-author behavioral vectors via Gemini
- [ ] **Day 11** — Style Break Detector: deviation scoring and anomaly threshold tuning
- [ ] **Day 12** — Alert UI: style-break warnings in the Context Panel
- [ ] **Day 13** — Training Mode: shadow-decision capture for junior mods
- [ ] **Day 14** — Alignment engine: compare trainee vs. senior decisions, compute readiness score
- [ ] **Day 15** — Senior review workflow: approve/reject trainee decisions with feedback

#### Phase 4: Polish & Ship (Days 16–20)
- [ ] **Day 16** — Dashboard custom post: mod team overview, claim activity, decision stats
- [ ] **Day 17** — Dashboard charts: alignment trends, collision rate, style-break alerts over time
- [ ] **Day 18** — End-to-end integration testing on a private subreddit
- [ ] **Day 19** — Performance profiling, Redis key optimization, UI polish
- [ ] **Day 20** — Final documentation, demo recording, hackathon submission

---

## Installation

> **⚠️ Prerequisites:** Node.js 18+, a Reddit account with mod access, and the Devvit CLI.

### 1. Install Devvit CLI & Authenticate

```bash
npm install -g devvit
devvit login
```

### 2. Clone & Install Dependencies

```bash
git clone https://github.com/Anbu-00001/Context_hunting.git
cd Context_hunting
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
# Fill in your Gemini API key and N8N webhook URLs
```

### 4. Start Playtest

```bash
devvit playtest <your-test-subreddit>
```

> 📝 *Detailed installation and configuration guides will be added as modules are completed.*

---

## Project Structure

```mermaid
graph TD
    Root["📁 Context_hunting/"] --> Src["📁 src/"]
    Root --> Docs["📁 docs/"]
    Root --> N8N_Dir["📁 n8n/"]
    Root --> Config["📄 Config Files"]

    Src --> Main["📄 main.ts\nDevvit entry point"]
    Src --> Components["📁 components/\nContext Panel, Dashboard"]
    Src --> Engines["📁 engines/\nClaims, Memory, Style, Training"]
    Src --> RedisDir["📁 redis/\nKey helpers & client wrapper"]
    Src --> Types["📁 types/\nTypeScript interfaces"]

    Docs --> Schema["📄 redis_schema.md"]
    Docs --> Arch["📄 architecture.md"]

    N8N_Dir --> Workflows["📄 Workflow JSONs"]

    Config --> Env["📄 .env.example"]
    Config --> GI["📄 .gitignore"]
    Config --> Lic["📄 LICENSE"]
    Config --> Readme["📄 README.md"]
    Config --> Pkg["📄 package.json"]
    Config --> TS["📄 tsconfig.json"]

    style Root fill:#ff4500,stroke:#cc3700,color:#fff
    style Src fill:#1a1a2e,stroke:#16213e,color:#fff
    style Docs fill:#1a1a2e,stroke:#16213e,color:#fff
    style Engines fill:#2d3436,stroke:#636e72,color:#fff
    style Components fill:#2d3436,stroke:#636e72,color:#fff
    style RedisDir fill:#dc382c,stroke:#a52a2a,color:#fff
```

```
Context_hunting/
├── src/
│   ├── main.ts              # Devvit app entry point
│   ├── components/           # UI components (Context Panel, Dashboard)
│   ├── engines/              # Core logic (Claims, Memory, Style, Training)
│   ├── redis/                # Redis key helpers and client wrapper
│   └── types/                # TypeScript interfaces and types
├── docs/
│   ├── redis_schema.md       # Redis key-value architecture
│   └── architecture.md       # System design docs (coming soon)
├── n8n/                      # N8N workflow export JSONs
├── .env.example              # Environment variable template
├── .gitignore
├── LICENSE
├── README.md
├── package.json
└── tsconfig.json
```

---

## Contributing

QUORUM is currently in active hackathon development. Contributions, feedback, and ideas are welcome after the initial submission period. Please open an issue to discuss any changes.

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <sub>Built with ☕ and conviction for the <strong>Reddit Mod Tools Hackathon 2026</strong></sub>
</p>
