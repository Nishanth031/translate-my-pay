# Translate-My-Pay
### The Freelance & Student Income Stabilizer

> *Financial quietude for irregular lives.* Bills are locked away first, then whatever is left becomes one calm number: **what you can safely spend today.**

---

## 1. Project title

**Translate-My-Pay — The Freelance & Student Income Stabilizer**

## 2. Team members

| Name        | Role               | Registration no. | GitHub      |
|-------------|--------------------|------------------|-------------|
|G NISHANTH  | FRONTEND DEVLEOPER |250171601160      | @Nishanth031 |
| HANEEF MUHAMMAD | RESEARCH      |250171601204      | @han-eef     |

## 3. Project description

Most money apps assume a salary on the 1st of the month. Students, freelancers and gig creators live on stipends that arrive late, allowances that vary, and gig payouts that land whenever. Translate-My-Pay is an **algorithmic cash-flow pacer** built for that irregular reality, designed around Universal Design (**"Calm & Clear" mode**): zero financial jargon, AAA-level text contrast, and status shown through **colour + shape + words** so it never relies on colour alone.

| Service | What it does |
|---|---|
| **01 · Daily Safe-to-Spend Pacer** | One large number every morning (e.g. `₹400/day`), a spend pacer bar, and a tap-to-open **"Show Your Work"** proof with a live 1–30 day stepper. |
| **02 · Virtual Money Vault & Money In** | Mandatory bills (rent, phone, mess) are locked in a Vault that is *strictly isolated from daily spend*. Irregular income (stipends, allowances, gigs) is logged with one-click cards. |
| **03 · Chaos Lab: Auto-Rebalance & Bridge Mode** | Overspend today and the engine spreads the difference across the days left, without shame and without touching the Vault. If Fun Money hits ₹0, the UI shifts to a calm grey **Bridge Mode** showing the exact shortfall, with one-click Undo and Top-Up. |
| **04 · "Can I Afford This?" Simulator** | Type an item and price to get a plain-language verdict (Safe / Caution / Tight / Vault Breach Warning) and an animated day-by-day **Money Timeline** comparing current vs. post-purchase trajectory until payday. |

**Financial Weather System** (always colour + shape + label):

| Weather | Shape | Label | Rule |
|---|---|---|---|
| Sunny | ● circle | Spend Freely | daily safe spend ≥ 75% of today's pace |
| Caution | ▲ triangle | Pacing Tight | 25%–74% after a rebalance |
| Freeze | ⯃ octagon | Vault Only — Stop Spending | < 25% |
| Shortfall | arch | Bridge Mode | Fun Money ≤ ₹0 |

> **Note on "AI decision support":** the product was designed and built with AI tools (see §4). The "Can I Afford This?" verdicts themselves come from a **deterministic** engine rather than a live AI model. That is deliberate: the same inputs always give the same, explainable answer, and every number can be traced in "Show Your Work".

### Run it

No install and no build step.

1. **Locally:** double-click `index.html`. It works from `file://` because there is no Babel and every script is a plain `<script src>`.
2. **Local server (optional):** `npx serve .` or `python -m http.server 8080`, then open `http://localhost:8080`.
3. **GitHub Pages:** push the repo, go to *Settings → Pages*, choose *Deploy from branch*, then `main` / root.

An internet connection is needed on first load, because the libraries and fonts come from CDNs (cdnjs, jsDelivr, Google Fonts).

### Architecture

```
translate-my-pay/
├── index.html          # HTML shell: fonts, CSS, CDN scripts, #root mount
├── README.md
├── .gitignore
├── css/
│   ├── tokens.css      # Calm & Clear tokens, light/dark themes, weather states, base primitives
│   ├── landing.css     # Editorial landing: serif display, hairline runway grid, manifesto, lookbook
│   └── workspace.css   # App shell + the 4 functional pages (Vault, bento, timeline, drawers)
└── js/
    ├── engine.js       # Pure deterministic math (TMPEngine.computeEngine / simulatePurchase)
    ├── presets.js      # 4 judge demo scenarios, quick-log items, simulator chips, toInput()
    └── app.js          # htm + React UI, hash router, landing page + 4 workspace pages
```

**Data flow:** `plan` (React state) → `toInput(plan)` → `computeEngine(input)` → every page renders from that one result. `simulatePurchase()` runs the same engine twice (with and without the purchase). No page does its own arithmetic.

**Routing:** hash routes (`#/`, `#/pacer`, `#/vault`, `#/chaos`, `#/simulator`) work on `file://` and GitHub Pages, and support the back button. Page changes use Framer Motion `AnimatePresence` (mode `wait`), and the nav underline uses a shared `layoutId`.

**Motion stack:** Framer Motion for springs, layout and presence; a custom `requestAnimationFrame` spring (stiffness 300, damping 28) for the liquid number counters; GSAP + ScrollTrigger for the landing page's runway reveals.

### The math (single source of truth: `js/engine.js`)

```
totalMoneyIn        = sum(incomes)
vaultReserved       = sum(active bills)
totalFlexiblePool   = totalMoneyIn − vaultReserved
remainingFlexible   = totalFlexiblePool − priorDaysSpent − spentToday

dailyAllotment      = (totalFlexiblePool − priorDaysSpent) / daysLeft

if spentToday ≤ dailyAllotment:
    safeToSpendToday = dailyAllotment − spentToday
else (overspend → Auto-Rebalance):
    todayOverspend   = spentToday − dailyAllotment
    tomorrowsDaily   = remainingFlexible / (daysLeft − 1)

Bridge Mode         when remainingFlexible ≤ 0  (shortfall = −remainingFlexible)
```

Displayed daily amounts are **rounded down** to the rupee so a user never overshoots.

### Judge demo presets

| Preset | Setup | Result |
|---|---|---|
| 1 · Baseline Student | ₹5,000 in, ₹3,000 Vault, 5 days | **₹400/day**, Spend Freely |
| 2 · Chaos Overspend | ₹1,000 spent on Day 1 | +₹600 over → ₹1,000 ÷ 4 = **₹250/day**, Pacing Tight |
| 3 · Bridge Mode Shortfall | ₹1,200 earlier + ₹1,000 today, 4 days left | **₹200 short**, Vault 100% untouched |
| 4 · Gig Payout Arrival | +₹2,400 freelance gig | ₹4,400 ÷ 5 = **₹880/day** |

Quick engine check from the repo root:

```bash
node -e "const E=require('./js/engine.js'),P=require('./js/presets.js');P.PRESETS.forEach(p=>{const r=E.computeEngine(P.toInput(p.build()));console.log(p.title,'→',r.headlineDaily,r.weather,r.shortfall)})"
```

Expected output: `400 green`, `250 yellow`, `0 bridge 200`, `880 green`.

---

## 4. AI tools used

| Tool | How it was used |
|---|---|
| **Claude (Anthropic)**, via Claude Code | Generated the math engine, UI components, CSS design system, the multi-file refactor and this README from our prompts. It also wrote and ran Node checks of the engine and tested the pages in a browser. |

Libraries (not AI tools, listed for completeness): **React 18.3.1**, **ReactDOM 18.3.1**, **Framer Motion 11.11.17**, **htm 3.1.1**, **GSAP 3.12.5 + ScrollTrigger**. The first prototype used **Babel Standalone** for in-browser JSX; it was removed in the modular version (see §7).

## 5. Important prompts used

These are condensed versions of the prompts that shaped the architecture.

1. **Single deterministic engine (v1 spec).** *"Both 'Show Your Work', 'Auto-Rebalance', and 'Can I Afford This?' MUST read from the exact same pure calculation function."* We supplied the exact invariant (`totalFlexiblePool = totalMoneyIn − vaultReserved`, the in-pace vs. overspend formulas, and `remainingFlexible / (daysLeft − 1)` for tomorrow's rebalanced pace).
2. **Universal Design & weather system.** We asked for jargon-free copy ("Money In", "Mandatory Bills (The Vault)", "Fun Money", "Safe-to-Spend Today"), AAA ink colours, and a colour + shape + label status system (circle / triangle / octagon / arch) so colour-blind users are never left out.
3. **Progressive disclosure layout.** *"A minimal, uncluttered primary viewport that unfolds into 5 distinct interactive layers"*: judge bar, hero number, Show Your Work drawer, Vault & Money In, Chaos / Auto-Rebalance, and the purchase simulator with a timeline.
4. **Multi-file refactor & editorial redesign.** *"Refactor the monolithic index.html into a clean, Git-ready, multi-file repository … an ultra-minimal Luxury Fashion Editorial Landing Page and 4 dedicated functional workspace pages. Preserve 100% of the core deterministic math engine."*
5. **Motion & loading reliability.** *"Force `<MotionConfig reducedMotion="never">` by default … add an explicit in-app 'Motion: Full / Calm' toggle"* and *"use htm … inside standard `<script src>` files so the separated JS files run natively both when double-clicked locally (file://) and when hosted on GitHub Pages."*

## 6. AI-generated code that was modified

The first AI-generated version was reviewed, tested and changed in these ways:

**Changes directed by the team after reviewing v1**
- **Motion policy:** v1 respected the OS `prefers-reduced-motion` setting (a global CSS rule plus `MotionConfig reducedMotion="user"`). On a friend's Windows PC that setting was on, so the app looked static. We replaced it with `reducedMotion="never"` and an explicit in-app **Motion: Full / Calm** toggle.
- **Script loading:** we replaced in-browser Babel (`<script type="text/babel">`) with **htm** tagged templates, so split `.js` files load natively from `file://`.
- **CDNs:** we moved from unpkg to **cdnjs** and **jsDelivr**. cdnjs doesn't host Framer Motion's UMD build, so Framer Motion comes from jsDelivr. `app.js` shows a readable error instead of a blank page if any library fails to load.
- **Liquid counter:** we replaced the Framer `useSpring` counter with a custom `requestAnimationFrame` spring that writes directly to the DOM.
- **Typography & art direction:** we changed the look to fashion-editorial: Cormorant Garamond display serif, hairline runway grids, warm alabaster paper (`#FAF8F5`) and an obsidian dark mode.

**Defects found by testing the generated code, then fixed**
- A **`-0` shortfall** when Fun Money was exactly ₹0. The Node assertion `strictEqual(shortfall, 0)` caught it; the fix computes `0 − remainingFlexible`.
- The **Bridge Mode banner stayed on screen** after leaving Bridge Mode. `AnimatePresence mode="popLayout"` needs ref-forwarding children, which our panels weren't; we switched to the default mode.
- The **active preset's background collapsed to 0px**, because a more specific `.preset > span { position: relative }` rule overrode it.
- The **verdict heading was duplicated** ("Not right now Not right now"), and in dark mode the timeline's two bar colours were indistinguishable.

> _Team: add any edits you made by hand (file, what changed, why) here before submitting._

## 7. Bug solved: the app went static on a friend's PC, and split files crashed under Babel

**Symptom 1: no animations on one Windows laptop.** Springs, drawers and page transitions all worked on our machines, but on a friend's Windows laptop the app was completely static.
**Root cause:** Windows "Animation effects: Off" (also switched on by some battery-saver profiles) makes the browser report `prefers-reduced-motion: reduce`. v1 obeyed that in two places: a global CSS rule forcing every transition to `0.01ms`, and `MotionConfig reducedMotion="user"`. Every animation was silently cancelled.
**Fix:** we removed the global CSS override, set `MotionConfig reducedMotion="never"`, and added an explicit **Motion: Calm** toggle in the header for anyone who wants static transitions (saved to `localStorage`). The number counters use their own rAF spring, so they animate unless the user picks Calm.

**Problem 2: splitting the JSX into files would break local runs.** v1 kept its JSX inline in `index.html`. The obvious split, `<script type="text/babel" src="js/app.js">`, would give a blank page whenever `index.html` is opened by double-click.
**Root cause:** Babel Standalone fetches external `text/babel` sources with XHR, and browsers block those requests on `file://` origins (CORS).
**Fix:** we dropped Babel entirely. Components are written with **htm** (`htm.bind(React.createElement)`), which is plain JavaScript, so every file loads through a normal `<script src>` on both `file://` and GitHub Pages.
**Verified by** opening `index.html` directly from disk, navigating all five routes with no console errors, and running the engine checks in Node.

---

*All math runs locally in the browser. Nothing a user types leaves the page.*
