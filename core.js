/* ReplyPay core: shared data + helpers. Loaded first; exposes window.RP.
   Other scripts (hero.js, sections.js, launch.js) read from RP and never redefine it. */
(function () {
  "use strict";

  const BRAND = "ReplyPay";

  // ---------- helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const usd = (n, dp = 2) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const compact = (n) => {
    const a = Math.abs(n);
    if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.0+$/, "") + "M";
    if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "K";
    return String(Math.round(n));
  };
  const usdCompact = (n) => "$" + compact(n);

  // "2d 14:08:31" style countdown from ms
  const countdown = (ms) => {
    if (ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return (d ? d + "d " : "") + h + ":" + m + ":" + sec;
  };
  const ago = (mins) => (mins < 60 ? mins + "m" : mins < 1440 ? Math.floor(mins / 60) + "h" : Math.floor(mins / 1440) + "d");

  // deterministic hash -> palette
  const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const PALETTES = [
    ["#1d9bf0", "#1e3a8a"], ["#a78bfa", "#5b21b6"], ["#34d399", "#065f46"], ["#f472b6", "#9d174d"],
    ["#fbbf24", "#92400e"], ["#fb7185", "#9f1239"], ["#22d3ee", "#155e75"], ["#a3e635", "#3f6212"],
    ["#f97316", "#7c2d12"], ["#818cf8", "#312e81"],
  ];
  const pal = (s) => PALETTES[hash(s) % PALETTES.length];

  // Example people (public X accounts). Photos load live from their public profile.
  const PEOPLE = {
    elonmusk: { name: "Elon Musk", verified: true },
    naval: { name: "Naval", verified: true },
    paulg: { name: "Paul Graham", verified: true },
    sama: { name: "Sam Altman", verified: true },
    VitalikButerin: { name: "vitalik.eth", verified: true },
    pmarca: { name: "Marc Andreessen", verified: true },
    garrytan: { name: "Garry Tan", verified: true },
    balajis: { name: "Balaji", verified: true },
    MrBeast: { name: "MrBeast", verified: true },
    cz_binance: { name: "CZ", verified: true },
    blknoiz06: { name: "Ansem", verified: true },
    nikitabier: { name: "Nikita Bier", verified: true },
  };
  const personName = (h) => (PEOPLE[h] ? PEOPLE[h].name : h);
  const photo = (h) => "https://unavatar.io/x/" + encodeURIComponent(h);

  // Avatar bubble for an X handle: real photo when we know the person, letter fallback otherwise.
  const avatar = (handle, size = "") => {
    const h = handle.replace(/^@/, "");
    const [a, b] = pal(h);
    const letter = esc(h.charAt(0).toUpperCase() || "?");
    const img = PEOPLE[h] ? `<img src="${photo(h)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()" />` : "";
    return `<span class="av ${size}" style="--a:${a};--b:${b}">${letter}${img}</span>`;
  };

  // Generated coin art (no external images). Returns a .coin-art div; parent sets size.
  const coinArt = (coin) => {
    if (coin.img) return `<img src="${esc(coin.img)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover" />`;
    const h = hash(coin.ticker || coin.name || "x");
    const c1 = PALETTES[h % PALETTES.length][0];
    const c2 = PALETTES[(h >>> 3) % PALETTES.length][0];
    const c3 = PALETTES[(h >>> 6) % PALETTES.length][1];
    const label = esc(coin.emoji || (coin.ticker || "?").slice(0, 3));
    return `<div class="coin-art" style="--c1:${c1};--c2:${c2};--c3:${c3}"><em>${label}</em></div>`;
  };

  // ---------- example data (illustration of how the site looks) ----------
  // Contests run one UTC day (00:00 → 24:00 UTC). Winners are ranked at the next 00:00 UTC.
  const nextUtcMidnight = (t = Date.now()) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1); };
  const ENDS = nextUtcMidnight();

  // Ids are stable (tiles reference "studio" and "chef"); posts describe the contest, not the person's views
  const coins = [
    { id: "studio", name: "Elon Coin", ticker: "ELON", emoji: "🚀", creator: "elonmusk", mc: 412000, vol24h: 263000, pool: 40, winners: 10, replies: 184, holders: 3120, phase: "replies", endsAt: ENDS, paidTotal: 18420, post: "$ELON reply contest is live. Best replies today split 40% of today's fees, paid daily at 00:00 UTC 👇" },
    { id: "ratio", name: "Naval Wisdom", ticker: "NAVAL", emoji: "🧘", creator: "naval", mc: 988000, vol24h: 600000, pool: 70, winners: 10, replies: 557, holders: 7810, phase: "replies", endsAt: ENDS, paidTotal: 61230, post: "$NAVAL reply contest. Top 10 replies split 70% of the fees, every day." },
    { id: "gm", name: "Startup School", ticker: "YC", emoji: "🟧", creator: "garrytan", mc: 204000, vol24h: 103000, pool: 50, winners: 5, replies: 120, holders: 1904, phase: "replies", endsAt: ENDS, paidTotal: 7310, post: "$YC reply contest. Best replies get paid tonight at 00:00 UTC." },
    { id: "chef", name: "Essays", ticker: "ESSAY", emoji: "📝", creator: "paulg", mc: 156000, vol24h: 73000, pool: 60, winners: 5, replies: 87, holders: 1420, phase: "replies", endsAt: ENDS, paidTotal: 4980, post: "$ESSAY reply contest. Reply or quote, paste your link on ReplyPay. 60% of each day's fees to the most-engaged posts." },
    { id: "bars", name: "Beast Games", ticker: "BEAST", emoji: "🎮", creator: "MrBeast", mc: 530000, vol24h: 329000, pool: 50, winners: 10, replies: 316, holders: 4410, phase: "replies", endsAt: ENDS, paidTotal: 29840, post: "$BEAST reply contest. Best replies get paid in real money, every day. No wallets needed." },
    { id: "hotake", name: "Network State", ticker: "NSTATE", emoji: "🌐", creator: "balajis", mc: 97000, vol24h: 37000, pool: 30, winners: 3, replies: 57, holders: 880, phase: "replies", endsAt: ENDS, paidTotal: 2190, post: "$NSTATE reply contest. Top 3 take today's pool." },
    { id: "cat", name: "Ultrasound", ticker: "ULTRA", emoji: "🦇", creator: "VitalikButerin", mc: 342000, vol24h: 173000, pool: 80, winners: 10, replies: 247, holders: 3660, phase: "replies", endsAt: ENDS, paidTotal: 22760, post: "$ULTRA reply contest. 80% of each day's fees go to the replies." },
    { id: "ship", name: "Ship It", ticker: "SHIP", emoji: "🚢", creator: "sama", mc: 121000, vol24h: 56000, pool: 40, winners: 5, replies: 45, holders: 990, phase: "replies", endsAt: ENDS, paidTotal: 3420, post: "$SHIP reply contest. Best replies split the pool daily." },
    { id: "lore", name: "SAFU", ticker: "SAFU", emoji: "🛡️", creator: "cz_binance", mc: 76000, vol24h: 26000, pool: 50, winners: 5, replies: 37, holders: 610, phase: "replies", endsAt: ENDS, paidTotal: 980, post: "$SAFU reply contest. Most-engaged replies win, every day." },
  ];

  // Example replies: neutral banter, not real quotes
  const REPLY_BANK = [
    ["sama", "this is how creator economies should work"],
    ["naval", "gm, where do I sign up"],
    ["pmarca", "the leaderboard updating live is dangerously addictive"],
    ["garrytan", "checked the receipts page. this actually pays"],
    ["VitalikButerin", "love a public record"],
    ["balajis", "replying for science"],
    ["MrBeast", "best replies get paid? say less"],
    ["paulg", "the best reply wins. simple."],
    ["elonmusk", "interesting"],
    ["cz_binance", "gm"],
    ["blknoiz06", "this is going to be a busy day"],
    ["nikitabier", "the replies are the product"],
  ];
  // ---------- engagement scoring ----------
  // score = likes + 2×reposts + 3×quotes + replies + views/100
  const score = (m) => (m.likes || 0) + 2 * (m.reposts || 0) + 3 * (m.quotes || 0) + (m.replies || 0) + (m.views || 0) / 100;

  // Split `pool` across the top `n` scores in proportion to score, no winner above `cap` (50%) of the pool.
  // Capped winners are fixed at the cap and the rest is re-shared among the others (water-filling).
  // Returns an array of payouts aligned with `scores` (0 for anyone outside the top n).
  const split = (scores, pool, n, cap = 0.5) => {
    const idx = scores.map((s, i) => [s, i]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]).slice(0, n).map(([, i]) => i);
    const out = scores.map(() => 0);
    const max = pool * cap;
    let open = idx.slice(), left = pool;
    for (let guard = 0; open.length && guard < 20; guard++) {
      const sum = open.reduce((s, i) => s + scores[i], 0);
      const over = open.filter((i) => (scores[i] / sum) * left > max);
      if (!over.length) { open.forEach((i) => (out[i] = (scores[i] / sum) * left)); break; }
      over.forEach((i) => { out[i] = max; left -= max; });
      open = open.filter((i) => over.indexOf(i) < 0);
    }
    return out; // anything not paid (fewer than 2 entries) rolls over
  };

  // Today's pool for a coin: that day's creator fees (0.30% of 24h volume) × pool %
  const dailyPool = (c) => (c.vol24h || 0) * 0.003 * (c.pool / 100);

  // Stable fake X post id / contest code per seed
  const postId = (seed) => { const a = hash(seed), b = hash(seed + "#"); return "18" + String(a).padStart(10, "0").slice(0, 9) + String(b).padStart(10, "0").slice(0, 8); };
  const CODE_ABC = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const contestCode = (coin) => { let h = hash("code:" + (coin.id || coin)), s = ""; for (let i = 0; i < 4; i++) { s += CODE_ABC[h % 32]; h = Math.floor(h / 32); } return "rp-" + s; };

  // Example entries with deterministic engagement: likes, reposts, quotes, replies, views + score. Sorted by score.
  const repliesFor = (coin) => {
    const seed = hash(coin.id);
    const n = 8;
    const out = [];
    for (let i = 0; i < n; i++) {
      const [handle, text] = REPLY_BANK[(seed + i * 5) % REPLY_BANK.length];
      const h = hash(coin.id + ":" + i);
      const likes = Math.round(2400 / (i + 1.2) + ((seed >>> i) % 120));
      const m = {
        handle, text, likes,
        reposts: Math.round(likes * (0.05 + (h % 16) / 100)),
        quotes: Math.round(likes * (0.01 + ((h >>> 4) % 6) / 100)),
        replies: Math.round(likes * (0.04 + ((h >>> 8) % 12) / 100)),
        views: Math.round(likes * (24 + ((h >>> 12) % 48))),
        isQuote: (seed >>> i) % 4 === 0,
        id: postId(coin.id + ":" + i),
      };
      m.score = score(m);
      out.push(m);
    }
    return out.sort((a, b) => b.score - a.score);
  };

  const repliers = [
    { handle: "MrBeast", name: "MrBeast", wins: 14, earned: 9420.5, verified: true },
    { handle: "sama", name: "Sam Altman", wins: 11, earned: 7815.2, verified: true },
    { handle: "blknoiz06", name: "Ansem", wins: 9, earned: 6120.0, verified: true },
    { handle: "pmarca", name: "Marc Andreessen", wins: 8, earned: 5390.75, verified: true },
    { handle: "nikitabier", name: "Nikita Bier", wins: 7, earned: 4210.4, verified: true },
    { handle: "balajis", name: "Balaji", wins: 6, earned: 3882.1, verified: true },
  ];

  // kind: "reply" (winner of a reply pool) | "creator" (creator share)
  const payments = [
    { amount: 58.9, to: "pmarca", coin: "ratio", kind: "reply", rank: 1, mins: 3, reply: "the leaderboard updating live is dangerously addictive" },
    { amount: 177.1, to: "naval", coin: "ratio", kind: "creator", mins: 3 },
    { amount: 37.2, to: "sama", coin: "ratio", kind: "reply", rank: 2, mins: 4, reply: "this is how creator economies should work" },
    { amount: 16.9, to: "balajis", coin: "cat", kind: "reply", rank: 3, mins: 22, reply: "replying for science" },
    { amount: 107.1, to: "VitalikButerin", coin: "cat", kind: "creator", mins: 22 },
    { amount: 12.7, to: "MrBeast", coin: "chef", kind: "reply", rank: 1, mins: 71, reply: "best replies get paid? say less" },
    { amount: 9.2, to: "nikitabier", coin: "bars", kind: "reply", rank: 4, mins: 140, reply: "the replies are the product" },
    { amount: 75.7, to: "MrBeast", coin: "bars", kind: "creator", mins: 140 },
  ];

  const nextPayment = (() => {
    let i = 0;
    return () => {
      const [handle, text] = REPLY_BANK[(i * 7 + 3) % REPLY_BANK.length];
      const coin = coins[(i * 5 + 1) % coins.length];
      i++;
      return { amount: Math.round((4 + Math.random() * 60) * 100) / 100, to: handle, coin: coin.id, kind: "reply", rank: 1 + (i % 5), mins: 0, reply: text };
    };
  })();

  const coinById = (id) => coins.find((c) => c.id === id);

  // ---------- UI helpers ----------
  let toastTimer;
  const toast = (msg) => {
    const t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  };

  const modal = {
    open(html) {
      $("#modalBody").innerHTML = html;
      const m = $("#modal");
      m.classList.add("open");
      m.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      const card = $(".modal-card", m);
      card.scrollTop = 0;
      return $("#modalBody");
    },
    close() {
      const m = $("#modal");
      m.classList.remove("open");
      m.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      document.dispatchEvent(new CustomEvent("rp:modalclose"));
    },
  };
  document.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) modal.close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#modal").classList.contains("open")) modal.close(); });

  // Opening a coin page is implemented by sections.js; this is the shared entry point.
  const openCoin = (id) => document.dispatchEvent(new CustomEvent("rp:opencoin", { detail: { id } }));

  // Brand name everywhere
  $$("[data-brand]").forEach((el) => (el.textContent = BRAND));

  window.RP = {
    BRAND, $, $$, esc, usd, compact, usdCompact, countdown, ago, hash, pal, avatar, coinArt, PEOPLE, personName, photo,
    coins, coinById, repliesFor, dailyPool, nextUtcMidnight, score, split, postId, contestCode, repliers, payments, nextPayment,
    toast, modal, openCoin,
    CREATOR_FEE: 0.003, // 0.30% of volume
    XMONEY_DAILY_CAP: 0, // no per-recipient cap
  };
})();
