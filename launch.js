/* ReplyPay launch: live preview, pool split, payout simulator and a simulated launch.
   Nothing is deployed; the launch is a front-end demo. Reads from window.RP (core.js). */
(function () {
  "use strict";

  const RP = window.RP;
  if (!RP) return;
  const { $, $$, esc, usd, compact, coinArt, pal } = RP;

  const form = $("#launchForm");
  if (!form) return;

  // Load launch.css without touching index.html
  if (!$('link[href="launch.css"]')) {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "launch.css";
    document.head.appendChild(l);
  }

  const DEF = { name: "Studio Session", ticker: "STUDIO", handle: "lilvapor" };
  const MAX_IMG = 5 * 1024 * 1024;
  const STEP_MS = 900;

  const el = {
    name: $("#fName"), ticker: $("#fTicker"), handle: $("#fHandle"), buy: $("#fBuy"),
    nameWrap: $("#fNameWrap"), tickerWrap: $("#fTickerWrap"), handleWrap: $("#fHandleWrap"), handleMsg: $("#fHandleMsg"),
    drop: $("#imgDrop"), file: $("#imgInput"), imgPrev: $("#imgPreview"),
    pool: $("#poolRange"), psC: $("#psC"), psP: $("#psP"),
    winners: $("#winnersChips"), elig: $("#eligChips"), btn: $("#launchBtn"),
    pvImg: $("#pvImg"), pvName: $("#pvName"), pvTicker: $("#pvTicker"), pvAv: $("#pvAv"),
    pvHandle: $("#pvHandle"), pvPost: $("#pvPost"), pvPc: $("#pvPc"), pvPp: $("#pvPp"),
    simVol: $("#simVol"), simVolLabel: $("#simVolLabel"), simRows: $("#simRows"),
  };

  // Name/ticker have no .msg in the markup; add one each
  const addMsg = (wrap) => {
    if (!wrap) return null;
    let m = $(".msg", wrap);
    if (!m) { m = document.createElement("span"); m.className = "msg"; wrap.appendChild(m); }
    return m;
  };
  el.nameMsg = addMsg(el.nameWrap);
  el.tickerMsg = addMsg(el.tickerWrap);

  const state = { img: "", pool: 50, winners: 10, elig: "any" };

  // ---------- input cleaning ----------
  const cleanTicker = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
  const cleanHandle = (s) => s.replace(/^@+/, "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 15);
  const keepCaret = (input, fn) => {
    const before = input.value;
    const after = fn(before);
    if (after === before) return;
    const pos = Math.max(0, (input.selectionStart || 0) - (before.length - after.length));
    input.value = after;
    try { input.setSelectionRange(pos, pos); } catch (e) { /* number inputs etc. */ }
  };

  const vals = () => ({
    name: el.name.value.trim() || DEF.name,
    ticker: el.ticker.value || DEF.ticker,
    handle: el.handle.value || DEF.handle,
  });

  // ---------- home post ----------
  const postText = (v = vals()) =>
    `$${v.ticker} is live. Best replies this week split ${state.pool}% of the fees, paid in dollars on X Money. ` +
    `Top ${state.winners} win.` + (state.elig === "verified" ? " Verified accounts only." : "") + " 👇";

  // ---------- preview ----------
  let lastArtKey = "";
  const renderArt = (ticker) => {
    const key = state.img ? "img:" + state.img.length : "t:" + ticker;
    if (key === lastArtKey) return;
    lastArtKey = key;
    el.pvImg.innerHTML = coinArt({ ticker, img: state.img });
  };

  const renderPreview = () => {
    const v = vals();
    el.pvName.textContent = v.name;
    el.pvTicker.textContent = "$" + v.ticker;
    el.pvHandle.textContent = "@" + v.handle;
    const [a, b] = pal(v.handle);
    el.pvAv.style.setProperty("--a", a);
    el.pvAv.style.setProperty("--b", b);
    el.pvAv.textContent = v.handle.charAt(0).toUpperCase();
    renderArt(v.ticker);
    el.pvPost.innerHTML = `<svg class="xi"><use href="#x-logo"/></svg>${esc(postText(v))}`;
  };

  // ---------- pool slider ----------
  const setFill = (range) => {
    const min = +range.min, max = +range.max;
    range.style.setProperty("--p", ((+range.value - min) / (max - min)) * 100 + "%");
  };

  const renderPool = () => {
    const p = state.pool, c = 100 - p;
    setFill(el.pool);
    el.psC.textContent = `You ${c}%`;
    el.psP.textContent = `Replies ${p}%`;
    el.psC.style.flex = `0 0 ${c}%`;
    el.psP.style.flex = `0 0 ${p}%`;
    el.pvPc.style.flex = String(c);
    el.pvPp.style.flex = String(p);
  };

  // ---------- simulator ----------
  // Vote shares decay ~1/(rank+1), normalised over N winners
  const shares = (n) => {
    const w = Array.from({ length: n }, (_, i) => 1 / (i + 1));
    const sum = w.reduce((s, x) => s + x, 0);
    return w.map((x) => x / sum);
  };

  const renderSim = () => {
    const vol = +el.simVol.value;
    setFill(el.simVol);
    el.simVolLabel.textContent = "$" + compact(vol) + " volume";
    const fee = vol * RP.CREATOR_FEE;
    const pool = fee * (state.pool / 100);
    const mine = fee - pool;
    const top = pool * shares(state.winners)[0];
    const avg = pool / state.winners;
    const row = (label, value, cls = "") => `<div class="sim-row${cls ? " " + cls : ""}"><span>${label}</span><b>${value}</b></div>`;
    let html =
      row("Weekly creator fee", usd(fee)) +
      row(`Your share (${100 - state.pool}%)`, usd(mine)) +
      row(`Reply pool (${state.pool}%)`, usd(pool), "hl") +
      row("#1 reply (est.)", usd(top)) +
      row(`Avg. winner (top ${state.winners})`, usd(avg));
    const cap = RP.XMONEY_DAILY_CAP;
    if (top > cap) html += row(`Sent in ${Math.ceil(top / cap)} parts`, `X Money $${cap}/24h cap`);
    el.simRows.innerHTML = html;
  };

  const renderAll = () => { renderPool(); renderPreview(); renderSim(); };

  // ---------- chips ----------
  const bindChips = (group, key, parse) => {
    if (!group) return;
    const on = $("button.on", group);
    if (on) state[key] = parse(on.dataset.v);
    group.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b || !group.contains(b)) return;
      $$("button", group).forEach((x) => x.classList.toggle("on", x === b));
      state[key] = parse(b.dataset.v);
      renderPreview();
      renderSim();
    });
  };
  bindChips(el.winners, "winners", (v) => parseInt(v, 10) || 10);
  bindChips(el.elig, "elig", (v) => v);

  // ---------- inputs ----------
  const clearErr = (wrap, msg) => { wrap && wrap.classList.remove("err"); if (msg) msg.textContent = ""; };

  el.name.addEventListener("input", () => { clearErr(el.nameWrap, el.nameMsg); renderPreview(); });
  el.ticker.addEventListener("input", () => { keepCaret(el.ticker, cleanTicker); clearErr(el.tickerWrap, el.tickerMsg); renderPreview(); });
  el.handle.addEventListener("input", () => { keepCaret(el.handle, cleanHandle); clearErr(el.handleWrap, el.handleMsg); renderPreview(); });
  el.pool.addEventListener("input", () => { state.pool = +el.pool.value; renderPool(); renderPreview(); renderSim(); });
  el.simVol.addEventListener("input", renderSim);

  // ---------- image upload ----------
  const loadImage = (file) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) return RP.toast("That's not an image. Try a PNG, JPG or GIF.");
    if (file.size > MAX_IMG) return RP.toast("Image is over 5MB. Try a smaller one.");
    const r = new FileReader();
    r.onload = () => {
      state.img = String(r.result);
      el.imgPrev.src = state.img;
      el.imgPrev.hidden = false;
      el.drop.classList.add("has-img");
      renderPreview();
    };
    r.onerror = () => RP.toast("Couldn't read that image.");
    r.readAsDataURL(file);
  };

  el.file.addEventListener("change", () => { loadImage(el.file.files[0]); el.file.value = ""; });
  ["dragenter", "dragover"].forEach((t) => el.drop.addEventListener(t, (e) => { e.preventDefault(); el.drop.classList.add("drag"); }));
  ["dragleave", "dragend"].forEach((t) => el.drop.addEventListener(t, (e) => {
    if (e.relatedTarget && el.drop.contains(e.relatedTarget)) return;
    el.drop.classList.remove("drag");
  }));
  el.drop.addEventListener("drop", (e) => {
    e.preventDefault();
    el.drop.classList.remove("drag");
    loadImage(e.dataTransfer && e.dataTransfer.files[0]);
  });

  // ---------- validation ----------
  const validate = () => {
    const errs = [];
    const fail = (wrap, msg, text, input) => { wrap.classList.add("err"); if (msg) msg.textContent = text; errs.push(input); };
    const name = el.name.value.trim();
    const ticker = el.ticker.value;
    const handle = el.handle.value;
    clearErr(el.nameWrap, el.nameMsg); clearErr(el.tickerWrap, el.tickerMsg); clearErr(el.handleWrap, el.handleMsg);

    if (!name) fail(el.nameWrap, el.nameMsg, "Give your coin a name.", el.name);
    else if (name.length < 2 || name.length > 32) fail(el.nameWrap, el.nameMsg, "Name must be 2–32 characters.", el.name);

    if (!ticker) fail(el.tickerWrap, el.tickerMsg, "Pick a ticker.", el.ticker);
    else if (ticker.length < 2 || ticker.length > 10) fail(el.tickerWrap, el.tickerMsg, "Ticker must be 2–10 letters or numbers.", el.ticker);

    if (!handle) fail(el.handleWrap, el.handleMsg, "Add your X handle so your share has somewhere to go.", el.handle);
    else if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) fail(el.handleWrap, el.handleMsg, "X handles are up to 15 letters, numbers or underscores.", el.handle);

    if (errs.length) {
      errs[0].focus();
      form.classList.remove("shake");
      void form.offsetWidth; // restart animation
      form.classList.add("shake");
    }
    return !errs.length;
  };
  form.addEventListener("animationend", () => form.classList.remove("shake"));

  // ---------- simulated launch ----------
  let timers = [];
  let running = false;
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  // Next Sunday 20:00 local (today if it's Sunday before 20:00)
  const nextSunday = () => {
    const d = new Date();
    d.setHours(20, 0, 0, 0);
    d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 7);
    return d.getTime();
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      RP.toast("Post text copied");
    } catch (e) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;opacity:0;left:0;top:0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        RP.toast(ok ? "Post text copied" : "Couldn't copy. Select the text and copy it.");
      } catch (e2) {
        RP.toast("Couldn't copy. Select the text and copy it.");
      }
    }
  };

  const finish = (ok) => {
    clearTimers();
    running = false;
    el.btn.disabled = false;
    if (!ok) RP.toast("Launch cancelled. Nothing was deployed.");
  };

  const launch = () => {
    const v = vals();
    const buy = Math.max(0, parseFloat(el.buy && el.buy.value) || 0);
    const cfg = { pool: state.pool, winners: state.winners, elig: state.elig };
    const text = postText(v);
    const coin = {
      id: v.ticker.toLowerCase() + "-" + Date.now(),
      name: v.name, ticker: v.ticker, creator: v.handle,
      img: state.img || undefined,
      mc: Math.round(4200 + buy * 150), vol7d: 0, replies: 0, holders: 1, paidTotal: 0,
      pool: cfg.pool, winners: cfg.winners, verifiedOnly: cfg.elig === "verified",
      phase: "replies", endsAt: nextSunday(), post: text, isNew: true, demo: true,
    };
    const steps = [
      "Creating token on pump.fun" + (buy ? ` · initial buy ${buy} SOL` : ""),
      "Routing creator fee to ReplyPay vault",
      `Locking split: You ${100 - cfg.pool}% · Replies ${cfg.pool}%`,
      `Setting up weekly contest (Top ${cfg.winners})`,
    ];
    const intent = "https://x.com/intent/post?text=" + encodeURIComponent(text);

    const body = RP.modal.open(`
      <div class="lp">
        <div class="lp-head">
          <span class="demo-flag">Demo — nothing is deployed</span>
          <h3>Launching $${esc(v.ticker)}</h3>
        </div>
        <div class="lp-steps">${steps.map((s) => `<div class="lp-step"><span class="st"></span><span>${esc(s)}</span></div>`).join("")}</div>
        <div class="lp-final">
          <div class="lf-coin">
            <div class="art">${coinArt(coin)}</div>
            <div class="meta"><b>${esc(v.name)}</b><small>$${esc(v.ticker)} · by @${esc(v.handle)} · ${cfg.pool}% to replies · top ${cfg.winners}</small></div>
          </div>
          <div class="lf-card">
            <h4>Post your first home post</h4>
            <p>Replies to this post enter this week's contest. Winners get paid Sunday 20:00.</p>
            <div class="pv-post"><svg class="xi"><use href="#x-logo"/></svg>${esc(text)}</div>
            <div class="lf-actions">
              <a class="btn btn-x" href="${esc(intent)}" target="_blank" rel="noopener"><svg class="xi"><use href="#x-logo"/></svg> Post on X</a>
              <button type="button" class="btn btn-ghost" data-lf="copy">Copy text</button>
              <button type="button" class="btn btn-white" data-lf="done">Done</button>
            </div>
          </div>
        </div>
      </div>`);

    running = true;
    el.btn.disabled = true;
    const rows = $$(".lp-step", body);

    rows.forEach((r, i) => {
      later(() => {
        if (i > 0) { rows[i - 1].classList.remove("run"); rows[i - 1].classList.add("done"); }
        r.classList.add("run");
      }, i * STEP_MS);
    });
    later(() => {
      const last = rows[rows.length - 1];
      last.classList.remove("run");
      last.classList.add("done");
      $(".lp-final", body).classList.add("show");
      RP.coins.unshift(coin);
      document.dispatchEvent(new CustomEvent("rp:coinlaunched", { detail: coin }));
      finish(true);
      RP.toast(`$${v.ticker} launched (demo)`);
    }, rows.length * STEP_MS);

    $(".lf-actions", body).addEventListener("click", (e) => {
      const b = e.target.closest("[data-lf]");
      if (!b) return;
      if (b.dataset.lf === "copy") copyText(text);
      else RP.modal.close();
    });
  };

  document.addEventListener("rp:modalclose", () => { if (running) finish(false); });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (running) return;
    if (validate()) launch();
  });

  // ---------- init ----------
  state.pool = +el.pool.value || 50;
  renderAll();
})();
