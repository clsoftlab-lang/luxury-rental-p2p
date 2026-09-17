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
