/* Tenth House Studio — motion layer.
   Only transform/opacity are animated. Everything is skipped when the visitor
   prefers reduced motion. No scroll-jacking: native scrolling is never altered. */
(function () {
  "use strict";
  var d = document.documentElement;
  var RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FINE = window.matchMedia("(pointer: fine)").matches;
  var ready = false, readyFns = [];
  function onReady(fn) { ready ? fn() : readyFns.push(fn); }
  function fireReady() { if (ready) return; ready = true; readyFns.forEach(function (f) { f(); }); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }


  /* ---------- film grain + vignette ---------- */
  if (!RM) {
    ["grain", "vignette"].forEach(function (c) { var g = document.createElement("div"); g.className = c; g.setAttribute("aria-hidden", "true"); document.body.appendChild(g); });
  }

  /* ---------- running timecode (24 fps) ---------- */
  var tcEls = document.querySelectorAll("[data-tc]"), tc0 = performance.now();
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  if (tcEls.length) (function tc(now) {
    var f = Math.floor((now - tc0) / (1000 / 24)), s = Math.floor(f / 24), m = Math.floor(s / 60);
    var txt = "00:" + pad(m % 60) + ":" + pad(s % 60) + ":" + pad(f % 24);
    tcEls.forEach(function (el) { el.textContent = txt; });
    requestAnimationFrame(tc);
  })(tc0);

  /* ---------- intro loader ---------- */
  var loader = document.querySelector(".loader");
  if (loader && d.classList.contains("has-loader") && !RM) {
    try { sessionStorage.setItem("ths-seen", "1"); } catch (e) {}
    var count = loader.querySelector(".loader__count"), bar = loader.querySelector(".loader__bar");
    var t0 = performance.now(), dur = 2700;
    (function tick(now) {
      var p = clamp((now - t0) / dur, 0, 1), eased = 1 - Math.pow(1 - p, 3);
      count.textContent = Math.round(eased * 100) + "%";
      if (bar) bar.style.transform = "scaleX(" + eased + ")";
      if (p < 1) requestAnimationFrame(tick);
      else {
        loader.classList.add("is-done");
        setTimeout(fireReady, 350);
        setTimeout(function () { d.classList.remove("has-loader"); loader.remove(); }, 1500);
      }
    })(t0);
  } else {
    if (loader) loader.remove();
    d.classList.remove("has-loader");
  }

  /* ---------- page transition curtain ---------- */
  var curtain = document.querySelector(".curtain");
  if (curtain) {
    if (d.classList.contains("pt-in")) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          d.classList.remove("pt-in");
          curtain.classList.add("is-out");
          setTimeout(function () {
            curtain.style.transition = "none";
            curtain.classList.remove("is-out");
            void curtain.offsetWidth;
            curtain.style.transition = "";
          }, 700);
          setTimeout(fireReady, 250);
        });
      });
    } else if (!loader || !d.classList.contains("has-loader")) {
      fireReady();
    }
    if (!RM) {
      document.addEventListener("click", function (e) {
        var a = e.target.closest("a[href]");
        if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        var href = a.getAttribute("href");
        if (!href || href.charAt(0) === "#" || a.target === "_blank" || /^(https?:|mailto:|tel:)/i.test(href) || a.hasAttribute("data-lightbox")) return;
        var url = new URL(a.href, location.href);
        if (url.pathname === location.pathname && url.hash) return;
        e.preventDefault();
        try { sessionStorage.setItem("ths-pt", "1"); } catch (_) {}
        curtain.classList.add("is-in");
        setTimeout(function () { location.href = a.href; }, 560);
      });
      window.addEventListener("pageshow", function (e) { if (e.persisted) curtain.classList.remove("is-in"); });
    }
  } else { fireReady(); }

  if (RM) { fireReady(); return; }

  /* ---------- scroll progress hairline ---------- */
  var prog = document.createElement("div"); prog.className = "progress-line"; prog.setAttribute("aria-hidden", "true"); document.body.appendChild(prog);

  /* ---------- inertial smooth scrolling (mouse wheel on desktop only) ----------
     Keyboard, touch, scrollbar dragging, anchors and find-in-page stay native. */
  if (FINE) {
    var target = window.scrollY, current = window.scrollY, smoothing = false;
    d.classList.add("has-smooth");
    window.addEventListener("wheel", function (e) {
      if (e.ctrlKey || e.defaultPrevented || document.body.classList.contains("menu-open") || document.body.style.overflow === "hidden") return;
      var el = e.target; while (el && el !== document.body) { var cs = getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight) return; el = el.parentElement; }
      e.preventDefault();
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (!smoothing) { target = current = window.scrollY; }
      target = clamp(target + e.deltaY * (e.deltaMode === 1 ? 32 : 1), 0, max);
      if (!smoothing) { smoothing = true; requestAnimationFrame(step); }
    }, { passive: false });
    function step() {
      current += (target - current) * 0.1;
      if (Math.abs(target - current) < 0.5) { current = target; smoothing = false; }
      window.scrollTo(0, current);
      if (smoothing) requestAnimationFrame(step);
    }
    ["keydown", "touchstart", "mousedown"].forEach(function (ev) { window.addEventListener(ev, function () { smoothing = false; }, { passive: true }); });
  }

  /* ---------- split-text headings ---------- */
  function split(el) {
    if (el.dataset.split) return;
    el.dataset.split = "1";
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            var w = document.createElement("span"), inner = document.createElement("span");
            w.className = "w"; inner.textContent = part; inner.style.setProperty("--i", i++);
            w.appendChild(inner); frag.appendChild(w);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
      });
    })(el);
    el.classList.add("split");
  }
  var splitTargets = document.querySelectorAll("main h1, .section-head h2, .hscroll__head h2, .svc-section > header h2, .cta-band h2, .founder h2, .founder-x h2, .final h2, .intro-grid h2, .feature-rows h2, .story h2");
  splitTargets.forEach(split);

  /* ---------- statement: words light up as you scroll ---------- */
  var statements = [];
  document.querySelectorAll(".statement").forEach(function (el) {
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            var s = document.createElement("span"); s.className = "sw"; s.textContent = part; frag.appendChild(s);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1) walk(n);
      });
    })(el);
    statements.push({ el: el, words: el.querySelectorAll(".sw") });
  });

  /* ---------- image reveals ---------- */
  document.querySelectorAll(".collection figure, .founder figure, .founder-x .media figure, .duo figure, .svc__media > button, .proj figure, .pf figure, .svc-card figure, .pscene__main, .pscene__second, .why2__intro figure").forEach(function (f) { f.classList.add("rimg"); });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target;
      if (el.closest(".hero-show")) return; // hero waits for ready
      el.classList.add("is-in");
      if (el.classList.contains("rimg")) setTimeout(function () { el.classList.add("is-done"); }, 1700);
      io.unobserve(el);
    });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.05 });
  document.querySelectorAll(".split, .rimg, .fade-up, .reveal-x").forEach(function (el) { io.observe(el); });

  /* ---------- testimonials slider ---------- */
  document.querySelectorAll("[data-tst]").forEach(function (box) {
    var items = box.querySelectorAll(".tst__item"), cnt = box.querySelector(".tst__count"), k = 0, tm;
    function show(n) {
      items[k].classList.remove("is-active"); items[k].setAttribute("aria-hidden", "true");
      k = (n + items.length) % items.length;
      items[k].classList.add("is-active"); items[k].removeAttribute("aria-hidden");
      if (cnt) cnt.textContent = String(k + 1).padStart(2, "0") + " / " + String(items.length).padStart(2, "0");
      clearTimeout(tm); tm = setTimeout(function () { show(k + 1); }, 8000);
    }
    box.querySelector(".tst-prev").addEventListener("click", function () { show(k - 1); });
    box.querySelector(".tst-next").addEventListener("click", function () { show(k + 1); });
    box.addEventListener("mouseenter", function () { clearTimeout(tm); });
    box.addEventListener("mouseleave", function () { tm = setTimeout(function () { show(k + 1); }, 4000); });
    show(0);
  });

  /* ---------- hero slideshow ---------- */
  var show = document.querySelector("[data-slideshow]");
  if (show) {
    var slides = show.querySelectorAll(".slide"), dots = show.querySelectorAll(".hero-show__nav button");
    var cur = 0, timer = null;
    function go(n) {
      slides[cur].classList.remove("is-active"); if (dots[cur]) { dots[cur].classList.remove("is-active"); dots[cur].removeAttribute("aria-current"); }
      cur = (n + slides.length) % slides.length;
      var img = slides[cur].querySelector("img"); if (img.loading === "lazy") img.loading = "eager";
      slides[cur].classList.add("is-active"); if (dots[cur]) { dots[cur].classList.add("is-active"); dots[cur].setAttribute("aria-current", "true"); }
      var no = show.querySelector("[data-scene-no]"), lb = show.querySelector("[data-scene-label]");
      if (no) no.textContent = pad(cur + 1); if (lb) lb.textContent = slides[cur].dataset.label || "";
      clearTimeout(timer); timer = setTimeout(function () { go(cur + 1); }, 6000);
    }
    dots.forEach(function (b, i) { b.addEventListener("click", function () { go(i); }); });
    document.addEventListener("visibilitychange", function () { if (document.hidden) clearTimeout(timer); else go(cur); });
    onReady(function () {
      show.querySelectorAll(".split").forEach(function (el) { el.classList.add("is-in"); });
      // warm up the next slides after first paint
      setTimeout(function () { slides.forEach(function (s) { var im = s.querySelector("img"); im.loading = "eager"; }); }, 1200);
      go(0);
    });
  }

  /* ---------- horizontal scroll section ---------- */
  var hs = document.querySelector(".hscroll"), track = hs && hs.querySelector(".hscroll__track"), dist = 0;
  function setupH() {
    if (!hs) return;
    var isStatic = window.innerWidth < 861;
    hs.classList.toggle("is-static", isStatic);
    if (isStatic) { hs.style.height = ""; track.style.transform = ""; return; }
    dist = Math.max(0, track.scrollWidth - window.innerWidth);
    hs.style.height = (dist + window.innerHeight) + "px";
  }
  function updateH() {
    if (!hs || hs.classList.contains("is-static")) return;
    var r = hs.getBoundingClientRect();
    var p = clamp(-r.top / Math.max(1, hs.offsetHeight - window.innerHeight), 0, 1);
    track.style.transform = "translate3d(" + (-p * dist).toFixed(1) + "px,0,0)";
    hs.style.setProperty("--p", p.toFixed(4));
  }

  /* ---------- header hide/show ---------- */
  var header = document.querySelector(".site-header"), lastY = window.scrollY, wa = document.querySelector(".wa-float");

  /* ---------- scroll loop (parallax, statement, horizontal, header) ---------- */
  var ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var y = window.scrollY, vh = window.innerHeight;
      if (header && !document.body.classList.contains("menu-open")) {
        header.classList.toggle("is-hidden", y > lastY && y > 160);
      }
      lastY = y;
      if (wa) wa.classList.toggle("is-visible", y > vh * 0.6);
      prog.style.transform = "scaleX(" + (y / Math.max(1, document.documentElement.scrollHeight - vh)).toFixed(4) + ")";
      document.querySelectorAll(".final > figure").forEach(function (f) {
        var r = f.parentNode.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        f.style.setProperty("--py", ((r.top + r.height / 2 - vh / 2) * -0.12).toFixed(1) + "px");
      });
      document.querySelectorAll(".rimg.is-done").forEach(function (f) {
        var r = f.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        var off = (r.top + r.height / 2 - vh / 2) * -0.06;
        f.style.setProperty("--py", off.toFixed(1) + "px");
      });
      statements.forEach(function (s) {
        var r = s.el.getBoundingClientRect();
        var p = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.35), 0, 1);
        var n = Math.round(p * s.words.length);
        s.words.forEach(function (w, i) { w.classList.toggle("on", i < n); });
      });
      updateH();
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", function () { setupH(); onScroll(); });
  window.addEventListener("load", function () { setupH(); onScroll(); });
  setupH(); onScroll();

  if (!FINE) return;

  var mx = 0, my = 0;
  window.addEventListener("mousemove", function (e) { mx = e.clientX; my = e.clientY; }, { passive: true });

  /* ---------- hover image preview for service lists ---------- */
  var rows = document.querySelectorAll("[data-preview]"), hp = null, px = 0, py = 0, hx = 0, hy = 0;
  if (rows.length) {
    hp = document.createElement("div"); hp.className = "hover-preview"; hp.setAttribute("aria-hidden", "true");
    var imgs = {};
    rows.forEach(function (r) {
      var u = r.dataset.preview; if (imgs[u]) return;
      var im = new Image(); im.src = u; im.alt = ""; im.decoding = "async"; hp.appendChild(im); imgs[u] = im;
    });
    document.body.appendChild(hp);
    rows.forEach(function (r) {
      r.addEventListener("mouseenter", function () {
        Object.keys(imgs).forEach(function (k) { imgs[k].classList.toggle("is-active", k === r.dataset.preview); });
        hp.classList.add("is-on");
      });
      r.addEventListener("mouseleave", function () { hp.classList.remove("is-on"); });
    });
  }

  /* ---------- magnetic buttons ---------- */
  document.querySelectorAll(".btn, .menu-toggle").forEach(function (b) {
    b.addEventListener("mousemove", function (e) {
      var r = b.getBoundingClientRect();
      var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      b.style.transform = "translate(" + (dx * 0.12).toFixed(1) + "px," + (dy * 0.18).toFixed(1) + "px)";
    });
    b.addEventListener("mouseleave", function () { b.style.transform = ""; });
  });

  if (hp) (function loop() {
    {
      hx += (mx - hx) * 0.12; hy += (my - hy) * 0.12;
      hp.style.transform = "translate3d(" + (hx + 40).toFixed(1) + "px," + (hy - 160).toFixed(1) + "px,0) scale(" + (hp.classList.contains("is-on") ? 1 : 0.6) + ")";
    }
    requestAnimationFrame(loop);
  })();
})();
