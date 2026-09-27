/* ReplyPay sections: live contests, top repliers, coin page modal, recent payments, biggest pools.
   Reads everything from window.RP (core.js). Entries are ranked by engagement (RP.score) and paid by RP.split. */
(function () {
  "use strict";

  const RP = window.RP;
  if (!RP) return;
  const { $, $$, esc, usd, usdCompact, compact, countdown, ago, hash, avatar, coinArt } = RP;

  const PER_PAGE = 6;
  const DAY = 864e5;
  const CHEV = `<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
  const XI = `<svg class="xi" aria-hidden="true"><use href="#x-logo"/></svg>`;
  const VF = `<svg class="vf" aria-label="Verified"><use href="#verified"/></svg>`;

  // ---------- shared ----------
  const dailyPool = RP.dailyPool;
  const finalHours = (c) => c.endsAt - Date.now() < 3 * 36e5;
  const phaseLabel = (c) => (finalHours(c) ? "Final hours" : "Entries open");
  const phaseCls = (c) => (finalHours(c) ? "final" : "replies");
  // Fake but stable X Money transaction id
  const txnId = (seed) => {
    const h = hash(seed).toString(36).toUpperCase().padStart(7, "0");
    return "XM-" + h.slice(0, 4) + "…" + h.slice(-3);
  };
  // UTC day label, n days back from today: "Today" / "Yesterday" / "2 days ago", plus the date
  const dayName = (back) => (back === 0 ? "Today" : back === 1 ? "Yesterday" : back + " days ago");
  const dayLabel = (back) => {
    const d = new Date(Date.now() - back * DAY);
    return dayName(back) + " · " + d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) + " UTC";
  };
  const splitNote = (amt) => {
    if (!(RP.XMONEY_DAILY_CAP > 0)) return ""; // no cap: paid in one go
    const parts = Math.ceil(amt / RP.XMONEY_DAILY_CAP);
    return parts > 1 ? `Sent in ${parts} parts · ${usd(RP.XMONEY_DAILY_CAP, 0)} cap per 24h` : "";
  };
  const keyActivate = (e, fn) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };

  // ---------- 1. Live contests ----------
  const grid = $("#contestGrid");
  const contest = { sort: "pool", page: 0 };

  const contestList = () => {
    let list = RP.coins.slice();
    if (contest.sort === "ending") list.sort((a, b) => a.endsAt - b.endsAt);
    else if (contest.sort === "entries") list.sort((a, b) => b.replies - a.replies);
    else list.sort((a, b) => dailyPool(b) - dailyPool(a));
    return list;
  };

  const cardHTML = (c, i) => `
    <div class="ccard glass" role="button" tabindex="0" data-id="${esc(c.id)}" style="animation-delay:${i * 0.06}s" aria-label="Open ${esc(c.name)} contest">
      <div class="art">${coinArt(c)}
        <span class="phase ${phaseCls(c)}">${phaseLabel(c)}</span>
        <span class="timer" data-ends="${c.endsAt}">${countdown(c.endsAt - Date.now())}</span>
      </div>
      <div class="body">
        <div class="title"><b>${esc(c.name)}</b><span>$${esc(c.ticker)}</span></div>
        <div class="by">${avatar(c.creator)}<span>@${esc(c.creator)}</span></div>
        <div class="nums">
          <div><small>Pool</small><b>${usdCompact(dailyPool(c))}</b></div>
          <div><small>Entries</small><b>${compact(c.replies)}</b></div>
          <div><small>Holders</small><b>${compact(c.holders)}</b></div>
        </div>
        <div class="poolbar" title="Creator ${100 - c.pool}% · Reply pool ${c.pool}%"><i class="pc" style="flex:${100 - c.pool}"></i><i class="pp" style="flex:${c.pool}"></i></div>
      </div>
    </div>`;

  const renderContests = () => {
    if (!grid) return;
    const list = contestList();
    const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    contest.page = Math.min(contest.page, pages - 1);
    const slice = list.slice(contest.page * PER_PAGE, (contest.page + 1) * PER_PAGE);
    grid.innerHTML = slice.length ? slice.map(cardHTML).join("") : `<p class="muted rp-empty">No contests in this view right now.</p>`;
    const lbl = $("#pgLabel"), prev = $("#pgPrev"), next = $("#pgNext");
    if (lbl) lbl.textContent = contest.page + 1 + " / " + pages;
    if (prev) prev.disabled = contest.page === 0;
    if (next) next.disabled = contest.page >= pages - 1;
  };

  if (grid) {
    grid.addEventListener("click", (e) => { const c = e.target.closest(".ccard"); if (c) RP.openCoin(c.dataset.id); });
    grid.addEventListener("keydown", (e) => { const c = e.target.closest(".ccard"); if (c) keyActivate(e, () => RP.openCoin(c.dataset.id)); });
    $$("#contestTabs button").forEach((b) => b.addEventListener("click", () => {
      $$("#contestTabs button").forEach((x) => x.classList.toggle("active", x === b));
      contest.sort = b.dataset.sort;
      contest.page = 0;
      renderContests();
    }));
    const prev = $("#pgPrev"), next = $("#pgNext");
    if (prev) prev.addEventListener("click", () => { if (contest.page > 0) { contest.page--; renderContests(); } });
    if (next) next.addEventListener("click", () => { contest.page++; renderContests(); });
    renderContests();
    // New coins from launch.js appear at the top of "Ending soon"/"Biggest pool" views
    document.addEventListener("rp:coinlaunched", () => { contest.page = 0; renderContests(); });
  }

  // One ticker for every visible countdown (grid + modal), text-only updates
  setInterval(() => {
    if (document.hidden) return;
    const now = Date.now();
    $$("[data-ends]").forEach((el) => {
      if (+el.dataset.ends <= now) el.dataset.ends = RP.nextUtcMidnight(now); // a new daily contest starts
      el.textContent = countdown(+el.dataset.ends - now);
    });
  }, 1000);

  // ---------- 2. Top repliers ----------
  const earners = $("#earnerList");
  if (earners) {
    earners.innerHTML = RP.repliers.map((r, i) => `
      <div class="earner glass" style="animation-delay:${i * 0.05}s">
        <span class="rank">${i + 1}</span>
        ${avatar(r.handle, "lg")}
        <div class="info"><b>${esc(r.name)}${r.verified ? VF : ""}</b><small>@${esc(r.handle)} · ${r.wins} wins</small></div>
        <div class="amt"><b>${usd(r.earned)}</b><small>earned</small></div>
      </div>`).join("");
  }

  // ---------- 3. Coin page modal ----------
  let cp = null; // current coin page state

  // Past days: pool paid + top 3 winners, deterministic per coin/day
  const pastDays = (c) => [1, 2, 3].map((back) => {
    const h = hash(c.id + ":d" + back);
    const paid = dailyPool(c) * (0.55 + (h % 70) / 100);
    const pool = RP.repliesFor({ id: c.id + back });
    const pay = RP.split(pool.map((r) => r.score), paid, c.winners);
    return { back, label: dayLabel(back), paid, winners: pool.slice(0, 3).map((r, i) => ({ handle: r.handle, amount: pay[i] })) };
  });

  // Receipts: yesterday's creator share + reply payouts
  const receipts = (c) => {
    const day = pastDays(c)[0];
    const creatorAmt = day.paid * (100 - c.pool) / c.pool;
    const out = [{ to: c.creator, role: "Creator", amount: creatorAmt }];
    day.winners.forEach((w, i) => out.push({ to: w.handle, role: "Reply #" + (i + 1), amount: w.amount }));
    return out.map((r, i) => ({ ...r, id: txnId(c.id + r.to + i), when: day.label }));
  };

  // All entries for the open coin page, sorted by score, with projected payouts from RP.split
  const ranked = () => {
    const list = cp.entries.slice().sort((a, b) => b.score - a.score);
    const pay = RP.split(list.map((r) => r.score), dailyPool(cp.coin), cp.coin.winners);
    return list.map((r, i) => Object.assign({}, r, { rank: i + 1, payout: pay[i] }));
  };

  const entriesHTML = () => {
    const { coin } = cp;
    const list = ranked();
    const top = list[0] ? list[0].score : 1;
    const note = `<div class="entry-note"><span>Ranked by engagement · score = likes + 2×reposts + 3×quotes + replies + views/100</span><span><b>Top ${coin.winners} split ${usd(dailyPool(coin), 0)}</b> · max 50% each</span></div>`;
    const rows = list.map((r) => `
        <div class="finalist${r.mine ? " mine" : ""}" data-id="${esc(r.id)}">
          <span class="rp-rank">${r.rank}</span>
          <div class="txt">
            <div class="rp-who">${avatar(r.handle)}<b>@${esc(r.handle)}</b>${r.isQuote ? `<span class="tag quote-tag">Quote</span>` : ""}${r.mine ? `<span class="tag reply">Your entry</span>` : ""}</div>
            <p>${esc(r.text)}</p>
            <div class="rp-metrics"><span>♥ ${compact(r.likes)}</span><span>⟲ ${compact(r.reposts)}</span><span>◉ ${compact(r.views)} views</span></div>
            <div class="vbar"><i style="width:${Math.max(2, (r.score / top) * 100).toFixed(1)}%"></i></div>
          </div>
          <div class="side">
            <span class="v">${compact(Math.round(r.score))}</span>
            <span class="likes">score</span>
            <span class="rp-payout${r.payout ? "" : " none"}">${r.payout ? usd(r.payout, 0) : "—"}</span>
          </div>
        </div>`).join("");
    return note + rows;
  };

  // ---------- enter today's contest (demo) ----------
  const LINK_RE = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})(?:[/?#].*)?$/i;

  const enterHTML = (c) => {
    const homeId = RP.postId("home:" + c.id);
    const homeUrl = `https://x.com/${c.creator}/status/${homeId}`;
    const reply = "https://x.com/intent/post?in_reply_to=" + homeId;
    const quote = "https://x.com/intent/post?url=" + encodeURIComponent(homeUrl);
    return `
      <div class="rp-enter">
        <div class="rp-enter-head"><b>Enter today's contest</b><span class="demo-flag">Demo — entries are simulated here</span></div>
        <div class="rp-enter-step">
          <span class="rp-n">1</span>
          <div><p>Reply to or quote @${esc(c.creator)}'s home post on X.</p>
            <div class="rp-enter-btns">
              <a class="btn btn-white btn-sm" href="${reply}" target="_blank" rel="noopener">${XI} Reply</a>
              <a class="btn btn-ghost btn-sm" href="${quote}" target="_blank" rel="noopener">${XI} Quote</a>
            </div>
          </div>
        </div>
        <div class="rp-enter-step">
          <span class="rp-n">2</span>
          <div><p>Paste the link to your post. No sign-in needed; the payout goes to whoever wrote it.</p>
            <form class="rp-enter-form" id="enterForm" novalidate>
              <input id="enterLink" type="url" inputmode="url" autocomplete="off" placeholder="https://x.com/you/status/…" aria-label="Link to your reply or quote post" />
              <button type="submit" class="btn btn-white btn-sm">Submit</button>
            </form>
            <div class="rp-enter-msg" id="enterMsg" aria-live="polite"></div>
          </div>
        </div>
      </div>`;
  };

  const submitEntry = (form) => {
    if (!cp || cp.checking) return;
    const input = $("#enterLink", form.parentNode), msg = $("#enterMsg", form.parentNode);
    const url = (input.value || "").trim();
    const m = url.match(LINK_RE);
    const say = (cls, html) => { msg.className = "rp-enter-msg " + cls; msg.innerHTML = html; };
    if (!m) return say("err", "That doesn't look like a post link. Use x.com/&lt;handle&gt;/status/&lt;id&gt;.");
    const [, handle, id] = m;
    if (cp.entries.some((r) => r.id === id)) return say("err", "That post is already entered.");
    if (cp.entries.some((r) => r.handle.toLowerCase() === handle.toLowerCase()))
      return say("err", `@${esc(handle)} already has an entry today. One entry counts per account per day.`);
    if (handle.toLowerCase() === cp.coin.creator.toLowerCase()) return say("err", "The creator can't enter their own contest.");
    cp.checking = true;
    say("run", `<span class="rp-spin"></span> Checking your post…`);
    const coinId = cp.coin.id;
    setTimeout(() => {
      if (!cp || cp.coin.id !== coinId) return;
      cp.checking = false;
      cp.added++;
      const n = cp.coin.replies + cp.added;
      const h = hash(id);
      const likes = 3 + (h % 40);
      const e = { handle, text: "Your reply to the home post", likes, reposts: h % 5, quotes: (h >>> 3) % 2, replies: (h >>> 5) % 4, views: likes * (30 + (h % 40)), isQuote: false, id, mine: true };
      e.score = RP.score(e);
      cp.entries.push(e);
      say("ok", `You're in! Entry #${n.toLocaleString("en-US")} · @${esc(handle)}. Metrics refresh all day; ranked at 00:00 UTC.`);
      input.value = "";
      // show the entries list with the new row
      cp.tab = "board";
      $$(".cp-tabs button", $("#modalBody")).forEach((b) => b.classList.toggle("active", b.dataset.tab === "board"));
      renderTab();
      const row = $(`.finalist.mine[data-id="${id}"]`, $("#cpSection"));
      if (row) row.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 1400);
  };

  const pastHTML = () => pastDays(cp.coin).map((day) => `
    <div class="rp-day">
      <div class="rp-day-head"><b>${day.label}</b><span>${usd(day.paid)} paid to replies</span></div>
      ${day.winners.map((w, i) => `
        <div class="rp-line">${["🥇", "🥈", "🥉"][i]} ${avatar(w.handle)}<span>@${esc(w.handle)}</span><b>${usd(w.amount)}</b></div>`).join("")}
    </div>`).join("");

  const receiptsHTML = () => receipts(cp.coin).map((r) => {
    const split = splitNote(r.amount);
    return `
      <div class="rp-receipt">
        <div class="rp-line">${avatar(r.to)}<span>to <b>@${esc(r.to)}</b> <span class="tag ${r.role === "Creator" ? "creator" : "reply"}">${r.role}</span></span><b>${usd(r.amount)}</b></div>
        <div class="kv"><span>X Money txn</span><b>${r.id}</b></div>
        <div class="kv"><span>Day</span><b>${r.when}</b></div>
        ${split ? `<div class="rp-split">${split}</div>` : ""}
      </div>`;
  }).join("");

  const renderTab = () => {
    const sec = $("#cpSection");
    if (!sec) return;
    const t = cp.tab;
    sec.innerHTML = t === "past" ? pastHTML() : t === "receipts" ? receiptsHTML() : entriesHTML();
  };

  const openCoinPage = (id) => {
    const c = RP.coinById(id);
    if (!c) return;
    cp = { coin: c, entries: RP.repliesFor(c), tab: "board", added: 0, checking: false };
    const code = c.code || RP.contestCode(c);
    const body = RP.modal.open(`
      <div class="cp-head">
        <div class="art">${coinArt(c)}</div>
        <div class="rp-cp-meta">
          <h3>${esc(c.name)} <span>$${esc(c.ticker)}</span></h3>
          <div class="by">${avatar(c.creator)}<span>by @${esc(c.creator)}</span></div>
          <div class="rp-cp-chips"><span class="tag reply">${c.pool}% to replies · top ${c.winners}</span><span class="phase ${phaseCls(c)}">${phaseLabel(c)}</span><span class="rp-timer" data-ends="${c.endsAt}">${countdown(c.endsAt - Date.now())}</span></div>
        </div>
      </div>
      <div class="cp-stats">
        <div><small>Market cap</small><b>${usdCompact(c.mc)}</b></div>
        <div><small>Today's pool</small><b>${usdCompact(dailyPool(c))}</b></div>
        <div><small>Entries</small><b>${compact(c.replies)}</b></div>
        <div><small>Paid all time</small><b>${usdCompact(c.paidTotal)}</b></div>
      </div>
      <div class="home-post rp-cp-post">
        <div class="hp-top">${avatar(c.creator)}<b>${esc(RP.personName(c.creator))}</b><small>@${esc(c.creator)} · home post</small>${XI}</div>
        <p>${esc(c.post)}${c.post.indexOf(code) < 0 ? ` <span class="rp-code">${esc(code)}</span>` : ""}</p>
      </div>
      ${enterHTML(c)}
      <div class="cp-tabs"><div class="seg-tabs" role="tablist">
        <button class="active" data-tab="board" role="tab">Entries</button>
        <button data-tab="past" role="tab">Past winners</button>
        <button data-tab="receipts" role="tab">Receipts</button>
      </div></div>
      <div class="cp-section" id="cpSection"></div>`);
    renderTab();

    // Delegated handlers live on the body; replaced each open via onclick/onsubmit
    body.onclick = (e) => {
      if (!cp) return;
      const tab = e.target.closest("[data-tab]");
      if (tab) {
        cp.tab = tab.dataset.tab;
        $$(".cp-tabs button", body).forEach((b) => b.classList.toggle("active", b === tab));
        renderTab();
      }
    };
    body.onsubmit = (e) => {
      if (e.target.id !== "enterForm") return;
      e.preventDefault();
      submitEntry(e.target);
    };
  };

  document.addEventListener("rp:opencoin", (e) => openCoinPage(e.detail && e.detail.id));
  document.addEventListener("rp:modalclose", () => {
    if (!cp) return;
    cp = null;
    const b = $("#modalBody");
    if (b) { b.onclick = null; b.onsubmit = null; }
  });

  // ---------- 4. Recent payments ----------
  const payList = $("#payList");
  const MAX_PAYS = 8;
  let paySeq = 0;

  const payHTML = (p) => {
    const c = RP.coinById(p.coin) || { name: p.coin, ticker: String(p.coin).toUpperCase() };
    const isReply = p.kind === "reply";
    const id = "pd" + paySeq++;
    const born = Date.now() - (p.mins || 0) * 60e3;
    const vs = isReply ? (32 - (p.rank || 1) * 5 + (hash(p.to + p.coin) % 6)) : 0;
    return `
      <div class="pay glass" data-born="${born}">
        <div class="pay-top" role="button" tabindex="0" aria-expanded="false" aria-controls="${id}">
          ${avatar(p.to)}
          <div class="rp-pay-main">
            <span class="amt">${usd(p.amount)}</span>
            <span class="to">sent to <b>@${esc(p.to)}</b> <span class="tag ${isReply ? "reply" : "creator"}">${isReply ? "Reply #" + p.rank : "Creator"} · $${esc(c.ticker)}</span></span>
          </div>
          <div class="right"><span class="ago">${ago(p.mins || 0)}</span>${CHEV}</div>
        </div>
        <div class="pay-detail" id="${id}"><div><div class="pay-inner">
          ${isReply && p.reply ? `<div class="quote">${esc(p.reply)}</div>` : ""}
          <div class="kv"><span>Coin</span><b>${esc(c.name)} ($${esc(c.ticker)})</b></div>
          <div class="kv"><span>Day</span><b>${dayLabel(1)} · paid 00:00 UTC</b></div>
          <div class="kv"><span>Pool share</span><b>${isReply ? vs + "% · by engagement" : "Creator share"}</b></div>
          <div class="kv"><span>Paid via</span><b>X Money</b></div>
          <div class="kv"><span>Receipt id</span><b>${txnId(p.to + p.coin + p.amount)}</b></div>
          <div class="kv"><span>Sent at</span><b>${new Date(born).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</b></div>
          ${splitNote(p.amount) ? `<div class="rp-split">${splitNote(p.amount)}</div>` : ""}
        </div></div></div>
      </div>`;
  };

  if (payList) {
    payList.innerHTML = RP.payments.map(payHTML).join("");
    $$(".pay", payList).forEach((el, i) => (el.style.animationDelay = i * 0.05 + "s"));

    const toggle = (top) => {
      const pay = top.closest(".pay");
      const open = pay.classList.toggle("open");
      top.setAttribute("aria-expanded", open);
    };
    payList.addEventListener("click", (e) => { const t = e.target.closest(".pay-top"); if (t) toggle(t); });
    payList.addEventListener("keydown", (e) => { const t = e.target.closest(".pay-top"); if (t && e.target === t) keyActivate(e, () => toggle(t)); });

    // New payment every ~6s, keep list at 8, refresh "ago" labels
    setInterval(() => {
      if (document.hidden) return;
      payList.insertAdjacentHTML("afterbegin", payHTML(RP.nextPayment()));
      const items = $$(".pay", payList);
      items.slice(MAX_PAYS).forEach((el) => el.remove());
      const now = Date.now();
      items.slice(0, MAX_PAYS).forEach((el) => {
        const a = $(".ago", el);
        if (a) a.textContent = ago(Math.floor((now - +el.dataset.born) / 60e3));
      });
    }, 6000);
  }

  // ---------- 5. Biggest pools paid ----------
  const mp = $("#mostPaid");
  if (mp) {
    const top = RP.coins.slice().sort((a, b) => b.paidTotal - a.paidTotal).slice(0, 6);
    const max = top[0] ? top[0].paidTotal : 1;
    mp.innerHTML = top.map((c, i) => `
      <div class="mp-row" role="button" tabindex="0" data-id="${esc(c.id)}" aria-label="Open ${esc(c.name)}">
        <span class="rp-mini">${coinArt(c)}</span>
        <div><b>${esc(c.name)}</b><small>$${esc(c.ticker)} · @${esc(c.creator)}</small></div>
        <span class="v">${usd(c.paidTotal, 0)}</span>
        <div class="bar"><i style="width:${((c.paidTotal / max) * 100).toFixed(1)}%;animation-delay:${i * 0.08}s"></i></div>
      </div>`).join("");
    mp.addEventListener("click", (e) => { const r = e.target.closest(".mp-row"); if (r) RP.openCoin(r.dataset.id); });
    mp.addEventListener("keydown", (e) => { const r = e.target.closest(".mp-row"); if (r) keyActivate(e, () => RP.openCoin(r.dataset.id)); });
  }
})();
