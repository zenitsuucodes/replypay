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
  const NOW = Date.now();
  const H = 3600e3, D = 24 * H;

  // Ids are stable (tiles reference "studio" and "chef"); posts describe the contest, not the person's views
  const coins = [
    { id: "studio", name: "Elon Coin", ticker: "ELON", emoji: "🚀", creator: "elonmusk", mc: 412000, vol7d: 1840000, pool: 40, winners: 10, replies: 1284, holders: 3120, phase: "replies", endsAt: NOW + 2 * D + 14 * H, paidTotal: 18420, post: "$ELON reply contest is live. Best replies this week split 40% of the fees 👇" },
    { id: "ratio", name: "Naval Wisdom", ticker: "NAVAL", emoji: "🧘", creator: "naval", mc: 988000, vol7d: 4200000, pool: 70, winners: 10, replies: 3902, holders: 7810, phase: "voting", endsAt: NOW + 21 * H, paidTotal: 61230, post: "$NAVAL reply contest. Top 10 replies split 70% of the fees this week." },
    { id: "gm", name: "Startup School", ticker: "YC", emoji: "🟧", creator: "garrytan", mc: 204000, vol7d: 720000, pool: 50, winners: 5, replies: 842, holders: 1904, phase: "replies", endsAt: NOW + 4 * D + 3 * H, paidTotal: 7310, post: "$YC reply contest. Best replies get paid this Sunday." },
    { id: "chef", name: "Essays", ticker: "ESSAY", emoji: "📝", creator: "paulg", mc: 156000, vol7d: 510000, pool: 60, winners: 5, replies: 611, holders: 1420, phase: "voting", endsAt: NOW + 1 * D + 6 * H, paidTotal: 4980, post: "$ESSAY reply contest. Holders pick the winners. 60% of fees to the replies." },
    { id: "bars", name: "Beast Games", ticker: "BEAST", emoji: "🎮", creator: "MrBeast", mc: 530000, vol7d: 2300000, pool: 50, winners: 10, replies: 2210, holders: 4410, phase: "replies", endsAt: NOW + 3 * D + 9 * H, paidTotal: 29840, post: "$BEAST reply contest. Best replies get paid in dollars. No wallets needed." },
    { id: "hotake", name: "Network State", ticker: "NSTATE", emoji: "🌐", creator: "balajis", mc: 97000, vol7d: 260000, pool: 30, winners: 3, replies: 402, holders: 880, phase: "replies", endsAt: NOW + 5 * D + 1 * H, paidTotal: 2190, post: "$NSTATE reply contest. Top 3 take the pool." },
    { id: "cat", name: "Ultrasound", ticker: "ULTRA", emoji: "🦇", creator: "VitalikButerin", mc: 342000, vol7d: 1210000, pool: 80, winners: 10, replies: 1730, holders: 3660, phase: "voting", endsAt: NOW + 9 * H, paidTotal: 22760, post: "$ULTRA reply contest. 80% of fees go to the replies." },
    { id: "ship", name: "Ship It", ticker: "SHIP", emoji: "🚢", creator: "sama", mc: 121000, vol7d: 390000, pool: 40, winners: 5, replies: 318, holders: 990, phase: "replies", endsAt: NOW + 2 * D + 22 * H, paidTotal: 3420, post: "$SHIP reply contest. Best replies split the pool." },
    { id: "lore", name: "SAFU", ticker: "SAFU", emoji: "🛡️", creator: "cz_binance", mc: 76000, vol7d: 180000, pool: 50, winners: 5, replies: 256, holders: 610, phase: "replies", endsAt: NOW + 6 * D, paidTotal: 980, post: "$SAFU reply contest. Holders vote. Best reply wins." },
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
    ["blknoiz06", "this is going to be a busy week"],
    ["nikitabier", "the replies are the product"],
  ];
  const repliesFor = (coin) => {
    const seed = hash(coin.id);
    const n = 8;
    const out = [];
    for (let i = 0; i < n; i++) {
      const [handle, text] = REPLY_BANK[(seed + i * 5) % REPLY_BANK.length];
      const likes = Math.round(2400 / (i + 1.2) + ((seed >>> i) % 120));
      out.push({ handle, text, likes, votes: Math.round(likes * (0.6 + ((seed >>> (i + 2)) % 60) / 100)), isQuote: (seed >>> i) % 4 === 0 });
    }
    return out.sort((a, b) => b.likes - a.likes);
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
    { amount: 412.5, to: "pmarca", coin: "ratio", kind: "reply", rank: 1, mins: 3, reply: "the leaderboard updating live is dangerously addictive" },
    { amount: 1240.0, to: "naval", coin: "ratio", kind: "creator", mins: 3 },
    { amount: 260.1, to: "sama", coin: "ratio", kind: "reply", rank: 2, mins: 4, reply: "this is how creator economies should work" },
    { amount: 118.4, to: "balajis", coin: "cat", kind: "reply", rank: 3, mins: 22, reply: "replying for science" },
    { amount: 750.0, to: "VitalikButerin", coin: "cat", kind: "creator", mins: 22 },
    { amount: 88.9, to: "MrBeast", coin: "chef", kind: "reply", rank: 1, mins: 71, reply: "best replies get paid? say less" },
    { amount: 64.2, to: "nikitabier", coin: "bars", kind: "reply", rank: 4, mins: 140, reply: "the replies are the product" },
    { amount: 530.0, to: "MrBeast", coin: "bars", kind: "creator", mins: 140 },
  ];

  const nextPayment = (() => {
    let i = 0;
    return () => {
      const [handle, text] = REPLY_BANK[(i * 7 + 3) % REPLY_BANK.length];
      const coin = coins[(i * 5 + 1) % coins.length];
      i++;
      return { amount: Math.round((20 + Math.random() * 380) * 100) / 100, to: handle, coin: coin.id, kind: "reply", rank: 1 + (i % 5), mins: 0, reply: text };
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
    coins, coinById, repliesFor, repliers, payments, nextPayment,
    toast, modal, openCoin,
    CREATOR_FEE: 0.003, // 0.30% of volume
    XMONEY_DAILY_CAP: 0, // no per-recipient cap
  };
})();
