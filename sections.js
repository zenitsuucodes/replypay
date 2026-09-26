/* ReplyPay sections: live contests, top repliers, coin page modal, recent payments, biggest pools.
   Reads everything from window.RP (core.js). Wallet state comes from RP.wallet (hero.js), read defensively. */
(function () {
  "use strict";

  const RP = window.RP;
  if (!RP) return;
  const { $, $$, esc, usd, usdCompact, compact, countdown, ago, hash, avatar, coinArt } = RP;

  const PER_PAGE = 6;
  const WEEK = 7 * 864e5;
  const CHEV = `<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
  const XI = `<svg class="xi" aria-hidden="true"><use href="#x-logo"/></svg>`;
  const VF = `<svg class="vf" aria-label="Verified"><use href="#verified"/></svg>`;

  // ---------- shared ----------
  const weeklyPool = (c) => c.vol7d * RP.CREATOR_FEE * c.pool / 100;
  const phaseLabel = (p) => (p === "voting" ? "Voting" : "Replies open");
  const wallet = () => RP.wallet || {};
  // Fake but stable X Money transaction id
  const txnId = (seed) => {
    const h = hash(seed).toString(36).toUpperCase().padStart(7, "0");
    return "XM-" + h.slice(0, 4) + "…" + h.slice(-3);
  };
  // Monday-start week label, n weeks back from now
  const weekLabel = (back) => {
    const d = new Date(Date.now() - back * WEEK);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const end = new Date(d.getTime() + 6 * 864e5);
    const f = (x) => x.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    return f(d) + " – " + f(end);
  };
  const splitNote = (amt) => {
    const parts = Math.ceil(amt / RP.XMONEY_DAILY_CAP);
    return parts > 1 ? `Sent in ${parts} parts · ${usd(RP.XMONEY_DAILY_CAP, 0)} cap per 24h` : "";
  };
  const keyActivate = (e, fn) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };

  // ---------- 1. Live contests ----------
  const grid = $("#contestGrid");
  const contest = { sort: "pool", page: 0 };

  const contestList = () => {
    let list = RP.coins.slice();
    if (contest.sort === "voting") list = list.filter((c) => c.phase === "voting");
    if (contest.sort === "ending") list.sort((a, b) => a.endsAt - b.endsAt);
    else list.sort((a, b) => weeklyPool(b) - weeklyPool(a));
    return list;
  };

  const cardHTML = (c, i) => `
    <div class="ccard glass" role="button" tabindex="0" data-id="${esc(c.id)}" style="animation-delay:${i * 0.06}s" aria-label="Open ${esc(c.name)} contest">
      <div class="art">${coinArt(c)}
        <span class="phase ${c.phase === "voting" ? "voting" : "replies"}">${phaseLabel(c.phase)}</span>
        <span class="timer" data-ends="${c.endsAt}">${countdown(c.endsAt - Date.now())}</span>
      </div>
      <div class="body">
        <div class="title"><b>${esc(c.name)}</b><span>$${esc(c.ticker)}</span></div>
        <div class="by">${avatar(c.creator)}<span>@${esc(c.creator)}</span></div>
        <div class="nums">
          <div><small>Pool</small><b>${usdCompact(weeklyPool(c))}</b></div>
          <div><small>Replies</small><b>${compact(c.replies)}</b></div>
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
    $$("[data-ends]").forEach((el) => { el.textContent = countdown(+el.dataset.ends - now); });
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

  // Past weeks: pool paid + top 3 winners, deterministic per coin/week
  const pastWeeks = (c) => [1, 2, 3].map((back) => {
    const h = hash(c.id + ":w" + back);
    const paid = weeklyPool(c) * (0.55 + (h % 70) / 100);
    const pool = RP.repliesFor({ id: c.id + back });
    const shares = [0.3 + (h % 10) / 100, 0.18 + ((h >>> 4) % 8) / 100, 0.1 + ((h >>> 8) % 6) / 100];
    return { back, label: weekLabel(back), paid, winners: pool.slice(0, 3).map((r, i) => ({ handle: r.handle, amount: paid * shares[i] })) };
  });

  // Receipts: last week's creator share + reply payouts
  const receipts = (c) => {
    const wk = pastWeeks(c)[0];
    const creatorAmt = wk.paid * (100 - c.pool) / c.pool;
    const out = [{ to: c.creator, role: "Creator", amount: creatorAmt }];
    wk.winners.forEach((w, i) => out.push({ to: w.handle, role: "Reply #" + (i + 1), amount: w.amount }));
    return out.map((r, i) => ({ ...r, id: txnId(c.id + r.to + i), when: wk.label }));
  };

  const voteWeight = () => {
    const held = +(wallet().holdings || {})[cp.coin.id] || 0;
    const cap = cp.totalVotes * 0.05;
    return Math.round(Math.min(held, cap));
  };

  const finalistsHTML = () => {
    const { coin, replies, picks } = cp;
    const voting = coin.phase === "voting";
    const w = voting && wallet().connected ? voteWeight() : 0;
    const add = picks.size && w ? w / picks.size : 0;
    const total = cp.totalVotes + (picks.size ? w : 0);
    const note = voting
      ? `<div class="vote-note"><span>Your vote weight: <b>${w ? compact(w) : "—"}</b> · You can back up to 3 replies</span><span>Capped at 5% of the vote · snapshot Fri 00:00 UTC</span></div>`
      : `<div class="vote-note"><span>Live ranking by likes from accounts 90d+</span><span><b>Finalists lock Friday 00:00 UTC</b></span></div>`;
    const rows = replies.map((r, i) => {
      const picked = picks.has(i);
      const v = r.votes + (picked ? add : 0);
      const pct = voting ? (v / total) * 100 : (r.likes / replies[0].likes) * 100;
      return `
        <div class="finalist${picked ? " voted" : ""}" data-i="${i}">
          <span class="rp-rank">${i + 1}</span>
          <div class="txt">
            <div class="rp-who">${avatar(r.handle)}<b>@${esc(r.handle)}</b>${r.isQuote ? `<span class="tag quote-tag">Quote</span>` : ""}</div>
            <p>${esc(r.text)}</p>
            <div class="vbar"><i style="width:${pct.toFixed(1)}%"></i></div>
          </div>
          <div class="side">
            <span class="v">${voting ? pct.toFixed(1) + "%" : compact(r.likes) + " likes"}</span>
            <span class="likes">${voting ? compact(r.likes) + " likes" : "#" + (i + 1) + " by likes"}</span>
            ${voting
              ? `<button class="vote-btn" data-vote="${i}" aria-pressed="${picked}">${picked ? "Voted" : "Vote"}</button>`
              : `<button class="vote-btn" disabled aria-disabled="true">Opens Fri</button>`}
          </div>
        </div>`;
    }).join("");
    return note + rows;
  };

  const pastHTML = () => pastWeeks(cp.coin).map((wk) => `
    <div class="rp-week">
      <div class="rp-week-head"><b>${wk.label}</b><span>${usd(wk.paid)} paid to replies</span></div>
      ${wk.winners.map((w, i) => `
        <div class="rp-line">${["🥇", "🥈", "🥉"][i]} ${avatar(w.handle)}<span>@${esc(w.handle)}</span><b>${usd(w.amount)}</b></div>`).join("")}
    </div>`).join("");

  const receiptsHTML = () => receipts(cp.coin).map((r) => {
    const split = splitNote(r.amount);
    return `
      <div class="rp-receipt">
        <div class="rp-line">${avatar(r.to)}<span>to <b>@${esc(r.to)}</b> <span class="tag ${r.role === "Creator" ? "creator" : "reply"}">${r.role}</span></span><b>${usd(r.amount)}</b></div>
        <div class="kv"><span>X Money txn</span><b>${r.id}</b></div>
        <div class="kv"><span>Week</span><b>${r.when}</b></div>
        ${split ? `<div class="rp-split">${split}</div>` : ""}
      </div>`;
  }).join("");

  const renderTab = () => {
    const sec = $("#cpSection");
    if (!sec) return;
    const t = cp.tab;
    sec.innerHTML = t === "past" ? pastHTML() : t === "receipts" ? receiptsHTML() : finalistsHTML();
  };

  const openCoinPage = (id) => {
    const c = RP.coinById(id);
    if (!c) return;
    const replies = RP.repliesFor(c);
    cp = { coin: c, replies, picks: new Set(), tab: "board", totalVotes: replies.reduce((s, r) => s + r.votes, 0) };
    const voting = c.phase === "voting";
    const intent = "https://x.com/intent/post?text=" + encodeURIComponent("@" + c.creator + " ");
    const body = RP.modal.open(`
      <div class="cp-head">
        <div class="art">${coinArt(c)}</div>
        <div class="rp-cp-meta">
          <h3>${esc(c.name)} <span>$${esc(c.ticker)}</span></h3>
          <div class="by">${avatar(c.creator)}<span>by @${esc(c.creator)}</span></div>
          <div class="rp-cp-chips"><span class="tag reply">${c.pool}% to replies · top ${c.winners}</span><span class="phase ${voting ? "voting" : "replies"}">${phaseLabel(c.phase)}</span><span class="rp-timer" data-ends="${c.endsAt}">${countdown(c.endsAt - Date.now())}</span></div>
        </div>
      </div>
      <div class="cp-stats">
        <div><small>Market cap</small><b>${usdCompact(c.mc)}</b></div>
        <div><small>This week's pool</small><b>${usdCompact(weeklyPool(c))}</b></div>
        <div><small>Replies</small><b>${compact(c.replies)}</b></div>
        <div><small>Paid all time</small><b>${usdCompact(c.paidTotal)}</b></div>
      </div>
      <div class="home-post rp-cp-post">
        <div class="hp-top">${avatar(c.creator)}<b>${esc(c.creator)}</b><small>@${esc(c.creator)} · home post</small>${XI}</div>
        <p>${esc(c.post)}</p>
        <a class="btn btn-white btn-sm rp-reply-btn" href="${intent}" target="_blank" rel="noopener">${XI} Reply on X</a>
      </div>
      <div class="cp-tabs"><div class="seg-tabs" role="tablist">
        <button class="active" data-tab="board" role="tab">${voting ? "Finalists" : "Leaderboard"}</button>
        <button data-tab="past" role="tab">Past winners</button>
        <button data-tab="receipts" role="tab">Receipts</button>
      </div></div>
      <div class="cp-section" id="cpSection"></div>`);
    renderTab();

    // Delegated handlers live on the body; replaced each open via onclick
    body.onclick = (e) => {
      if (!cp) return;
      const tab = e.target.closest("[data-tab]");
      if (tab) {
        cp.tab = tab.dataset.tab;
        $$(".cp-tabs button", body).forEach((b) => b.classList.toggle("active", b === tab));
        renderTab();
        return;
      }
      const vb = e.target.closest("[data-vote]");
      if (vb) vote(+vb.dataset.vote);
    };
  };

  const vote = (i) => {
    const t = "$" + cp.coin.ticker;
    const w = wallet();
    if (w.connected !== true) {
      // Demo: connect in place (the header wallet button is hidden on phones)
      if (typeof RP.connectWallet === "function") RP.connectWallet();
      if (wallet().connected !== true) return RP.toast(`Connect a wallet that held ${t} at the Friday snapshot to vote`);
    }
    if (!voteWeight()) return RP.toast(`This wallet didn't hold ${t} at the Friday snapshot, so it can't vote`);
    if (cp.picks.has(i)) cp.picks.delete(i);
    else if (cp.picks.size >= 3) return RP.toast("You can back up to 3 replies. Remove one first.");
    else cp.picks.add(i);
    renderTab();
  };

  document.addEventListener("rp:opencoin", (e) => openCoinPage(e.detail && e.detail.id));
  document.addEventListener("rp:modalclose", () => {
    if (!cp) return;
    cp = null;
    const b = $("#modalBody");
    if (b) b.onclick = null;
  });
  // Wallet connected while a coin page is open: refresh vote weight
  document.addEventListener("rp:wallet", () => { if (cp && cp.tab === "board") renderTab(); });

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
          <div class="kv"><span>Week</span><b>${weekLabel(0)}</b></div>
          <div class="kv"><span>Votes share</span><b>${isReply ? vs + "%" : "Creator share"}</b></div>
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
