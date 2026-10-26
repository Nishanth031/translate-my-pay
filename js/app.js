/*
 * Translate-My-Pay — app.js
 * Shared UI + hash router + the Editorial Landing Page and four workspace pages.
 *
 * Written with htm (tagged templates bound to React.createElement) so it runs as a
 * plain <script src> — no Babel, no build step, no CORS issues on file://.
 * All money math comes from window.TMPEngine (js/engine.js).
 */
(function () {
  'use strict';

  var rootEl = document.getElementById('root');
  if (!window.React || !window.ReactDOM || !window.Motion || !window.htm || !window.TMPEngine || !window.TMPPresets) {
    rootEl.innerHTML = '<div class="boot" role="alert">Translate-My-Pay couldn’t load its libraries (React, Framer Motion, htm). Check your internet connection and reload.</div>';
    return;
  }

  const { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, useContext, createContext } = React;
  const { motion, AnimatePresence, MotionConfig, LayoutGroup } = window.Motion;
  const html = window.htm.bind(React.createElement);
  const { computeEngine, simulatePurchase, sumAmounts } = window.TMPEngine;
  const { PRESETS, QUICK_INCOME, CHAOS_ITEMS, SIM_CHIPS, toInput } = window.TMPPresets;
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* ═════════════ Helpers ═════════════ */
  const SPRING = { type: 'spring', stiffness: 300, damping: 28 };
  const SILK = { duration: 0.6, ease: [0.22, 1, 0.36, 1] };
  const QUICK_EXIT = { duration: 0.15, ease: 'easeOut' };
  const NF = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
  const rupees = (n) => (Math.round(n) < 0 ? '−₹' : '₹') + NF.format(Math.abs(Math.round(n)));
  const safeRupees = (n) => '₹' + NF.format(Math.floor(Math.max(0, n)));
  const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');
  const isWhole = (n) => Math.abs(n - Math.round(n)) < 1e-9;
  let idCounter = 0;
  const uid = (prefix) => prefix + '-' + Date.now().toString(36) + '-' + (++idCounter);
  const digitsOnly = (v) => String(v).replace(/[^\d]/g, '').slice(0, 7);
  const store = {
    get(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { window.localStorage.setItem(key, value); } catch (e) { /* storage unavailable (file:// in some browsers, private mode) */ } },
  };

  /* Motion preference: "full" by default on every machine; "calm" only when the user picks it in-app. */
  const MotionPref = createContext('full');
  const useCalm = () => useContext(MotionPref) === 'calm';

  /* ═════════════ Liquid counter — custom rAF spring (stiffness 300, damping 28) ═════════════
     Writes straight to the DOM node every frame, so it animates at display rate
     without re-rendering React and regardless of OS animation settings. */
  const SPRING_K = 300;
  const SPRING_C = 28;
  function AnimatedNumber({ value, className = '' }) {
    const calm = useCalm();
    const ref = useRef(null);
    const sim = useRef({ x: value, v: 0, raf: 0, last: 0 });
    useLayoutEffect(() => {
      const el = ref.current;
      const s = sim.current;
      const paint = (x) => { if (el) el.textContent = NF.format(Math.round(x)); };
      cancelAnimationFrame(s.raf);
      if (calm || !isFinite(s.x)) { s.x = value; s.v = 0; paint(value); return undefined; }
      paint(s.x);
      s.last = performance.now();
      const step = (now) => {
        const dt = Math.min(0.05, Math.max(0, (now - s.last) / 1000));
        s.last = now;
        const h = dt / 4;
        for (let i = 0; i < 4; i++) {
          const a = -SPRING_K * (s.x - value) - SPRING_C * s.v;
          s.v += a * h;
          s.x += s.v * h;
        }
        if (Math.abs(s.x - value) < 0.4 && Math.abs(s.v) < 0.4) { s.x = value; s.v = 0; paint(value); return; }
        paint(s.x);
        s.raf = requestAnimationFrame(step);
      };
      s.raf = requestAnimationFrame(step);
      return () => cancelAnimationFrame(s.raf);
    }, [value, calm]);
    return html`<span ref=${ref} className=${'num ' + className}></span>`;
  }
  function AnimatedRupees({ value, className = '' }) {
    return html`<span className=${'num ' + className}>${value < 0 ? '−' : ''}₹<${AnimatedNumber} value=${Math.abs(Math.round(value))} /></span>`;
  }

  /* ═════════════ Financial Weather: colour + shape + words ═════════════ */
  const WEATHER = {
    green: { sky: 'Sunny', label: 'Spend Freely', shape: 'circle', line: "You're on pace. Today's number is yours to enjoy." },
    yellow: { sky: 'Caution', label: 'Pacing Tight', shape: 'triangle', line: 'A rebalance lowered your daily number. Still fine — just go gently.' },
    red: { sky: 'Freeze', label: 'Vault Only — Stop Spending', shape: 'octagon', line: 'Fun Money is very low. Pause extras until payday; your bills are safe.' },
    bridge: { sky: 'Shortfall', label: 'Bridge Mode', shape: 'arch', line: "Fun Money is used up. Here's the exact gap and calm ways to close it." },
  };
  function Shape({ shape, size = 16 }) {
    const p = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' };
    if (shape === 'circle') return html`<svg ...${p}><circle cx="12" cy="12" r="9" fill="currentColor" /></svg>`;
    if (shape === 'triangle') return html`<svg ...${p}><path d="M12 2.5 22.5 21h-21z" fill="currentColor" /></svg>`;
    if (shape === 'octagon') return html`<svg ...${p}><path d="M8 2h8l6 6v8l-6 6H8l-6-6V8z" fill="currentColor" /></svg>`;
    return html`<svg ...${p}><path d="M1.5 21V12a10.5 10.5 0 0 1 21 0v9h-5v-8.5a5.5 5.5 0 0 0-11 0V21z" fill="currentColor" /></svg>`;
  }
  function WeatherBadge({ weather, live = false }) {
    const w = WEATHER[weather];
    return html`
      <${motion.span} layout className="weather-badge" role=${live ? 'status' : undefined} aria-live=${live ? 'polite' : undefined} transition=${SPRING}>
        <${Shape} shape=${w.shape} size=${14} />
        <span className="wb-label"><span className="sr-only">Money weather: ${w.sky}. </span>${w.label}</span>
      <//>`;
  }

  /* ═════════════ Shell: header, nav, judge bar, toast ═════════════ */
  const NAV = [
    { id: 'landing', n: '00', label: 'Manifesto' },
    { id: 'pacer', n: '01', label: 'Daily Pacer' },
    { id: 'vault', n: '02', label: 'Vault & Money In' },
    { id: 'chaos', n: '03', label: 'Chaos Lab' },
    { id: 'simulator', n: '04', label: 'Can I Afford This?' },
  ];

  function PillToggle({ on, onClick, label, knob, text }) {
    return html`
      <${motion.button} type="button" className="pill-toggle" aria-pressed=${on} aria-label=${label} onClick=${onClick} whileTap=${{ scale: 0.95 }}>
        <span className="pt-track" data-on=${String(on)}><${motion.span} layout className="pt-knob" transition=${SPRING} aria-hidden="true">${knob}<//></span>
        <span className="pt-label">${text}</span>
      <//>`;
  }

  function Header({ page, onNavigate, weather, dark, onToggleTheme, calm, onToggleMotion }) {
    const [infoOpen, setInfoOpen] = useState(false);
    const ctrlRef = useRef(null);
    useEffect(() => {
      if (!infoOpen) return undefined;
      const onDown = (e) => { if (ctrlRef.current && !ctrlRef.current.contains(e.target)) setInfoOpen(false); };
      const onKey = (e) => { if (e.key === 'Escape') setInfoOpen(false); };
      document.addEventListener('mousedown', onDown);
      document.addEventListener('keydown', onKey);
      return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
    }, [infoOpen]);

    return html`
      <header className="topbar">
        <div className="wrap topbar-inner">
          <button type="button" className="brand" onClick=${() => onNavigate('landing')} aria-label="Translate-My-Pay — back to the Manifesto">
            <span className="brand-name">Translate<em>-My-</em>Pay</span>
            <span className="brand-sub">Income Stabilizer</span>
          </button>
          <${LayoutGroup} id="nav">
            <nav className="nav" aria-label="Pages">
              ${NAV.map((item) => html`
                <button key=${item.id} type="button" className="nav-item" aria-current=${page === item.id ? 'page' : undefined} onClick=${() => onNavigate(item.id)}>
                  <span className="n">${item.n}</span>${item.label}
                  ${page === item.id && html`<${motion.span} layoutId="nav-indicator" className="nav-indicator" transition=${SPRING} />`}
                </button>`)}
            </nav>
          <//>
          <div className="controls" ref=${ctrlRef}>
            <${WeatherBadge} weather=${weather} live=${true} />
            <${PillToggle} on=${calm} onClick=${onToggleMotion} knob=${calm ? '◦' : '›'} text=${calm ? 'Motion: Calm' : 'Motion: Full'}
              label=${'Motion is ' + (calm ? 'Calm (static transitions)' : 'Full') + '. Switch to ' + (calm ? 'Full' : 'Calm') + '.'} />
            <${PillToggle} on=${dark} onClick=${onToggleTheme} knob=${dark ? '☾' : '☀'} text=${dark ? 'Dark' : 'Light'}
              label=${'Calm & Clear high-contrast mode: ' + (dark ? 'dark' : 'light') + '. Switch to ' + (dark ? 'light' : 'dark') + '.'} />
            <${motion.button} type="button" className="icon-btn info-btn" aria-label="About Calm & Clear universal design" aria-expanded=${infoOpen} aria-controls="calm-info"
              onClick=${() => setInfoOpen((o) => !o)} whileTap=${{ scale: 0.9 }}>i<//>
            <${AnimatePresence}>
              ${infoOpen && html`
                <${motion.div} key="info" id="calm-info" className="popover" role="dialog" aria-label="Calm & Clear universal design"
                  initial=${{ opacity: 0, y: -8 }} animate=${{ opacity: 1, y: 0 }} exit=${{ opacity: 0, y: -8 }} transition=${SPRING}>
                  <h2>Calm & Clear</h2>
                  <p className="muted" style=${{ fontSize: 14 }}>Universal Design: anyone can read their money at a glance — stressed, tired, colour-blind or on a cracked phone screen.</p>
                  <ul>
                    <li><span aria-hidden="true">◐</span><span>Near-black ink on paper (and the inverse in dark mode) for AAA-level text contrast.</span></li>
                    <li><span aria-hidden="true">◆</span><span>Every status pairs <strong>colour + shape + words</strong> — never colour alone.</span></li>
                    <li><span aria-hidden="true">#</span><span>Tabular monospaced digits, so counting numbers never jitter.</span></li>
                    <li><span aria-hidden="true">↺</span><span>Motion is always on by default; switch to <strong>Motion: Calm</strong> above for static transitions.</span></li>
                    <li><span aria-hidden="true">⌨</span><span>Everything works by keyboard; Esc closes any layer.</span></li>
                  </ul>
                  <div className="legend" aria-label="Weather legend">
                    ${['green', 'yellow', 'red', 'bridge'].map((k) => html`
                      <span key=${k} className=${'tone-' + k}><${Shape} shape=${WEATHER[k].shape} size=${12} />${WEATHER[k].sky}: ${WEATHER[k].label}</span>`)}
                  </div>
                <//>`}
            <//>
          </div>
        </div>
      </header>`;
  }

  function JudgeBar({ active, onPick }) {
    return html`
      <section className="judge" aria-label="Judge demo scenarios">
        <div className="wrap judge-inner">
          <div className="judge-label"><span className="eyebrow">Judge Demo</span><strong>1-click scenarios</strong></div>
          <${LayoutGroup} id="presets">
            <div className="judge-grid">
              ${PRESETS.map((p) => html`
                <button key=${p.id} type="button" className="preset" aria-pressed=${active === p.id} onClick=${() => onPick(p)}>
                  ${active === p.id && html`<${motion.span} layoutId="preset-active" className="preset-bg" transition=${SPRING} />`}
                  <span className="preset-title">${p.n} · ${p.title}</span>
                  <span className="preset-detail">${p.detail}</span>
                </button>`)}
            </div>
          <//>
        </div>
      </section>`;
  }

  function Switch({ checked, onChange, label }) {
    return html`
      <button type="button" role="switch" aria-checked=${checked} aria-label=${label} className="switch" onClick=${() => onChange(!checked)}>
        <span className="switch-track"><${motion.span} layout className="switch-knob" transition=${SPRING} aria-hidden="true">${checked ? '🔒' : ''}<//></span>
      </button>`;
  }

  function PageIntro({ num, title, lede, tag }) {
    return html`
      <header className="page-intro">
        <span className="page-num" aria-hidden="true">${num}</span>
        <div>
          <h1 className="page-title">${title}</h1>
          <p className="page-lede">${lede}</p>
        </div>
        ${tag && html`<span className="tag">${tag}</span>`}
      </header>`;
  }

  function NextChapter({ to, kicker, title, onNavigate }) {
    return html`
      <${motion.button} type="button" className="next-chapter" onClick=${() => onNavigate(to)} whileHover="hover" initial="rest" animate="rest">
        <span><span className="eyebrow" style=${{ display: 'block', marginBottom: 6 }}>${kicker}</span><span className="serif">${title}</span></span>
        <${motion.span} className="arrow" aria-hidden="true" variants=${{ rest: { x: 0 }, hover: { x: 8 } }} transition=${SPRING}>→<//>
      <//>`;
  }

  /* ═════════════ Page 01 · Landing (Manifesto & Services) ═════════════ */
  function LandingPage({ r, input, onNavigate }) {
    const rootRef = useRef(null);
    const calm = useCalm();
    const concert = useMemo(() => simulatePurchase(input, 800), [input]);

    // GSAP runway reveals: masked headline lines, then staggered sections on scroll.
    useEffect(() => {
      if (calm || !gsap || !ScrollTrigger || !rootRef.current) return undefined;
      const ctx = gsap.context(() => {
        gsap.from('.l-headline .line > span', { yPercent: 110, duration: 1.1, ease: 'power4.out', stagger: 0.12, delay: 0.1 });
        gsap.from('.l-hero-anim', { y: 26, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.1, delay: 0.4 });
        gsap.utils.toArray('.l-reveal-group').forEach((group) => {
          gsap.from(group.querySelectorAll('.rv'), {
            y: 48, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.12,
            scrollTrigger: { trigger: group, start: 'top 85%', once: true },
          });
        });
      }, rootRef);
      const refresh = setTimeout(() => ScrollTrigger.refresh(), 700);
      return () => { clearTimeout(refresh); ctx.revert(); };
    }, [calm]);

    const services = [
      { id: 'pacer', n: '01', title: 'The Daily Safe-to-Spend Pacer', copy: 'One calm number every morning, backed by transparent math you can open with a tap.', stat: safeRupees(r.headlineDaily) + '/day today' },
      { id: 'vault', n: '02', title: 'The Virtual Bill Vault', copy: 'Mandatory rent and bills locked in an untouchable sandbox before you spend a rupee.', stat: '🔒 ' + rupees(r.vaultReserved) + ' locked', vault: true },
      { id: 'chaos', n: '03', title: 'Chaos Auto-Rebalance & Bridge Mode', copy: "Overspent today? Zero shaming. Your Vault stays 100% locked while tomorrow's pace quietly recalibrates.", stat: WEATHER[r.weather].label },
      { id: 'simulator', n: '04', title: '“Can I Afford This?” Simulator', copy: 'Preview how any purchase reshapes your day-by-day money timeline before you buy it.', stat: concert.verdict === 'breach' ? '₹800 ticket → wait for payday' : '₹800 ticket → ' + safeRupees(concert.after.headlineDaily) + '/day' },
    ];
    const ticker = ['Money In', 'Mandatory Bills — The Vault', 'Fun Money', 'Safe-to-Spend Today', 'Zero jargon', 'Zero shame'];

    return html`
      <div className="landing" ref=${rootRef}>
        <section className="wrap l-hero" aria-labelledby="l-title">
          <div className="l-meta" aria-hidden="true">
            <span>Issue Nº 01 — The Income Stabilizer</span>
            <span>For students, freelancers & gig creators</span>
            <span>Calm & Clear · Universal Design</span>
          </div>
          <div className="l-hero-grid">
            <div>
              <h1 id="l-title" className="l-headline">
                <span className="line"><span>Financial quietude</span></span>
                <span className="line"><span><em>for irregular lives.</em></span></span>
              </h1>
              <p className="l-lede l-hero-anim">Stipends land late. Gigs pay whenever. Translate-My-Pay locks your bills away first, then turns whatever is left into one calm number: what you can safely spend today.</p>
              <div className="l-cta-row l-hero-anim">
                <${motion.button} type="button" className="btn btn-ink l-cta" onClick=${() => onNavigate('pacer')} whileHover=${{ y: -2 }} whileTap=${{ scale: 0.97 }} transition=${SPRING}>Enter the Studio →<//>
                <button type="button" className="l-textlink" onClick=${() => { const el = document.getElementById('manifesto'); if (el) el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth' }); }}>Read the manifesto ↓</button>
              </div>
            </div>
            <button type="button" className="l-preview l-hero-anim" onClick=${() => onNavigate('pacer')} aria-label=${'Live preview: safe to spend ' + safeRupees(r.headlineDaily) + ' per day. Open the Daily Pacer.'}>
              <span className="l-preview-top">
                <span className="eyebrow l-live-dot">Live · Safe-to-Spend</span>
                <${WeatherBadge} weather=${r.weather} />
              </span>
              <span className="l-preview-number" aria-hidden="true"><span className="cur">₹</span><${AnimatedNumber} value=${Math.floor(Math.max(0, r.headlineDaily))} /><span className="per">/day</span></span>
              <span className="l-preview-formula">${rupees(r.totalMoneyIn)} in − ${rupees(r.vaultReserved)} vault − ${rupees(r.priorDaysSpent + r.spentToday)} spent · ${plural(r.daysLeft, 'day')} to payout</span>
              <span className="l-preview-go">Open the Pacer →</span>
            </button>
          </div>
        </section>

        <div className="l-ticker" aria-hidden="true">
          <div className="l-ticker-track">${ticker.concat(ticker).map((t, i) => html`<span key=${i}>${t}</span>`)}</div>
        </div>

        <section className="wrap l-section l-reveal-group" id="manifesto" aria-labelledby="need-title">
          <div className="l-section-head rv">
            <span className="eyebrow">The Core Need</span>
            <h2 id="need-title" className="l-section-title">Most money apps assume a salary on the <em>first of the month.</em></h2>
          </div>
          <div className="l-spread">
            <article className="l-col broken rv">
              <span className="eyebrow kicker">Why Traditional Apps Break</span>
              <h3>Built for the <em>salaried</em> calendar.</h3>
              <ol>
                <li><div><strong>One payday a month</strong><span>Budgets assume a fixed salary on the 1st. Stipends, allowances and gig payouts never arrive on schedule.</span></div></li>
                <li><div><strong>Spreadsheets & jargon</strong><span>Categories, ledgers and percentages that turn checking your balance into homework.</span></div></li>
                <li><div><strong>Shame after one slip</strong><span>Red warnings for one bad day, and no plan for the days that are left.</span></div></li>
              </ol>
            </article>
            <article className="l-col philosophy rv">
              <span className="eyebrow kicker">The Translate-My-Pay Philosophy</span>
              <h3>Built for <em>irregular</em> lives.</h3>
              <ol>
                <li><div><strong>Bills first, always</strong><span>Rent, phone and mess are locked in the Vault the moment money lands.</span></div></li>
                <li><div><strong>One calm number</strong><span>Every morning: what you can safely spend today, with the math one tap away.</span></div></li>
                <li><div><strong>Recalibrate, never shame</strong><span>Overspend and the engine quietly spreads the difference across the days left.</span></div></li>
              </ol>
            </article>
          </div>
        </section>

        <section className="wrap l-section l-reveal-group" aria-labelledby="services-title">
          <div className="l-section-head rv">
            <span className="eyebrow">The Four Signature Services</span>
            <h2 id="services-title" className="l-section-title">One engine, <em>four</em> quiet tools.</h2>
          </div>
          <div className="l-lookbook">
            ${services.map((s) => html`
              <button key=${s.id} type="button" className=${'l-service rv' + (s.vault ? ' vault-look' : '')} onClick=${() => onNavigate(s.id)}>
                <span className="l-service-num" aria-hidden="true">${s.n}</span>
                <span className="eyebrow">${s.n} / Service</span>
                <h3>${s.title}</h3>
                <p>${s.copy}</p>
                <span className="l-service-foot"><span className="num">${s.stat}</span><span className="go">Open →</span></span>
              </button>`)}
          </div>
        </section>

        <section className="l-formula l-reveal-group" aria-labelledby="formula-title">
          <div className="wrap l-formula-inner">
            <span className="eyebrow rv">The whole method, in one line</span>
            <p className="l-formula-eq rv" aria-label=${'Money In ' + rupees(r.totalMoneyIn) + ' minus the Vault ' + rupees(r.vaultReserved) + ' minus already spent ' + rupees(r.priorDaysSpent) + ', divided by ' + plural(r.daysLeft, 'day') + ', equals ' + safeRupees(r.initialDailyAllotment) + ' safe to spend today'}>
              <span>Money In <b>${rupees(r.totalMoneyIn)}</b></span><span className="op">−</span>
              <span>The Vault <b>${rupees(r.vaultReserved)}</b></span><span className="op">−</span>
              <span>Already Spent <b>${rupees(r.priorDaysSpent)}</b></span><span className="op">÷</span>
              <span>Days Left <b>${r.daysLeft}</b></span><span className="op">=</span>
              <span>Safe-to-Spend Today <b>${safeRupees(r.initialDailyAllotment)}</b></span>
            </p>
            <h2 id="formula-title" className="l-quote rv">One calm number. <em>Every morning.</em></h2>
            <${motion.button} type="button" className="btn rv" onClick=${() => onNavigate('pacer')} whileHover=${{ y: -2 }} whileTap=${{ scale: 0.97 }} transition=${SPRING}>Enter the Studio →<//>
          </div>
        </section>
      </div>`;
  }

  /* ═════════════ Page 02 · Daily Pacer & Show Your Work ═════════════ */
  function Hero({ r, mathOpen, onToggleMath }) {
    const w = WEATHER[r.weather];
    const limit = Math.floor(r.initialDailyAllotment);
    const fill = r.initialDailyAllotment > 0 ? Math.min(1, r.spentToday / r.initialDailyAllotment) : r.spentToday > 0 ? 1 : 0;
    const eyebrow = r.isBridge ? 'Safe-to-Spend · Bridge Mode' : r.isOverspend ? 'Safe-to-Spend · rebalanced from tomorrow' : 'Safe-to-Spend Today';
    const srText = r.isBridge
      ? 'Safe to spend: ₹0 per day. Bridge Mode, short by ' + rupees(r.shortfall) + '.'
      : 'Safe to spend: ' + safeRupees(r.headlineDaily) + ' per day' + (r.isOverspend ? ' from tomorrow, after rebalancing' : ' today') + '. Weather: ' + w.label + '.';
    return html`
      <section className="card hero" aria-labelledby="hero-label">
        <p id="hero-label" className="eyebrow">${eyebrow}</p>
        <${motion.button} type="button" className="hero-number" onClick=${onToggleMath} aria-expanded=${mathOpen} aria-controls="math-drawer"
          whileHover=${{ y: -3, scale: 1.015 }} whileTap=${{ scale: 0.97 }} transition=${SPRING}>
          <span className="sr-only">${srText} ${mathOpen ? 'Hide' : 'Show'} the math.</span>
          <span className="hero-digits" aria-hidden="true"><span className="cur">₹</span><${AnimatedNumber} value=${Math.floor(Math.max(0, r.headlineDaily))} /><span className="per">/day</span></span>
          <span className="hero-hint" aria-hidden="true">Tap number to ${mathOpen ? 'Hide' : 'Show'} the Math <${motion.span} className="arrow" animate=${{ rotate: mathOpen ? 180 : 0 }} transition=${SPRING}>↓<//></span>
        <//>
        <p className="weather-line"><${WeatherBadge} weather=${r.weather} /> ${w.line}</p>
        <div className="pacer">
          <div className="pacer-track" role="progressbar" aria-label="Today's spend pacer" aria-valuemin=${0} aria-valuemax=${limit}
            aria-valuenow=${Math.min(Math.round(r.spentToday), limit)} aria-valuetext=${'Spent ' + rupees(r.spentToday) + ' of today’s ' + safeRupees(r.initialDailyAllotment) + ' safe limit'}>
            <${motion.div} className=${'pacer-fill' + (r.isOverspend ? ' over' : '')} initial=${false} animate=${{ scaleX: fill }} transition=${SPRING} />
          </div>
          <div className="pacer-stats">
            <div className="stat"><span className="stat-label">Spent Today</span><${AnimatedRupees} value=${r.spentToday} className="stat-value" /></div>
            <div className="stat"><span className="stat-label">Today's Safe Limit</span><${AnimatedRupees} value=${limit} className="stat-value" /></div>
            <div className="stat">
              ${r.isOverspend
                ? html`<span className="stat-label">Over Today's Pace</span><span className="stat-value alert num">+${rupees(r.todayOverspend)}</span>`
                : html`<span className="stat-label">Remaining Today</span><${AnimatedRupees} value=${Math.floor(Math.max(0, r.safeToSpendToday))} className="stat-value" />`}
            </div>
          </div>
        </div>
      </section>`;
  }

  function mathRows(r) {
    const shortfallRow = { op: '=', label: r.shortfall > 0 ? 'Shortfall to Bridge' : 'Fun Money Used Up', note: r.vaultFullyFunded ? 'Vault untouched — 100% intact' : 'Money In doesn’t fully cover the Vault yet', value: rupees(r.shortfall), cls: 'total' };
    const rows = [
      { op: '', label: 'Total Money In', value: rupees(r.totalMoneyIn) },
      { op: '−', label: 'Reserved in Virtual Vault', note: plural(r.billCount, 'mandatory bill') + ', locked away', value: rupees(r.vaultReserved), cls: 'vault-row' },
      { op: '−', label: 'Already Spent This Cycle', note: 'Earlier days, before today', value: rupees(r.priorDaysSpent) },
    ];
    if (r.isOverspend) {
      rows.push({ op: '−', label: 'Spent Today', note: '+' + rupees(r.todayOverspend) + ' over today’s ' + safeRupees(r.initialDailyAllotment) + ' pace', value: rupees(r.spentToday) });
      rows.push({ op: '=', label: 'Remaining Fun Money', value: rupees(r.remainingFlexible) });
      if (r.isBridge) rows.push(shortfallRow);
      else {
        rows.push({ op: '÷', label: 'Days After Today Until Payout', value: plural(r.daysAfterToday, 'day') });
        rows.push({ op: '=', label: 'Tomorrow’s Rebalanced Daily Safe-to-Spend', note: isWhole(r.rebalancedDaily) ? null : 'Rounded down to the rupee', value: safeRupees(r.rebalancedDaily) + ' / day', cls: 'total' });
      }
    } else {
      rows.push({ op: '=', label: 'Remaining Fun Money', value: rupees(r.startOfDayFlexible) });
      if (r.isBridge) rows.push(shortfallRow);
      else {
        rows.push({ op: '÷', label: 'Days Until Next Payout', value: plural(r.daysLeft, 'day') });
        rows.push({ op: '=', label: 'Daily Safe-to-Spend', note: isWhole(r.initialDailyAllotment) ? null : 'Rounded down to the rupee so you never overshoot', value: safeRupees(r.initialDailyAllotment) + ' / day', cls: 'total' });
      }
    }
    return rows;
  }
  const OP_WORD = { '−': 'Minus ', '÷': 'Divided by ', '=': 'Equals ' };

  function MathDrawer({ r, onDays }) {
    const rows = mathRows(r);
    return html`
      <${motion.section} id="math-drawer" className="card drawer" aria-labelledby="math-title"
        initial=${{ opacity: 0, y: -16, scaleY: 0.96 }} animate=${{ opacity: 1, y: 0, scaleY: 1 }} exit=${{ opacity: 0, y: -16, scaleY: 0.96 }} transition=${SPRING}>
        <div className="section-head"><h2 id="math-title">Show Your Work</h2><span className="tag">Live proof · same engine everywhere</span></div>
        <ol className="math" aria-live="polite">
          ${rows.map((row, i) => html`
            <${motion.li} key=${row.label} className=${row.cls || ''} initial=${{ opacity: 0, x: -10 }} animate=${{ opacity: 1, x: 0 }} transition=${{ ...SPRING, delay: i * 0.04 }}>
              <span className="op" aria-hidden="true">${row.op || '·'}</span>
              <span className="lbl">${OP_WORD[row.op] || ''}${row.label}${row.note && html`<small>${row.note}</small>`}</span>
              <span className="val">${row.value}</span>
            <//>`)}
        </ol>
        ${!r.isOverspend && !r.isBridge && html`
          <p className="today-line">Today so far: <b>${safeRupees(r.initialDailyAllotment)}</b> limit − <b>${rupees(r.spentToday)}</b> spent = <b>${safeRupees(r.safeToSpendToday)}</b> left today.</p>`}
        <div className="math-foot">
          <p className="engine-note">⚙ One shared engine powers this proof, Auto-Rebalance and “Can I Afford This?” — change the days and watch every number follow.</p>
          <div className="stepper">
            <span className="stat-label" id="days-label">Days Until Next Payout</span>
            <div className="stepper-ctrl" role="group" aria-labelledby="days-label">
              <${motion.button} type="button" className="icon-btn" aria-label="One day fewer" disabled=${r.daysLeft <= 1} onClick=${() => onDays(r.daysLeft - 1)} whileTap=${{ scale: 0.9 }}>−<//>
              <output aria-live="polite">${r.daysLeft}</output>
              <${motion.button} type="button" className="icon-btn" aria-label="One day more" disabled=${r.daysLeft >= 30} onClick=${() => onDays(r.daysLeft + 1)} whileTap=${{ scale: 0.9 }}>+<//>
            </div>
            <input type="range" min="1" max="30" step="1" value=${r.daysLeft} onChange=${(e) => onDays(Number(e.target.value))} aria-label="Days until next payout, 1 to 30" />
          </div>
        </div>
      <//>`;
  }

  function PacerPage({ r, onDays, onNavigate }) {
    const [mathOpen, setMathOpen] = useState(false);
    return html`
      <div className="wrap page-main">
        <${PageIntro} num="01" title=${html`The Daily <em>Pacer</em>`} tag="Core loop"
          lede="One number for today, and the full proof behind it. Tap the number to open “Show Your Work”." />
        <div className="stack">
          <${Hero} r=${r} mathOpen=${mathOpen} onToggleMath=${() => setMathOpen((o) => !o)} />
          <${AnimatePresence} initial=${false}>
            ${mathOpen && html`<${MathDrawer} key="math" r=${r} onDays=${onDays} />`}
          <//>
          ${(r.isOverspend || r.isBridge) && html`
            <button type="button" className="calm-note" style=${{ textAlign: 'left', background: 'none', cursor: 'pointer' }} onClick=${() => onNavigate('chaos')}>
              ${r.isBridge ? 'Bridge Mode is active — see calm recovery options in the Chaos Lab →' : 'Today was rebalanced — see the full Auto-Rebalance breakdown in the Chaos Lab →'}
            </button>`}
        </div>
        <${NextChapter} to="vault" kicker="Next · 02" title="The Virtual Vault & Money In" onNavigate=${onNavigate} />
      </div>`;
  }

  /* ═════════════ Page 03 · Vault & Money In ═════════════ */
  function Bento({ r, incomeCount, onNavigate }) {
    const card = { whileHover: { y: -3 }, whileTap: { scale: 0.98 }, transition: SPRING };
    return html`
      <section className="bento" aria-label="Money at a glance">
        <${motion.div} className="metric" ...${card}>
          <span className="stat-label">Money In</span>
          <${AnimatedRupees} value=${r.totalMoneyIn} className="m-value" />
          <span className="m-foot">${plural(incomeCount, 'payment')} logged</span>
        <//>
        <${motion.div} className="metric vault-metric" ...${card}>
          <span className="stat-label">🔒 Mandatory Bills (The Vault)</span>
          <${AnimatedRupees} value=${r.vaultReserved} className="m-value" />
          <span className="m-foot">${plural(r.billCount, 'bill')} locked</span>
        <//>
        <${motion.div} className="metric fun-metric" ...${card}>
          <span className="stat-label">Fun Money Left</span>
          <${AnimatedRupees} value=${Math.max(0, r.remainingFlexible)} className="m-value" />
          <span className="m-foot">of ${rupees(Math.max(0, r.totalFlexiblePool))} this cycle</span>
        <//>
        <${motion.button} type="button" className="metric" onClick=${() => onNavigate('pacer')} ...${card}>
          <span className="stat-label">Safe-to-Spend</span>
          <span className="m-value num">₹<${AnimatedNumber} value=${Math.floor(Math.max(0, r.headlineDaily))} /></span>
          <span className="m-foot">per day · ${plural(r.daysLeft, 'day')} to payout →</span>
        <//>
      </section>`;
  }

  function VaultPanel({ bills, total, onChange }) {
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const edit = (id, patch) => onChange(bills.map((b) => (b.id === id ? { ...b, ...patch } : b)), null);
    const remove = (b) => onChange(bills.filter((x) => x.id !== b.id), 'Removed “' + b.label + '” from the Vault');
    const add = (e) => {
      e.preventDefault();
      const amt = Number(amount);
      if (!name.trim() || !(amt > 0)) return;
      onChange(bills.concat([{ id: uid('bill'), label: name.trim(), amount: String(amt), active: true }]), '🔒 Locked ' + rupees(amt) + ' for “' + name.trim() + '”');
      setName(''); setAmount('');
    };
    return html`
      <section className="panel vault" aria-labelledby="vault-title">
        <div className="panel-head">
          <h2 id="vault-title">Virtual Money Vault<small>Mandatory Bills — paid first, always</small></h2>
          <span className="lock-badge">🔒 STRICTLY ISOLATED FROM DAILY SPEND</span>
        </div>
        <ul className="rows">
          <${AnimatePresence} initial=${false}>
            ${bills.map((b) => html`
              <${motion.li} key=${b.id} layout className=${'row' + (b.active ? '' : ' off')}
                initial=${{ opacity: 0, x: -12 }} animate=${{ opacity: 1, x: 0 }} exit=${{ opacity: 0, x: 12 }} transition=${SPRING}>
                <${Switch} checked=${b.active} onChange=${(v) => edit(b.id, { active: v })} label=${'Lock ' + (b.label || 'this bill') + ' in the Vault'} />
                <input className="field" value=${b.label} onChange=${(e) => edit(b.id, { label: e.target.value.slice(0, 40) })} aria-label="Bill name" />
                <label className="money-field"><span aria-hidden="true">₹</span><input inputMode="numeric" value=${b.amount} onChange=${(e) => edit(b.id, { amount: digitsOnly(e.target.value) })} aria-label=${(b.label || 'Bill') + ' amount in rupees'} /></label>
                <${motion.button} type="button" className="icon-btn" aria-label=${'Remove ' + (b.label || 'bill')} onClick=${() => remove(b)} whileTap=${{ scale: 0.9 }}>×<//>
              <//>`)}
          <//>
        </ul>
        <form className="add-row" onSubmit=${add}>
          <input className="field" placeholder="New bill (e.g. Bus pass)" value=${name} onChange=${(e) => setName(e.target.value.slice(0, 40))} aria-label="New bill name" />
          <label className="money-field"><span aria-hidden="true">₹</span><input inputMode="numeric" placeholder="0" value=${amount} onChange=${(e) => setAmount(digitsOnly(e.target.value))} aria-label="New bill amount in rupees" /></label>
          <button type="submit" className="btn" disabled=${!name.trim() || !(Number(amount) > 0)}>+ Lock bill</button>
        </form>
        <div className="panel-total"><span className="stat-label" style=${{ color: 'var(--vault-muted)' }}>Locked away this cycle</span><${AnimatedRupees} value=${total} /></div>
      </section>`;
  }

  function MoneyInPanel({ incomes, total, onAdd, onRemove }) {
    const [label, setLabel] = useState('');
    const [amount, setAmount] = useState('');
    const [kind, setKind] = useState('Gig');
    const submit = (e) => {
      e.preventDefault();
      const amt = Number(amount);
      if (!label.trim() || !(amt > 0)) return;
      onAdd({ label: label.trim(), amount: amt, kind });
      setLabel(''); setAmount('');
    };
    return html`
      <section className="card panel" aria-labelledby="money-title">
        <div className="panel-head">
          <h2 id="money-title">Money In<small>Irregular stipends, allowances & gig payouts</small></h2>
          <span className="tag">Cash-flow sandbox</span>
        </div>
        <ul className="rows">
          <${AnimatePresence} initial=${false}>
            ${incomes.map((i) => html`
              <${motion.li} key=${i.id} layout className="income-row"
                initial=${{ opacity: 0, x: -12 }} animate=${{ opacity: 1, x: 0 }} exit=${{ opacity: 0, x: 12 }} transition=${SPRING}>
                <span className="lbl">${i.label}<span className="kind">${i.kind}</span></span>
                <span className="num">${rupees(Number(i.amount) || 0)}</span>
                <${motion.button} type="button" className="icon-btn" aria-label=${'Remove ' + i.label} onClick=${() => onRemove(i)} whileTap=${{ scale: 0.9 }}>×<//>
              <//>`)}
          <//>
        </ul>
        ${incomes.length === 0 && html`<p className="empty">No Money In logged yet.</p>`}
        <p className="stat-label" style=${{ marginTop: 18 }}>Quick-log</p>
        <div className="quick-grid">
          ${QUICK_INCOME.map((q) => html`
            <${motion.button} key=${q.label} type="button" className="quick" onClick=${() => onAdd(q)} whileHover=${{ y: -2 }} whileTap=${{ scale: 0.97 }} transition=${SPRING}>
              <strong>${q.label}</strong><span className="num">+${rupees(q.amount)}</span>
            <//>`)}
        </div>
        <form className="income-add" onSubmit=${submit}>
          <input className="field grow" placeholder="Where's it from?" value=${label} onChange=${(e) => setLabel(e.target.value.slice(0, 40))} aria-label="Money In source" />
          <label className="money-field"><span aria-hidden="true">₹</span><input inputMode="numeric" placeholder="0" value=${amount} onChange=${(e) => setAmount(digitsOnly(e.target.value))} aria-label="Money In amount in rupees" /></label>
          <select className="field" value=${kind} onChange=${(e) => setKind(e.target.value)} aria-label="Money In type">
            <option>Gig</option><option>Stipend</option><option>Allowance</option><option>Top-up</option>
          </select>
          <button type="submit" className="btn btn-forest" disabled=${!label.trim() || !(Number(amount) > 0)}>+ Add</button>
        </form>
        <div className="panel-total"><span className="stat-label">Total Money In</span><${AnimatedRupees} value=${total} /></div>
      </section>`;
  }

  function VaultPage({ plan, r, onBills, onAddIncome, onRemoveIncome, onNavigate }) {
    return html`
      <div className="wrap page-main">
        <${PageIntro} num="02" title=${html`The Virtual <em>Vault</em> & Money In`} tag="Cash-flow sandbox"
          lede="Bills are locked away first. Whatever lands after that — stipend, allowance, a surprise gig — becomes Fun Money." />
        <div className="stack">
          <${Bento} r=${r} incomeCount=${plan.incomes.length} onNavigate=${onNavigate} />
          <div className="panels">
            <${VaultPanel} bills=${plan.bills} total=${r.vaultReserved} onChange=${onBills} />
            <${MoneyInPanel} incomes=${plan.incomes} total=${r.totalMoneyIn} onAdd=${onAddIncome} onRemove=${onRemoveIncome} />
          </div>
        </div>
        <${NextChapter} to="chaos" kicker="Next · 03" title="The Chaos Lab & Auto-Rebalance" onNavigate=${onNavigate} />
      </div>`;
  }

  /* ═════════════ Page 04 · Chaos Lab & Auto-Rebalance ═════════════ */
  function RebalanceBanner({ r }) {
    return html`
      <${motion.section} key="rebalance" className="banner" role="status" aria-live="polite"
        initial=${{ opacity: 0, y: 14 }} animate=${{ opacity: 1, y: 0 }} exit=${{ opacity: 0, y: -10, transition: QUICK_EXIT }} transition=${SPRING}>
        <h2><${Shape} shape=${WEATHER[r.weather].shape} size=${18} /> Auto-Rebalance applied — no harm done</h2>
        <p>You spent <b>${rupees(r.spentToday)}</b> today (<b>${rupees(r.todayOverspend)}</b> over today's <b>${safeRupees(r.initialDailyAllotment)}</b> pace). Your <b>${rupees(r.vaultReserved)}</b> Bill Vault is 100% untouched. We smoothly rebalanced your remaining <b>${rupees(r.remainingFlexible)}</b> across the <b>${r.daysAfterToday}</b> remaining ${r.daysAfterToday === 1 ? 'day' : 'days'} → New Safe-to-Spend: <b>${safeRupees(r.rebalancedDaily)}/day</b>.</p>
        <div className="chips">
          <span className="chip">Today's Overspend <span className="num">+${rupees(r.todayOverspend)}</span></span>
          <span className="chip">Tomorrow's Rebalanced Daily <span className="num">${safeRupees(r.rebalancedDaily)}/day</span></span>
          <span className="chip">🔒 Vault <span className="num">${rupees(r.vaultReserved)}</span> untouched</span>
        </div>
      <//>`;
  }

  function BridgePanel({ r, lastSpend, onUndo, onTopUp }) {
    return html`
      <${motion.section} key="bridge" className="banner" role="status" aria-live="polite"
        initial=${{ opacity: 0, y: 14 }} animate=${{ opacity: 1, y: 0 }} exit=${{ opacity: 0, y: -10, transition: QUICK_EXIT }} transition=${SPRING}>
        <div className="bridge-grid">
          <div>
            <h2><${Shape} shape="arch" size=${18} /> <span aria-hidden="true">🌉</span> Bridge Mode — a calm path to payday</h2>
            <p>
              ${r.shortfall > 0
                ? html`Your Fun Money is at <b>₹0</b> and this cycle is <b>${rupees(r.shortfall)}</b> short, with <b>${plural(r.daysLeft, 'day')}</b> to your next payout. `
                : 'You’ve used every rupee of this cycle’s Fun Money — exactly on the line, nothing borrowed. '}
              ${r.vaultFullyFunded
                ? html`Your <b>${rupees(r.vaultReserved)}</b> Bill Vault is <strong>100% untouched</strong> — rent, phone and mess are still covered.`
                : html`Your Money In (<b>${rupees(r.totalMoneyIn)}</b>) doesn't fully cover your Vault bills (<b>${rupees(r.vaultReserved)}</b>) yet — log Money In to close that <b>${rupees(r.vaultGap)}</b> gap first.`}
            </p>
          </div>
          <div className="bridge-short"><span className="stat-label">Exact shortfall</span><${AnimatedRupees} value=${r.shortfall} /></div>
        </div>
        <div className="bridge-actions">
          ${lastSpend && html`<${motion.button} type="button" className="btn" onClick=${onUndo} whileHover=${{ y: -2 }} whileTap=${{ scale: 0.96 }} transition=${SPRING}>↩ Undo “${lastSpend.label}” (−${rupees(lastSpend.amount)})<//>`}
          ${r.shortfall > 0 && html`<${motion.button} type="button" className="btn btn-forest" onClick=${onTopUp} whileHover=${{ y: -2 }} whileTap=${{ scale: 0.96 }} transition=${SPRING}>Cover ${rupees(r.shortfall)} with a refund or top-up<//>`}
          <span className="chip">🔒 Vault stays locked — adjustments never touch it</span>
        </div>
      <//>`;
  }

  function SpendPanel({ r, spends, onLog, onRemove, onNextDay }) {
    const [amount, setAmount] = useState('');
    const [label, setLabel] = useState('');
    const submit = (e) => {
      e.preventDefault();
      const amt = Number(amount);
      if (!(amt > 0)) return;
      onLog({ label: label.trim() || 'Everyday spend', amount: amt });
      setAmount(''); setLabel('');
    };
    return html`
      <section className="card spend" aria-labelledby="spend-title">
        <div className="section-head"><h2 id="spend-title">Log Today's Spend</h2><span className="tag">Chaos & auto-rebalance</span></div>
        <div className="spend-grid">
          <div>
            <form className="spend-form" onSubmit=${submit}>
              <label className="money-field"><span aria-hidden="true">₹</span><input inputMode="numeric" placeholder="0" value=${amount} onChange=${(e) => setAmount(digitsOnly(e.target.value))} aria-label="Amount spent in rupees" /></label>
              <input className="field" placeholder="What for? (optional)" value=${label} onChange=${(e) => setLabel(e.target.value.slice(0, 40))} aria-label="What the money was spent on" />
              <button type="submit" className="btn btn-ink" disabled=${!(Number(amount) > 0)}>Log spend</button>
            </form>
            <div className="chaos">
              <${motion.button} type="button" className="chaos-btn big" onClick=${() => onLog({ label: 'Impulse spend', amount: 1000 })} whileHover=${{ y: -2 }} whileTap=${{ scale: 0.98 }} transition=${SPRING}>
                <span>⚡ Log ₹1,000 Impulse Spend on a ${safeRupees(r.initialDailyAllotment)} Day</span>
                <span className="num">Watch Auto-Rebalance protect the Vault</span>
              <//>
              ${CHAOS_ITEMS.map((c) => html`
                <${motion.button} key=${c.label} type="button" className="chaos-btn" onClick=${() => onLog(c)} whileHover=${{ y: -2 }} whileTap=${{ scale: 0.97 }} transition=${SPRING}>
                  <span>${c.label}</span><span className="num">+${rupees(c.amount)}</span>
                <//>`)}
            </div>
          </div>
          <div>
            <p className="stat-label" style=${{ marginBottom: 8 }}>Today's spending · <span className="num">${rupees(r.spentToday)}</span></p>
            <ul className="spend-list">
              <${AnimatePresence} initial=${false}>
                ${spends.map((s) => html`
                  <${motion.li} key=${s.id} layout className="spend-item"
                    initial=${{ opacity: 0, y: -8 }} animate=${{ opacity: 1, y: 0 }} exit=${{ opacity: 0, x: 16 }} transition=${SPRING}>
                    <span className="lbl">${s.label}</span><span className="num">${rupees(s.amount)}</span>
                    <${motion.button} type="button" className="icon-btn" aria-label=${'Remove ' + s.label} onClick=${() => onRemove(s)} whileTap=${{ scale: 0.9 }}>×<//>
                  <//>`)}
              <//>
            </ul>
            ${spends.length === 0 && html`<p className="empty">Nothing spent yet today.</p>`}
            <div className="next-day">
              <span>
                ${r.daysLeft > 1
                  ? html`Done for today? Today's spending joins “Already Spent” and <b className="num">${plural(r.daysLeft - 1, 'day')}</b> remain. Tomorrow's limit will be exactly <b className="num">${safeRupees(r.dailyFromTomorrow)}</b>.`
                  : 'Payout is due after today. Log the new payment on the Vault & Money In page, then set the days until the next one in the Pacer.'}
              </span>
              <${motion.button} type="button" className="btn" onClick=${onNextDay} disabled=${r.daysLeft <= 1} whileTap=${{ scale: 0.96 }}>Start Tomorrow →<//>
            </div>
          </div>
        </div>
      </section>`;
  }

  function ChaosPage({ r, plan, onLog, onRemoveSpend, onNextDay, onUndo, onTopUp, onNavigate }) {
    const lastSpend = plan.todaySpends[plan.todaySpends.length - 1] || null;
    return html`
      <div className="wrap page-main">
        <${PageIntro} num="03" title=${html`The Chaos <em>Lab</em>`} tag="Overspend & recovery"
          lede="Real life is messy. Log a spend, trigger chaos, and watch the engine rebalance — or bridge calmly — without ever touching the Vault." />
        <div className="stack">
          <section className="bento" aria-label="Live consequences">
            <div className="metric"><span className="stat-label">Safe-to-Spend</span><span className="m-value num">₹<${AnimatedNumber} value=${Math.floor(Math.max(0, r.headlineDaily))} /></span><span className="m-foot">${r.isOverspend ? 'per day from tomorrow' : 'per day today'}</span></div>
            <div className="metric fun-metric"><span className="stat-label">Fun Money Left</span><${AnimatedRupees} value=${Math.max(0, r.remainingFlexible)} className="m-value" /><span className="m-foot">${plural(r.daysLeft, 'day')} to payout</span></div>
            <div className="metric"><span className="stat-label">Spent Today</span><${AnimatedRupees} value=${r.spentToday} className="m-value" /><span className="m-foot">limit ${safeRupees(r.initialDailyAllotment)}</span></div>
            <div className="metric vault-metric"><span className="stat-label">🔒 The Vault</span><${AnimatedRupees} value=${r.vaultReserved} className="m-value" /><span className="m-foot">${r.vaultFullyFunded ? '100% untouched' : 'not fully funded yet'}</span></div>
          </section>
          <${AnimatePresence} mode="wait" initial=${false}>
            ${r.isBridge
              ? html`<${BridgePanel} key="bridge" r=${r} lastSpend=${lastSpend} onUndo=${onUndo} onTopUp=${onTopUp} />`
              : r.isOverspend
                ? html`<${RebalanceBanner} key="rebalance" r=${r} />`
                : html`<${motion.p} key="calm" className="calm-note" initial=${{ opacity: 0 }} animate=${{ opacity: 1 }} exit=${{ opacity: 0, transition: QUICK_EXIT }}>All calm — you're within today's pace. Try the ⚡ impulse button below to see Auto-Rebalance in action.<//>`}
          <//>
          <${SpendPanel} r=${r} spends=${plan.todaySpends} onLog=${onLog} onRemove=${onRemoveSpend} onNextDay=${onNextDay} />
        </div>
        <${NextChapter} to="simulator" kicker="Next · 04" title="“Can I Afford This?” Simulator" onNavigate=${onNavigate} />
      </div>`;
  }

  /* ═════════════ Page 05 · Can I Afford This? ═════════════ */
  function Timeline({ before, after, showAfter }) {
    const days = before.trajectory.length;
    const max = Math.max(1, ...before.trajectory, ...(showAfter ? after.trajectory : []));
    const showValues = days <= 12;
    return html`
      <figure className="timeline">
        <figcaption>
          <span className="serif">Money Timeline · ${plural(days, 'day')} to payday</span>
          <span className="tl-legend">
            <span><i className="sw now" aria-hidden="true"></i> Current trajectory</span>
            ${showAfter && html`<span><i className="sw after" aria-hidden="true"></i> After purchase</span>`}
          </span>
        </figcaption>
        <div className="tl-scroll">
          <div className="tl-grid" aria-hidden="true" style=${{ gridTemplateColumns: 'repeat(' + days + ', minmax(34px, 1fr)) 56px' }}>
            ${before.trajectory.map((v, i) => html`
              <div className="tl-day" key=${i}>
                ${showValues && html`<span className="tl-val">${safeRupees(v)}${showAfter ? ' → ' + safeRupees(after.trajectory[i]) : ''}</span>`}
                <div className="tl-bars">
                  <${motion.div} className="bar now" initial=${{ scaleY: 0 }} animate=${{ scaleY: Math.max(0.01, v / max) }} transition=${{ ...SPRING, delay: i * 0.025 }} />
                  ${showAfter && html`<${motion.div} className="bar after" initial=${{ scaleY: 0 }} animate=${{ scaleY: Math.max(0.01, after.trajectory[i] / max) }} transition=${{ ...SPRING, delay: i * 0.025 + 0.06 }} />`}
                </div>
                <span className="tl-label">${i === 0 ? 'Today' : 'D' + (i + 1)}</span>
              </div>`)}
            <div className="payday"><div className="payday-flag"></div><span className="tl-label">Payday</span></div>
          </div>
        </div>
        <table className="sr-only">
          <caption>Daily safe-to-spend, day by day until payday</caption>
          <thead><tr><th scope="col">Day</th><th scope="col">Current</th>${showAfter && html`<th scope="col">After purchase</th>`}</tr></thead>
          <tbody>
            ${before.trajectory.map((v, i) => html`<tr key=${i}><th scope="row">${i === 0 ? 'Today' : 'Day ' + (i + 1)}</th><td>${safeRupees(v)}</td>${showAfter && html`<td>${safeRupees(after.trajectory[i])}</td>`}</tr>`)}
          </tbody>
        </table>
      </figure>`;
  }

  function verdictCopy(sim, name) {
    const { before, after } = sim;
    const from = safeRupees(before.headlineDaily) + '/day';
    const to = safeRupees(after.headlineDaily) + '/day';
    const days = 'the remaining ' + plural(sim.daysAffected, 'day');
    const vault = rupees(before.vaultReserved);
    switch (sim.verdict) {
      case 'safe':
        return { tone: 'green', shape: 'circle', title: 'Safe — go for it', body: html`You can afford ${name} without touching your <b>${vault}</b> Bill Vault. Your Daily Safe-to-Spend only moves from <b>${from}</b> to <b>${to}</b> for ${days}.` };
      case 'caution':
        return { tone: 'yellow', shape: 'triangle', title: 'Caution — your pace changes', body: html`Yes, you can afford this without touching your <b>${vault}</b> Bill Vault, BUT your Daily Safe-to-Spend will drop from <b>${from}</b> to <b>${to}</b> for ${days}.` };
      case 'tight':
        return { tone: 'red', shape: 'octagon', title: 'Tight — technically yes', body: html`Your <b>${vault}</b> Bill Vault stays untouched, BUT your Daily Safe-to-Spend would fall from <b>${from}</b> to <b>${to}</b> for ${days}. That's freeze territory — consider waiting for payday.` };
      case 'breach':
        return { tone: 'red', shape: 'octagon', title: 'Vault Breach Warning', body: html`Not right now — buying ${name} would dip <b>${rupees(sim.vaultBreach)}</b> into your Mandatory Bill Vault. Wait until your next payout in <b>${plural(before.daysLeft, 'day')}</b>.` };
      case 'bridge':
        return { tone: 'bridge', shape: 'arch', title: 'Let’s bridge first', body: html`You're in Bridge Mode${before.shortfall > 0 ? ' with a ' + rupees(before.shortfall) + ' shortfall' : ''}, so any purchase would come out of your Vault. Wait until your next payout in <b>${plural(before.daysLeft, 'day')}</b> — your bills stay protected.` };
      default:
        return { tone: 'idle', shape: 'circle', title: 'Enter a price to see the forecast', body: 'Type what you want and its price — the forecast updates instantly using the same engine as Show Your Work.' };
    }
  }

  function SimulatorPage({ input, onNavigate }) {
    const [item, setItem] = useState('Concert Ticket');
    const [price, setPrice] = useState('800');
    const sim = useMemo(() => simulatePurchase(input, Number(price) || 0), [input, price]);
    const v = verdictCopy(sim, item.trim() || 'this');
    const showAfter = sim.verdict !== 'idle' && sim.verdict !== 'bridge';
    return html`
      <div className="wrap page-main">
        <${PageIntro} num="04" title=${html`Can I <em>Afford</em> This?`} tag="Decision simulator · nothing is logged"
          lede="Name a purchase and its price. The same engine forecasts exactly what it does to every day until payday." />
        <section className="card sim" aria-labelledby="sim-title">
          <h2 id="sim-title" className="sr-only">Purchase forecast</h2>
          <div className="sim-form">
            <input className="field" value=${item} onChange=${(e) => setItem(e.target.value.slice(0, 40))} placeholder="What do you want to buy?" aria-label="Item name" />
            <label className="money-field"><span aria-hidden="true">₹</span><input inputMode="numeric" value=${price} onChange=${(e) => setPrice(digitsOnly(e.target.value))} placeholder="0" aria-label="Item price in rupees" /></label>
          </div>
          <div className="sim-chips" role="group" aria-label="Quick test items">
            ${SIM_CHIPS.map((c) => {
              const on = item === c.item && Number(price) === c.price;
              return html`<${motion.button} key=${c.item} type="button" className="sim-chip" aria-pressed=${on} onClick=${() => { setItem(c.item); setPrice(String(c.price)); }} whileTap=${{ scale: 0.95 }}>${c.item} · <span className="num">${rupees(c.price)}</span><//>`;
            })}
          </div>
          <${AnimatePresence} mode="wait">
            <${motion.div} key=${sim.verdict} className=${'verdict tone-' + v.tone} role="status" aria-live="polite"
              initial=${{ opacity: 0, y: 10 }} animate=${{ opacity: 1, y: 0 }} exit=${{ opacity: 0, y: -8, transition: QUICK_EXIT }} transition=${SPRING}>
              <h3><${Shape} shape=${v.shape} size=${20} /> ${v.title}</h3>
              <p>${v.body}</p>
              ${showAfter && html`
                <div className="chips">
                  <span className="chip">Now <span className="num">${safeRupees(sim.before.headlineDaily)}/day</span></span>
                  <span className="chip">After <span className="num">${safeRupees(sim.after.headlineDaily)}/day</span></span>
                  <span className="chip">Fun Money left <span className="num">${rupees(sim.funMoneyLeft)}</span></span>
                  <span className="chip">🔒 Vault <span className="num">${sim.verdict === 'breach' ? '−' + rupees(sim.vaultBreach) : 'untouched'}</span></span>
                </div>`}
            <//>
          <//>
          <${Timeline} before=${sim.before} after=${sim.after} showAfter=${showAfter} />
        </section>
        <${NextChapter} to="landing" kicker="Fin" title="Back to the Manifesto" onNavigate=${onNavigate} />
      </div>`;
  }

  /* ═════════════ App: state, router, transitions ═════════════ */
  const PAGES = ['landing', 'pacer', 'vault', 'chaos', 'simulator'];
  const pageFromHash = () => {
    const h = (window.location.hash || '').replace(/^#\/?/, '');
    return PAGES.indexOf(h) >= 0 ? h : 'landing';
  };

  function App() {
    const [plan, setPlan] = useState(() => PRESETS[0].build());
    const [activePreset, setActivePreset] = useState('baseline');
    const [page, setPage] = useState(pageFromHash);
    const [dark, setDark] = useState(() => store.get('tmp-theme') === 'dark');
    const [calm, setCalm] = useState(() => store.get('tmp-motion') === 'calm');
    const [toast, setToast] = useState(null);

    const input = useMemo(() => toInput(plan), [plan]);
    const r = useMemo(() => computeEngine(input), [input]);

    useEffect(() => {
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
      store.set('tmp-theme', dark ? 'dark' : 'light');
    }, [dark]);
    useEffect(() => {
      document.documentElement.setAttribute('data-motion', calm ? 'calm' : 'full');
      store.set('tmp-motion', calm ? 'calm' : 'full');
    }, [calm]);
    useEffect(() => {
      const onHash = () => setPage(pageFromHash());
      window.addEventListener('hashchange', onHash);
      return () => window.removeEventListener('hashchange', onHash);
    }, []);
    useEffect(() => {
      const label = NAV.find((n) => n.id === page);
      document.title = page === 'landing' ? 'Translate-My-Pay — Financial quietude for irregular lives' : label.label + ' — Translate-My-Pay';
    }, [page]);
    useEffect(() => {
      if (!toast) return undefined;
      const t = setTimeout(() => setToast(null), 3600);
      return () => clearTimeout(t);
    }, [toast]);

    const notify = (text) => setToast({ id: uid('toast'), text });
    const navigate = useCallback((p) => {
      const target = p === 'landing' ? '#/' : '#/' + p;
      if (pageFromHash() === p) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      window.location.hash = target;
    }, []);

    // Every user edit flows through commit(): new plan → same engine → optional toast.
    const commit = (next, message) => {
      setPlan(next);
      setActivePreset(null);
      if (message) {
        const after = computeEngine(toInput(next));
        notify(typeof message === 'function' ? message(after) : message);
      }
    };
    const dailyMsg = (prefix) => (after) => (after.isBridge
      ? prefix + ' → Bridge Mode: ' + rupees(after.shortfall) + ' short, Vault untouched'
      : prefix + ' → Safe-to-Spend ' + safeRupees(after.headlineDaily) + '/day' + (after.isOverspend ? ' from tomorrow' : ''));

    const pickPreset = (p) => { setPlan(p.build()); setActivePreset(p.id); notify('Preset ' + p.n + ': ' + p.title + ' loaded'); };
    const logSpend = (s) => commit({ ...plan, todaySpends: plan.todaySpends.concat([{ id: uid('sp'), label: s.label, amount: s.amount }]) }, dailyMsg('Logged ' + rupees(s.amount) + ' ' + s.label.toLowerCase()));
    const removeSpend = (s) => commit({ ...plan, todaySpends: plan.todaySpends.filter((x) => x.id !== s.id) }, dailyMsg('Removed ' + rupees(s.amount)));
    const addIncome = (i) => commit({ ...plan, incomes: plan.incomes.concat([{ id: uid('in'), label: i.label, amount: String(i.amount), kind: i.kind }]) }, dailyMsg('+' + rupees(i.amount) + ' ' + i.label));
    const removeIncome = (i) => commit({ ...plan, incomes: plan.incomes.filter((x) => x.id !== i.id) }, dailyMsg('Removed ' + i.label));
    const setBills = (bills, message) => commit({ ...plan, bills }, message ? dailyMsg(message) : null);
    const setDays = (d) => commit({ ...plan, daysLeft: Math.min(30, Math.max(1, d)) }, null);
    const nextDay = () => {
      if (plan.daysLeft <= 1) return;
      commit(
        { ...plan, priorDaysSpent: plan.priorDaysSpent + sumAmounts(plan.todaySpends), todaySpends: [], daysLeft: plan.daysLeft - 1 },
        (after) => (after.isBridge ? 'New day · Bridge Mode: ' + rupees(after.shortfall) + ' short' : 'New day · today’s safe limit is ' + safeRupees(after.initialDailyAllotment) + ' — exactly as promised')
      );
    };
    const lastSpend = plan.todaySpends[plan.todaySpends.length - 1] || null;
    const undoLast = () => { if (lastSpend) removeSpend(lastSpend); };
    const topUp = () => addIncome({ label: 'Refund / top-up to bridge shortfall', amount: Math.ceil(r.shortfall), kind: 'Top-up' });
    const toggleMotion = () => { setCalm((c) => !c); notify(calm ? 'Motion: Full — springs and transitions on' : 'Motion: Calm — static transitions'); };
    const skipToMain = (e) => { e.preventDefault(); const m = document.getElementById('main'); if (m) m.focus(); };

    let content;
    if (page === 'pacer') content = html`<${PacerPage} r=${r} onDays=${setDays} onNavigate=${navigate} />`;
    else if (page === 'vault') content = html`<${VaultPage} plan=${plan} r=${r} onBills=${setBills} onAddIncome=${addIncome} onRemoveIncome=${removeIncome} onNavigate=${navigate} />`;
    else if (page === 'chaos') content = html`<${ChaosPage} r=${r} plan=${plan} onLog=${logSpend} onRemoveSpend=${removeSpend} onNextDay=${nextDay} onUndo=${undoLast} onTopUp=${topUp} onNavigate=${navigate} />`;
    else if (page === 'simulator') content = html`<${SimulatorPage} input=${input} onNavigate=${navigate} />`;
    else content = html`<${LandingPage} r=${r} input=${input} onNavigate=${navigate} />`;

    return html`
      <${MotionPref.Provider} value=${calm ? 'calm' : 'full'}>
        <${MotionConfig} reducedMotion=${calm ? 'always' : 'never'}>
          <div className="app" data-weather=${r.weather}>
            <a href="#main" className="skip" onClick=${skipToMain}>Skip to content</a>
            <${Header} page=${page} onNavigate=${navigate} weather=${r.weather} dark=${dark} onToggleTheme=${() => setDark((d) => !d)} calm=${calm} onToggleMotion=${toggleMotion} />
            <${JudgeBar} active=${activePreset} onPick=${pickPreset} />
            <${AnimatePresence} mode="wait" initial=${false} onExitComplete=${() => window.scrollTo({ top: 0, behavior: 'instant' })}>
              <${motion.main} key=${page} id="main" tabIndex=${-1} style=${{ outline: 'none' }}
                initial=${{ opacity: 0, y: 28 }} animate=${{ opacity: 1, y: 0 }} exit=${{ opacity: 0, y: -14 }} transition=${SILK}>
                ${content}
              <//>
            <//>
            <footer className="wrap site-foot">
              <span>Translate-My-Pay — The Freelance & Student Income Stabilizer</span>
              <span>All math runs locally in your browser. Nothing you type leaves this page.</span>
            </footer>
            <div className="toast-wrap" aria-live="polite" aria-atomic="true">
              <${AnimatePresence}>
                ${toast && html`<${motion.div} key=${toast.id} className="toast" initial=${{ opacity: 0, y: 24 }} animate=${{ opacity: 1, y: 0 }} exit=${{ opacity: 0, y: 24 }} transition=${SPRING}>${toast.text}<//>`}
              <//>
            </div>
          </div>
        <//>
      <//>`;
  }

  ReactDOM.createRoot(rootEl).render(html`<${App} />`);
})();
