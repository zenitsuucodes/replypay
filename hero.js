/* ReplyPay hero: global chrome (sidebar, nav, reveal, glass, tilt, search, wallet)
   + animated bento tiles, stats and the weekly cycle. Reads window.RP from core.js. */
(function () {
  "use strict";

  const RP = window.RP;
  if (!RP) return;
  const { $, $$, esc } = RP;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fmtInt = (n) => Math.round(n).toLocaleString("en-US");

  // ---------- visibility helpers: skip work when tab hidden or element off screen ----------
  const onScreen = new WeakMap();
  const visIO = "IntersectionObserver" in window
    ? new IntersectionObserver((es) => es.forEach((e) => onScreen.set(e.target, e.isIntersecting)))
    : null;
  const watch = (el) => { if (el && visIO) { onScreen.set(el, true); visIO.observe(el); } return el; };
  const live = (el) => !document.hidden && (!el || onScreen.get(el) !== false);
  const every = (ms, fn, el) => setInterval(() => { if (live(el)) fn(); }, ms);
  const waitLive = async (el) => { while (!live(el)) await sleep(400); };

  // ======================================================================
  // Global chrome
  // ======================================================================

  // ---------- sidebar collapse ----------
  const app = $("#app");
  const collapseBtn = $("#collapseBtn");
  const SIDE_KEY = "rp:sidebarCollapsed";
  const setCollapsed = (on) => {
    app.classList.toggle("collapsed", on);
    if (collapseBtn) collapseBtn.setAttribute("aria-label", on ? "Expand sidebar" : "Collapse sidebar");
  };
  try { setCollapsed(localStorage.getItem(SIDE_KEY) === "1"); } catch (e) { /* storage blocked */ }
  if (collapseBtn) collapseBtn.addEventListener("click", () => {
    const on = !app.classList.contains("collapsed");
    setCollapsed(on);
    try { localStorage.setItem(SIDE_KEY, on ? "1" : "0"); } catch (e) { /* storage blocked */ }
  });

  // ---------- active nav ----------
  (function () {
    const navItems = $$(".nav-item[data-nav]");
    const setActive = (key) => navItems.forEach((n) => n.classList.toggle("active", n.dataset.nav === key));
    const targets = [[".hero", "top"], ["#explore", "explore"], ["#launch", "launch"], ["#how", "how"], ["#payments", "payments"], ["#fair", "fair"]]
      .map(([sel, key]) => { const el = $(sel); if (el) el.dataset.navKey = key; return el; })
      .filter(Boolean);
    if (!("IntersectionObserver" in window) || !targets.length) return;
    // A thin band around 40% of the viewport decides which section is "current"
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) setActive(e.target.dataset.navKey); });
    }, { rootMargin: "-40% 0px -55% 0px" });
    targets.forEach((t) => io.observe(t));
  })();

  // ---------- scroll reveal (also picks up .reveal nodes added later by other scripts) ----------
  (function () {
    const show = (el) => el.classList.add("in");
    if (reduced || !("IntersectionObserver" in window)) {
      $$(".reveal").forEach(show);
      new MutationObserver(() => $$(".reveal:not(.in)").forEach(show)).observe(document.body, { childList: true, subtree: true });
      return;
    }
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.08, rootMargin: "0px 0px -4% 0px" });
    const vh = () => window.innerHeight || document.documentElement.clientHeight;
    const track = (el) => {
      if (el.classList.contains("in") || el._rpReveal) return;
      el._rpReveal = true;
      const r = el.getBoundingClientRect();
      if (r.top < vh() && r.bottom > 0 && r.width) show(el); // already in view: reveal now
      else io.observe(el);
    };
    $$(".reveal").forEach(track);
    new MutationObserver((muts) => {
      muts.forEach((m) => m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.classList.contains("reveal")) track(n);
        n.querySelectorAll && n.querySelectorAll(".reveal").forEach(track);
      }));
    }).observe(document.body, { childList: true, subtree: true });
  })();

  // ---------- glass specular + tile tilt (one delegated pointer listener, rAF throttled) ----------
  (function () {
    const canTilt = finePointer && !reduced;
    let pending = null, raf = 0, lastTilt = null;
    const resetTilt = () => { if (lastTilt) { lastTilt.style.transform = ""; lastTilt = null; } };
    const frame = () => {
      raf = 0;
      const e = pending;
      if (!e || !(e.target instanceof Element)) return;
      const glass = e.target.closest(".glass");
      if (glass) {
        const r = glass.getBoundingClientRect();
        glass.style.setProperty("--mx", (e.clientX - r.left).toFixed(0) + "px");
        glass.style.setProperty("--my", (e.clientY - r.top).toFixed(0) + "px");
      }
      if (!canTilt) return;
      const tile = e.pointerType === "mouse" ? e.target.closest("[data-tilt]") : null;
      if (tile !== lastTilt) resetTilt();
      if (!tile) return;
      lastTilt = tile;
      tile.classList.add("tilt-on");
      const r = tile.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5;   // -0.5..0.5
      const dy = (e.clientY - r.top) / r.height - 0.5;
      tile.style.transform = `perspective(1000px) rotateX(${(-dy * 6).toFixed(2)}deg) rotateY(${(dx * 6).toFixed(2)}deg) translateY(-3px)`;
    };
    document.addEventListener("pointermove", (e) => { pending = e; if (!raf) raf = requestAnimationFrame(frame); }, { passive: true });
    document.documentElement.addEventListener("mouseleave", resetTilt);
    window.addEventListener("blur", resetTilt);
  })();

  // ---------- search ----------
  (function () {
    const input = $("#searchInput");
    const box = $("#searchResults");
    if (!input || !box) return;
    let items = [], hl = -1;

    const close = () => { box.classList.remove("open"); box.innerHTML = ""; items = []; hl = -1; };
    const highlight = (i) => {
      const rows = $$(".sr-item", box);
      if (!rows.length) return;
      hl = (i + rows.length) % rows.length;
      rows.forEach((r, k) => r.classList.toggle("hl", k === hl));
      rows[hl].scrollIntoView({ block: "nearest" });
    };
    const render = () => {
      const q = input.value.trim().toLowerCase().replace(/^[@$]/, "");
      if (!q) return close();
      const coins = RP.coins.filter((c) => [c.name, c.ticker, c.creator].some((s) => s.toLowerCase().includes(q)))
        .map((c) => ({ kind: "coin", id: c.id, c }));
      const people = (RP.repliers || []).filter((r) => r.handle.toLowerCase().includes(q) || (r.name || "").toLowerCase().includes(q))
        .map((r) => ({ kind: "replier", id: r.handle, r }));
      items = coins.concat(people).slice(0, 8);
      hl = -1;
      box.innerHTML = items.length
        ? items.map((it, i) => it.kind === "coin"
          ? `<div class="sr-item" data-i="${i}" role="option"><span class="sr-art">${RP.coinArt(it.c)}</span><span><b>${esc(it.c.name)}</b> <span class="muted">$${esc(it.c.ticker)}</span></span><small>@${esc(it.c.creator)}</small></div>`
          : `<div class="sr-item" data-i="${i}" role="option">${RP.avatar(it.r.handle)}<span><b>@${esc(it.r.handle)}</b></span><small>${RP.usd(it.r.earned, 0)} earned</small></div>`).join("")
        : `<div class="sr-empty">No coins or handles match "${esc(input.value.trim())}"</div>`;
      box.classList.add("open");
    };
    const choose = (i) => {
      const it = items[i];
      if (!it) return;
      close();
      input.value = "";
      input.blur();
      if (it.kind === "coin") RP.openCoin(it.id);
      else RP.toast(`@${it.r.handle} · ${it.r.wins} wins · ${RP.usd(it.r.earned)} earned`);
    };

    input.addEventListener("input", render);
    input.addEventListener("focus", () => { if (input.value.trim()) render(); });
    input.addEventListener("blur", () => setTimeout(close, 120));
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); highlight(hl + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); highlight(hl - 1); }
      else if (e.key === "Enter") { e.preventDefault(); choose(hl < 0 ? 0 : hl); }
      else if (e.key === "Escape") { close(); input.blur(); }
    });
    // keep focus in the input while clicking a result
    box.addEventListener("mousedown", (e) => e.preventDefault());
    box.addEventListener("click", (e) => {
      e.preventDefault();
      const row = e.target.closest(".sr-item");
      if (row) choose(+row.dataset.i);
    });
    box.addEventListener("mousemove", (e) => {
      const row = e.target.closest(".sr-item");
      if (row && +row.dataset.i !== hl) highlight(+row.dataset.i);
    });
    // "/" focuses search from anywhere (except while typing)
    document.addEventListener("keydown", (e) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t.closest && (t.closest("input, textarea, select, [contenteditable='true']"))) return;
      e.preventDefault();
      input.focus();
    });
  })();

  // ---------- fake wallet (RP.wallet is read by sections.js for vote eligibility) ----------
  (function () {
    const btn = $("#walletBtn");
    const DEMO = {
      address: "7xKpQm4rVb2nH8sLwT1eZcYd9uJfAg3fQa",
      holdings: { studio: 2100000, ratio: 1250000, chef: 420000, cat: 88000 },
    };
    const short = (a) => a.slice(0, 4) + "…" + a.slice(-4);
    const set = (on) => {
      RP.wallet = on
        ? { connected: true, address: DEMO.address, short: short(DEMO.address), holdings: Object.assign({}, DEMO.holdings) }
        : { connected: false, address: null, short: "", holdings: {} };
      if (btn) {
        btn.textContent = on ? short(DEMO.address) : "Connect wallet";
        btn.classList.toggle("is-connected", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      }
      document.dispatchEvent(new CustomEvent("rp:wallet", { detail: RP.wallet }));
    };
    RP.wallet = { connected: false, address: null, short: "", holdings: {} };
    RP.connectWallet = () => { if (!RP.wallet.connected) { set(true); RP.toast("Wallet connected · demo holdings loaded"); } return RP.wallet; };
    RP.disconnectWallet = () => { if (RP.wallet.connected) { set(false); RP.toast("Wallet disconnected"); } };
    if (btn) btn.addEventListener("click", () => (RP.wallet.connected ? RP.disconnectWallet() : RP.connectWallet()));
  })();

  // ---------- live contest count ----------
  (function () {
    const el = $("#liveCount");
    if (!el || reduced) return;
    let n = parseInt(el.textContent, 10) || 41;
    every(17000, () => { if (n < 45 && Math.random() < 0.45) el.textContent = String(++n); }, el);
  })();

  // ======================================================================
  // Bento tiles
  // ======================================================================

  // short "2d 14h" / "9h 12m" label
  const leftLabel = (ms) => {
    const m = Math.max(0, Math.floor(ms / 60000));
    const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
    return d ? `${d}d ${h}h` : `${h}h ${m % 60}m`;
  };
  const weeklyPool = (c) => c.vol7d * RP.CREATOR_FEE * (c.pool / 100);

  // ---------- explore marquee ----------
  (function () {
    const wrap = $("#marqueeCols");
    if (!wrap) return;
    const card = (c) => `
      <div class="mcard">
        <div class="art">${RP.coinArt(c)}
          <span class="age">${c.phase === "voting" ? "Vote · " : ""}${leftLabel(c.endsAt - Date.now())}</span>
          <span class="who">${RP.avatar(c.creator)}@${esc(c.creator)}</span>
        </div>
        <div class="meta"><b>${esc(c.name)}</b><div class="row"><span>$${esc(c.ticker)}</span><b>${RP.usdCompact(weeklyPool(c))}</b><span>${c.pool}% pool</span></div></div>
      </div>`;
    const durs = [44, 38, 52, 47];
    const n = RP.coins.length;
    wrap.innerHTML = durs.map((dur, col) => {
      // each column gets 6 coins in a different order; content doubled so -50% loops seamlessly
      const list = Array.from({ length: 6 }, (_, k) => RP.coins[(col * 2 + k * (col % 2 ? 2 : 1)) % n]);
      const html = list.map(card).join("");
      return `<div class="mcol${col % 2 ? " rev" : ""}" style="--dur:${dur}s" aria-hidden="true">${html}${html}</div>`;
    }).join("");
  })();

  // ---------- reply leaderboard ($STUDIO) ----------
  (function () {
    const list = $("#boardList");
    const coin = RP.coinById("studio");
    if (!list || !coin) return;
    watch(list);
    const ROW = 54, GAP = 8, STEP = ROW + GAP;
    const pool = weeklyPool(coin);
    const all = RP.repliesFor(coin).map((r, i) => Object.assign({ id: i }, r));
    let rows = [], shown = 0;

    const totalLikes = () => all.reduce((s, r) => s + r.likes, 0);
    const fit = () => {
      const h = list.clientHeight;
      if (!h) return 4;
      return Math.max(1, Math.min(5, Math.floor((h + GAP) / STEP)));
    };
    const paint = (animateBump) => {
      const tot = totalLikes();
      const prev = rows.map((r) => r.id);
      rows.sort((a, b) => b.likes - a.likes);
      rows.forEach((r, i) => {
        r.el.style.transform = `translateY(${i * STEP}px)`;
        r.el.querySelector(".rank").textContent = i + 1;
        r.el.querySelector(".likes em").textContent = fmtInt(r.likes);
        r.el.querySelector(".earn").textContent = RP.usd((r.likes / tot) * pool, 0);
        if (animateBump && prev.indexOf(r.id) > i) {
          r.el.classList.add("bump");
          setTimeout(() => r.el.classList.remove("bump"), 1100);
        }
      });
    };
    const build = () => {
      const n = fit();
      if (n === shown) return;
      shown = n;
      list.innerHTML = "";
      rows = all.slice(0, n).sort((a, b) => b.likes - a.likes).map((r) => {
        const el = document.createElement("div");
        el.className = "brow";
        el.innerHTML = `<span class="rank"></span>${RP.avatar(r.handle)}<div class="txt"><b>@${esc(r.handle)}</b><span>${esc(r.text)}</span></div><span class="likes"><svg aria-hidden="true"><use href="#heart"/></svg><em></em></span><span class="earn"></span>`;
        list.appendChild(el);
        r.el = el;
        return r;
      });
      paint(false);
    };
    build();
    requestAnimationFrame(build); // re-measure once layout/fonts settle
    let rt;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(build, 150); });

    if (!reduced) every(2200, () => {
      if (!rows.length) return;
      // favour lower rows so overtakes actually happen
      const sorted = rows.slice().sort((a, b) => b.likes - a.likes);
      const pick = Math.random() < 0.75 && sorted.length > 1 ? sorted[randInt(1, sorted.length - 1)] : sorted[0];
      pick.likes += randInt(40, 260);
      rows.filter((r) => r !== pick).forEach((r) => { if (Math.random() < 0.3) r.likes += randInt(1, 12); });
      paint(true);
    }, list);

    // countdown
    const timer = $("#boardTimer");
    if (timer) {
      const tick = () => { timer.textContent = RP.countdown(coin.endsAt - Date.now()); };
      tick();
      setInterval(() => { if (!document.hidden) tick(); }, 1000);
    }
  })();

  // ---------- holders voting demo ----------
  (function () {
    const box = $("#voteDemo");
    const coin = RP.coinById("chef") || RP.coins[0];
    if (!box || !coin) return;
    watch(box);
    const fins = RP.repliesFor(coin).slice(0, 4);
    let v = [34, 27, 22, 17];

    const rows = fins.map((f) => {
      const r = document.createElement("div");
      r.className = "vd-row";
      r.title = "@" + f.handle;
      r.innerHTML = `${RP.avatar(f.handle)}<div class="vd-bar"><i></i></div><span class="pct"></span>`;
      box.appendChild(r);
      return r;
    });
    const paint = () => {
      const max = Math.max.apply(null, v);
      rows.forEach((r, i) => {
        r.querySelector(".vd-bar i").style.setProperty("--v", ((v[i] / max) * 100).toFixed(1) + "%");
        r.querySelector(".pct").textContent = v[i] + "%";
      });
    };
    paint();
    if (reduced) return;

    const cur = document.createElement("div");
    cur.className = "vd-cursor";
    cur.setAttribute("aria-hidden", "true");
    cur.innerHTML = `<svg viewBox="0 0 24 24"><path d="M5 3.5 19 11l-6.2 1.6L9.6 19z" fill="#fff" stroke="#0a0a0a" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
    box.appendChild(cur);
    const moveTo = (x, y) => { cur.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`; };
    moveTo(box.clientWidth - 40, box.clientHeight - 60);

    // add votes to one row, keep total at exactly 100
    const vote = (i) => {
      const f = v.map((x, k) => (k === i ? x + rand(4, 9) : x * rand(0.9, 0.98)));
      const sum = f.reduce((a, b) => a + b, 0);
      v = f.map((x) => Math.max(5, Math.round((x / sum) * 100)));
      const diff = 100 - v.reduce((a, b) => a + b, 0);
      const big = v.indexOf(Math.max.apply(null, v));
      v[big] += diff;
    };
    let last = -1;
    every(3000, async () => {
      let i;
      do { i = randInt(0, rows.length - 1); } while (i === last);
      last = i;
      const row = rows[i], bar = row.querySelector(".vd-bar");
      moveTo(bar.offsetLeft + bar.offsetWidth * rand(0.35, 0.7), row.offsetTop + row.offsetHeight / 2 - 3);
      await sleep(950);
      cur.classList.add("click");
      row.classList.add("hit");
      vote(i);
      paint();
      await sleep(240);
      cur.classList.remove("click");
      await sleep(700);
      row.classList.remove("hit");
    }, box);
  })();

  // ---------- paid-to-repliers odometer ----------
  (function () {
    const el = $("#odometer");
    if (!el) return;
    watch(el);
    const H = 48;
    const DIGITS = "0123456789".split("").map((d) => `<span>${d}</span>`).join("");
    let value = 486215, shape = "", started = false;
    const fmt = (n) => "$" + fmtInt(n);

    const build = (s) => {
      shape = s.replace(/\d/g, "d");
      el.innerHTML = Array.from(s).map((ch) => (/\d/.test(ch)
        ? `<span class="odo-d" aria-hidden="true"><div>${DIGITS}</div></span>`
        : `<span class="odo-s" aria-hidden="true">${ch}</span>`)).join("");
      void el.offsetWidth; // commit 0-position so the first roll animates
    };
    const render = (n) => {
      const s = fmt(n);
      if (s.replace(/\d/g, "d") !== shape) build(s);
      const cols = $$(".odo-d > div", el);
      let k = 0;
      Array.from(s).forEach((ch) => { if (/\d/.test(ch)) cols[k++].style.transform = `translateY(${-ch * H}px)`; });
      el.setAttribute("aria-label", s + " paid to repliers");
    };
    build(fmt(value));
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", fmt(value) + " paid to repliers");

    const start = () => {
      if (started) return;
      started = true;
      setTimeout(() => render(value), reduced ? 0 : 250);
      if (!reduced) every(2500, () => { value += randInt(12, 380); render(value); }, el);
    };
    if (reduced || !("IntersectionObserver" in window)) return start();
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); start(); } }, { threshold: 0.3 });
    io.observe(el);
  })();

  // ---------- payout bars ----------
  (function () {
    const el = $("#heroBars");
    if (!el) return;
    watch(el);
    const N = 28;
    el.innerHTML = Array.from({ length: N }, () => "<i></i>").join("");
    const bars = $$("i", el);
    const shuffle = () => bars.forEach((b, i) => {
      // gentle upward trend + noise
      const h = Math.min(1, 0.18 + (i / N) * 0.45 + Math.random() * 0.4);
      b.style.setProperty("--h", h.toFixed(2));
    });
    shuffle();
    if (!reduced) every(4000, shuffle, el);
  })();

  // ---------- home post composer (typing loop) ----------
  (function () {
    const typed = $("#cmpTyped"), post = $("#fakePost"), sent = $("#cmpSent");
    if (!typed) return;
    const tile = watch(typed.closest(".tile") || typed);
    const MSGS = [
      "$CHEF is live. Worst cooking fail wins. 50% of fees to the replies 👇",
      "Week 2 of $CHEF. Show me your saddest sandwich. Top 5 replies split the pool 🥪",
      "New week, new post. Quote this with your kitchen disaster. Holders pick the winners 🔥",
    ];
    if (reduced) { typed.textContent = MSGS[0]; return; }
    (async () => {
      let m = 0;
      for (;;) {
        const chars = Array.from(MSGS[m]); // keeps emoji intact
        typed.textContent = "";
        for (const ch of chars) {
          await waitLive(tile);
          typed.textContent += ch;
          await sleep(35 + (ch === " " ? 25 : Math.random() * 20));
        }
        await sleep(700);
        if (post) { post.classList.add("press"); await sleep(180); post.classList.remove("press"); }
        if (sent) sent.classList.add("show");
        await sleep(2000);
        if (sent) sent.classList.remove("show");
        await sleep(350);
        m = (m + 1) % MSGS.length;
      }
    })();
  })();

  // ---------- stats count-up ----------
  (function () {
    const nums = $$(".stat b[data-count]");
    const text = (el, n) => (el.dataset.prefix || "") + fmtInt(n) + (el.dataset.suffix || "");
    const run = (el) => {
      const target = +el.dataset.count || 0;
      if (reduced) { el.textContent = text(el, target); return; }
      const t0 = performance.now(), dur = 1600;
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        el.textContent = text(el, target * (1 - Math.pow(1 - p, 3))); // easeOutCubic
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if (!("IntersectionObserver" in window)) return nums.forEach(run);
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); run(e.target); } });
    }, { threshold: 0.4 });
    nums.forEach((n) => io.observe(n));
  })();

  // ======================================================================
  // Weekly cycle
  // ======================================================================
  (function () {
    const cycle = $("#cycle"), fill = $("#cycleFill");
    const steps = $$(".cstep", cycle || document.createElement("div"));
    if (!cycle || !steps.length) return;
    watch(cycle);
    const N = steps.length, DUR = 3200;
    let idx = 0, elapsed = 0, hovering = false, last = 0;

    const setStep = (i) => { idx = i; steps.forEach((s, k) => s.classList.toggle("active", k === i)); };
    const setFill = (p) => { if (fill) fill.style.width = (p * 100).toFixed(2) + "%"; };
    if (fill) fill.style.transition = reduced ? "none" : "width .3s linear";

    setStep(0);
    setFill(reduced ? 1 / N : 0);

    // hovering a step jumps there; fill sits mid-step so auto-advance resumes without a jump
    steps.forEach((s, i) => s.addEventListener("mouseenter", () => {
      setStep(i);
      elapsed = DUR / 2;
      setFill(reduced ? (i + 1) / N : (i + 0.5) / N);
    }));
    cycle.addEventListener("mouseenter", () => { hovering = true; });
    cycle.addEventListener("mouseleave", () => { hovering = false; last = 0; });
    if (reduced) return;

    // rAF drives a continuous fill: progress = (idx + elapsed/DUR) / N
    const loop = (t) => {
      requestAnimationFrame(loop);
      if (!last) last = t;
      const dt = Math.min(100, t - last);
      last = t;
      if (hovering || !live(cycle)) return;
      elapsed += dt;
      if (elapsed >= DUR) { elapsed = 0; setStep((idx + 1) % N); if (fill && idx === 0) { fill.style.transition = "none"; setFill(0); void fill.offsetWidth; fill.style.transition = "width .3s linear"; } }
      setFill((idx + Math.min(1, elapsed / DUR)) / N);
    };
    requestAnimationFrame(loop);
  })();
})();
