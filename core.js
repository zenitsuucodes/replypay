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

  // Avatar bubble for an X handle. size: "" | "lg" | "xl"
  const avatar = (handle, size = "") => {
    const [a, b] = pal(handle);
    const letter = esc(handle.replace(/^@/, "").charAt(0).toUpperCase() || "?");
    return `<span class="av ${size}" style="--a:${a};--b:${b}">${letter}</span>`;
  };

  // Generated coin art (no external images). Returns a .coin-art div; parent sets size.
  const coinArt = (coin) => {
    if (coin.img) return `<img src="${esc(coin.img)}" alt="" style="width:100%;height:100%;object-fit:cover" />`;
    const h = hash(coin.ticker || coin.name || "x");
    const c1 = PALETTES[h % PALETTES.length][0];
    const c2 = PALETTES[(h >>> 3) % PALETTES.length][0];
    const c3 = PALETTES[(h >>> 6) % PALETTES.length][1];
    const label = esc(coin.emoji || (coin.ticker || "?").slice(0, 3));
    return `<div class="coin-art" style="--c1:${c1};--c2:${c2};--c3:${c3}"><em>${label}</em></div>`;
  };

  // ---------- mock data ----------
  const NOW = Date.now();
  const H = 3600e3, D = 24 * H;

  // Next "Sunday 20:00" style deadline, spread per coin so timers differ
  const coins = [
    { id: "studio", name: "Studio Session", ticker: "STUDIO", emoji: "🎙️", creator: "lilvapor", mc: 412000, vol7d: 1840000, pool: 40, winners: 10, replies: 1284, holders: 3120, phase: "replies", endsAt: NOW + 2 * D + 14 * H, paidTotal: 18420, post: "$STUDIO is live. Best replies this week split 40% of the fees. Tell me what the album should be called 👇" },
    { id: "ratio", name: "Ratio Club", ticker: "RATIO", emoji: "📉", creator: "ratioking", mc: 988000, vol7d: 4200000, pool: 70, winners: 10, replies: 3902, holders: 7810, phase: "voting", endsAt: NOW + 21 * H, paidTotal: 61230, post: "Ratio me. Seriously. Top 10 replies split 70% of this week's fees." },
    { id: "gm", name: "gm coin", ticker: "GM", emoji: "☀️", creator: "sunriseszn", mc: 204000, vol7d: 720000, pool: 50, winners: 5, replies: 842, holders: 1904, phase: "replies", endsAt: NOW + 4 * D + 3 * H, paidTotal: 7310, post: "say gm to the funniest person you know. best gm replies get paid this sunday" },
    { id: "chef", name: "Chef's Kiss", ticker: "CHEF", emoji: "👨‍🍳", creator: "nova", mc: 156000, vol7d: 510000, pool: 60, winners: 5, replies: 611, holders: 1420, phase: "voting", endsAt: NOW + 1 * D + 6 * H, paidTotal: 4980, post: "Post your worst cooking fail. Holders pick the winners. 60% of fees to the replies." },
    { id: "bars", name: "Bars Only", ticker: "BARS", emoji: "🎤", creator: "kaydenraps", mc: 530000, vol7d: 2300000, pool: 50, winners: 10, replies: 2210, holders: 4410, phase: "replies", endsAt: NOW + 3 * D + 9 * H, paidTotal: 29840, post: "Drop your best 4 bars under this post. Best bars get paid in dollars. No wallets needed." },
    { id: "hotake", name: "Hot Take", ticker: "TAKE", emoji: "🌶️", creator: "jules", mc: 97000, vol7d: 260000, pool: 30, winners: 3, replies: 402, holders: 880, phase: "replies", endsAt: NOW + 5 * D + 1 * H, paidTotal: 2190, post: "Give me your worst hot take. Top 3 take the pool." },
    { id: "cat", name: "Office Cat", ticker: "OCAT", emoji: "🐈", creator: "whiskerswork", mc: 342000, vol7d: 1210000, pool: 80, winners: 10, replies: 1730, holders: 3660, phase: "voting", endsAt: NOW + 9 * H, paidTotal: 22760, post: "Post your cat at work. 80% of fees go to the replies. The cat approves." },
    { id: "ship", name: "Ship It", ticker: "SHIP", emoji: "🚢", creator: "buildlog", mc: 121000, vol7d: 390000, pool: 40, winners: 5, replies: 318, holders: 990, phase: "replies", endsAt: NOW + 2 * D + 22 * H, paidTotal: 3420, post: "What did you ship this week? Best replies split the pool. Screenshots welcome." },
    { id: "lore", name: "Lore Drop", ticker: "LORE", emoji: "📜", creator: "mythmaker", mc: 76000, vol7d: 180000, pool: 50, winners: 5, replies: 256, holders: 610, phase: "replies", endsAt: NOW + 6 * D, paidTotal: 980, post: "Write the lore for $LORE in one reply. Holders vote. Best story wins." },
  ];

  // Replies per coin (finalists). Generated deterministically for any coin id.
  const REPLY_BANK = [
    ["memequeen", "call it 'Fees Don't Lie' and I'll buy 3 copies"],
    ["kaydenraps", "bro really made a coin so we'd write his album title"],
    ["justjon", "Album title: 'Paid In Replies'. You're welcome."],
    ["tinyanalyst", "Checked the receipts page. This actually pays. Wild."],
    ["deltadev", "the leaderboard updating live is dangerously addictive"],
    ["rinamoon", "Name it after the first person to get paid lol"],
    ["okayfine", "'Reply Guy Anthem'. that's it. that's the reply."],
    ["plaidcap", "if this doesn't win I'm quote posting it every day"],
    ["beatsbynova", "Title: 'Studio Hours'. Tracklist in the quotes."],
    ["verymid", "my mom liked this reply so it's basically verified"],
    ["cryptocarl", "LFG. 'Fee Fi Fo Fum'."],
    ["sanaa", "'Split Screen'. Because we split the fees. Get it."],
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
    { handle: "memequeen", name: "meme queen", wins: 14, earned: 9420.5, verified: true },
    { handle: "kaydenraps", name: "Kayden", wins: 11, earned: 7815.2, verified: true },
    { handle: "justjon", name: "Jon", wins: 9, earned: 6120.0, verified: false },
    { handle: "tinyanalyst", name: "tiny analyst", wins: 8, earned: 5390.75, verified: true },
    { handle: "rinamoon", name: "Rina", wins: 7, earned: 4210.4, verified: false },
    { handle: "okayfine", name: "okay fine", wins: 6, earned: 3882.1, verified: false },
  ];

  // kind: "reply" (winner of a reply pool) | "creator" (creator share)
  const payments = [
    { amount: 412.5, to: "memequeen", coin: "ratio", kind: "reply", rank: 1, mins: 3, reply: "the only thing getting ratioed here is my sleep schedule" },
    { amount: 1240.0, to: "ratioking", coin: "ratio", kind: "creator", mins: 3 },
    { amount: 260.1, to: "justjon", coin: "ratio", kind: "reply", rank: 2, mins: 4, reply: "Ratio. Also this coin pays better than my job." },
    { amount: 118.4, to: "rinamoon", coin: "cat", kind: "reply", rank: 3, mins: 22, reply: "my cat attends every standup and has never said a word" },
    { amount: 750.0, to: "whiskerswork", coin: "cat", kind: "creator", mins: 22 },
    { amount: 88.9, to: "okayfine", coin: "chef", kind: "reply", rank: 1, mins: 71, reply: "I set water on fire. Not boiling water. Water." },
    { amount: 64.2, to: "tinyanalyst", coin: "bars", kind: "reply", rank: 4, mins: 140, reply: "four bars: fees in, replies out, dollars on X, no wallet, no doubt" },
    { amount: 530.0, to: "kaydenraps", coin: "bars", kind: "creator", mins: 140 },
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
    BRAND, $, $$, esc, usd, compact, usdCompact, countdown, ago, hash, pal, avatar, coinArt,
    coins, coinById, repliesFor, repliers, payments, nextPayment,
    toast, modal, openCoin,
    CREATOR_FEE: 0.003, // 0.30% of volume
    XMONEY_DAILY_CAP: 0, // no per-recipient cap
  };
})();
