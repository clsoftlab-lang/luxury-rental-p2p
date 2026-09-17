<!--
SPDX-License-Identifier: Apache-2.0
Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)
-->
# LuxeLoop — Luxury P2P Rental (Demo)

**LuxeLoop** is a peer-to-peer marketplace where people rent out idle luxury items
(bags · watches · jewelry · clothing) and others rent them for a fee. The platform
handles discovery, booking, and — most importantly — **trust: authenticity
verification, deposits, and lender/renter protection.**

한국어 문서: [README.ko.md](./README.ko.md)

### ▶ LIVE DEMO: https://clsoftlab-lang.github.io/luxury-rental-p2p/

A fully working single-page app that runs entirely in your browser in **demo mode**.
No build step, no server, no accounts.

---

## Why trust is the product

Luxury P2P only works if both sides feel safe. LuxeLoop makes safety a first-class
feature rather than an afterthought:

1. **Authenticity submission** — owners list an item; a professional authenticator
   (demo: simulated) inspects logo, engraving, materials, and serials.
2. **Verified badge** — passing items get an authentication code + badge renters can trust.
3. **Deposit escrow** — the renter's refundable deposit is held on payment (demo) and returned on clean return.
4. **Optional damage/loss insurance** — a small daily premium covers accidents (demo), with a deductible.
5. **Return inspection & checklist** — a shared photo/condition checklist prevents disputes and settles the deposit.
6. **Two-way reviews** — renters and owners rate each other, building community trust.

> **Real authenticity checks require professional authentication.** This demo only
> *simulates* the workflow so you can experience how the safeguards fit together.

---

## Features

- **Browse** 40 seeded items — filter by category (bag/watch/jewelry/clothing), brand, size, daily-rate cap; search; sort (recommended / price / rating).
- **Item detail** — inline-SVG photos, condition grade, daily rate & deposit, **availability calendar**, authenticity status, owner rating.
- **Booking** — pick a date range → automatic fee + deposit calculation (period discounts, service fee, optional insurance) → **simulated payment**.
- **List your own item** — a "rent it out" form persisted to `localStorage`.
- **Authenticity & protection workflow** — badge, inspection steps, deposit, insurance option (all mock).
- **Two-way reviews** — write reviews as renter or owner.
- **Wishlist** — save items with ♡.
- **Extras** — live rate calculator, return checklist modal, damage/loss insurance option, light/dark theme, demo-data reset.

---

## 🤖 AI 기능 (API 연동)

LuxeLoop ships a **secure, pluggable AI layer** with three features:

1. **AI 대여 상담 챗봇** (`#/assistant`) — recommends items by occasion / budget / dates, drawn only from the catalog (fictional brands).
2. **코디/스타일링 추천** — narrative styling suggestions on each item detail page.
3. **정품 인증·안전 거래 안내 생성** — generates the authenticity / deposit / insurance workflow guide on the protection page (emphasizes that real authentication is required).

**Demo mode uses a deterministic mock.** With `ai/config.js` `AI_ENDPOINT = ""` (default), the browser runs a
deterministic Korean **MockProvider** that reuses the app's real item catalog and the `pricing.js` quote engine —
no key, no network, always works.

**Enable real Claude** via the backend proxy in [`server/`](./server/):

```bash
cd server && cp .env.example .env   # put your key in .env
npm install && npm start            # http://localhost:8787/api/ai
```

Then set `ai/config.js`:

```js
export const AI_ENDPOINT = "http://localhost:8787/api/ai";
```

The proxy calls Claude (default model **`claude-haiku-4-5`**, configurable via `AI_MODEL`) with `@anthropic-ai/sdk` and streams the response to the browser.

> **🔒 API keys are SERVER-SIDE ONLY.** The `ANTHROPIC_API_KEY` lives exclusively in `server/.env` (git-ignored).
> **Never put a key in the browser or the repository** — the frontend only ever calls the proxy URL.

---

## ⚙️ 고도화 — 무인·저비용 실 AI 연동

**Autonomous · real Claude · cost-efficient.** The AI layer defaults to a cost-first model and never
breaks the app — even offline.

- **Cost model** — default **`claude-haiku-4-5`** (~**$1 / MTok input, $5 / MTok output**), configurable
  to `claude-sonnet-5` / `claude-opus-5` via `AI_MODEL`. **Prompt caching** (`cache_control:{type:'ephemeral'}`)
  on the stable per-task system prompt means repeated calls read cache and cost less. Output is capped
  (`max_tokens` ~700), and a **monthly token budget** (`AI_MONTHLY_TOKEN_CAP`, default 2,000,000) plus a
  per-IP **rate limit** (20/min) protect spend — over-budget calls return `429 {fallback:true}`.
- **Rough cost estimate** — a typical request (~1.5K input incl. catalog + ~700 output) on Haiku 4.5 is
  well under **$0.005**, i.e. roughly **$3–5 per 1,000 requests** — and lower once prompt caching warms up.
- **☁️ Free Cloudflare Workers one-deploy** — `server/worker.js` + `server/wrangler.toml` call the
  Anthropic REST API directly with the same routing/caching rules. `wrangler secret put ANTHROPIC_API_KEY`
  then `wrangler deploy` — free tier = no server to babysit (무인). See [`server/README.md`](./server/README.md).
- **Autonomous mock-fallback** — if the endpoint fails, returns `429 {fallback:true}`, or the network is
  down, the frontend **auto-falls back to the deterministic mock** so the app keeps working unmanned. The
  home page also auto-generates a weekly **"이번 주 추천 대여 아이템 (상황/예산 기반)"** digest on load,
  built from the catalog + `pricing.js` engine via `askAI` — so it runs even fully offline.

> **🔒 API keys are SERVER-SIDE ONLY — never in the browser or the repo.**

---

## Run locally

No dependencies. Just serve the folder over HTTP (ES modules need `http://`, not `file://`):

```bash
python -m http.server 8994
# then open http://localhost:8994
```

Run the checks (Node 18+):

```bash
node check.mjs        # JSON parse + html containers + pricing.js unit tests
node --check app.js   # syntax check any JS file
```

---

## DEMO-MODE boundaries

> **This is a demo. Please read before assuming anything is real:**
>
> - **All brand names are FICTIONAL** (Aureléon, Valmonté, Céribel, Nordveil, …) and unrelated to any real trademark.
> - **Authentication, escrow, and insurance are SIMULATED.** No item is really authenticated; no money is really held or insured.
> - **`localStorage` is not a real database.** Listings, bookings, wishlist, and reviews live only in your browser and can be cleared at any time.
> - **No real payments, no accounts, no PII.** The "payment" step never collects card or bank details.
> - **A real build would need:** professional authentication partners, real escrow & insurance, KYC/identity verification, a real payment processor, dispute handling, and legal/compliance review.

---

## Tech

- No-build static SPA: `index.html` at repo root, modern HTML + CSS + ES-module JavaScript, relative paths only.
- Responsive mobile-first, light + dark themes.
- Modules: `pricing.js` (fee/deposit/period math), `storage.js` (localStorage w/ try/catch + reset), `svg.js` (inline SVG placeholders), `app.js` (hash router + views).
- Data: `data/items.json` (40 items), `data/config.json` (categories, pricing, protection copy).
- CI: `.github/workflows/ci.yml` runs `node --check` on all JS and `node check.mjs`.

## Project structure

```
index.html          app.js           pricing.js       storage.js       svg.js
styles.css          check.mjs        data/items.json  data/config.json
README.md           README.ko.md     LICENSE          .gitignore
.github/workflows/ci.yml
```

## Contributors

- **Dr. Lee Il-guk (이일국)** — CLSOFTLAB
- **LWJ**
- **LMJ**
- **Claude** (Anthropic) — pair implementation

## License

- Code: **Apache-2.0** — see [LICENSE](./LICENSE).
- Documentation: **CC BY 4.0**.
- SPDX headers: `Apache-2.0`, `Copyright 2026 CLSOFTLAB (씨엘소프트랩), Dr. Lee Il-guk (이일국)`.

---

*Not an official Anthropic product.*

## 🎓 Idea origin

The seed idea for this project came from the **entrepreneurship class taught by Dr. Lee Il-guk (이일국) at Yongin University (용인대학교)**. The students in that class produced startup ideas of remarkable, standout creativity — this project is one of those exceptional ideas, finally brought to life as a working service. Built with deep admiration and gratitude for those students' imagination. *(No student personal information is included; only the idea itself was used, implemented clean-room.)*
