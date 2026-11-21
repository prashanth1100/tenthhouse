/* Tenth House Studio — site behaviour (no dependencies) */
(function () {
  "use strict";
  var doc = document.documentElement;
  doc.classList.remove("no-js");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- header: scrolled state ---------- */
  var header = document.querySelector(".site-header");
  var bar = document.querySelector(".mobile-bar");
  function onScroll() {
    var y = window.scrollY;
    if (header) header.classList.toggle("is-scrolled", y > 8);
    if (bar) bar.classList.toggle("is-visible", y > 320);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- mobile menu ---------- */
  var toggle = document.querySelector(".menu-toggle");
  var menu = document.getElementById("mobile-menu");
  function setMenu(open) {
    document.body.classList.toggle("menu-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (open) {
      menu.removeAttribute("inert");
      var first = menu.querySelector("a");
      if (first) first.focus();
    } else {
      menu.setAttribute("inert", "");
    }
  }
  if (toggle && menu) {
    menu.setAttribute("inert", "");
    toggle.addEventListener("click", function () {
      setMenu(!document.body.classList.contains("menu-open"));
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.body.classList.contains("menu-open")) {
        setMenu(false);
        toggle.focus();
      }
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 1024 && document.body.classList.contains("menu-open")) setMenu(false);
    });
  }

  /* ---------- scroll reveals ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if (!reduceMotion && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------- gallery image loading state ---------- */
  document.querySelectorAll(".tile img").forEach(function (img) {
    function done() { img.classList.add("is-loaded"); img.closest(".tile").classList.add("is-loaded"); }
    if (img.complete && img.naturalWidth) done();
    else { img.addEventListener("load", done); img.addEventListener("error", done); }
  });

  /* ---------- portfolio filter ---------- */
  var filterBar = document.querySelector("[data-filters]");
  if (filterBar) {
    var tiles = document.querySelectorAll(".masonry .tile");
    function applyFilter(cat, push) {
      filterBar.querySelectorAll("button").forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.dataset.filter === cat));
      });
      tiles.forEach(function (t) {
        t.hidden = !(cat === "all" || t.dataset.cat === cat);
      });
      var status = document.getElementById("filter-status");
      var visible = Array.prototype.filter.call(tiles, function (t) { return !t.hidden; }).length;
      if (status) status.textContent = visible + " photographs shown";
      if (push) history.replaceState(null, "", cat === "all" ? location.pathname : "#" + cat);
    }
    filterBar.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-filter]");
      if (b) applyFilter(b.dataset.filter, true);
    });
    var initial = location.hash.replace("#", "");
    if (initial && filterBar.querySelector('[data-filter="' + initial + '"]')) applyFilter(initial, false);
  }

  /* ---------- lightbox ---------- */
  var lb = document.getElementById("lightbox");
  if (lb) {
    var lbImg = lb.querySelector(".lb-stage img");
    var lbCap = lb.querySelector(".lb-caption");
    var lbCount = lb.querySelector(".lb-count");
    var items = [], index = 0, lastFocus = null;

    function groupFor(trigger) {
      var group = trigger.dataset.group;
      return Array.prototype.filter.call(
        document.querySelectorAll('[data-lightbox][data-group="' + group + '"]'),
        function (el) { return !el.hidden; }
      );
    }
    function show(i, dir) {
      index = (i + items.length) % items.length;
      var el = items[index];
      var swap = function () {
        lbImg.src = el.dataset.full;
        lbImg.alt = el.dataset.alt || "";
        lbCap.textContent = el.dataset.caption || "";
        lbCount.textContent = (index + 1) + " / " + items.length;
        // preload neighbours
        [index + 1, index - 1].forEach(function (n) {
          var nb = items[(n + items.length) % items.length];
          if (nb) { var p = new Image(); p.src = nb.dataset.full; }
        });
      };
      if (reduceMotion || !dir) { swap(); return; }
      lbImg.classList.add("is-swapping");
      setTimeout(function () {
        swap();
        lbImg.onload = function () { lbImg.classList.remove("is-swapping"); };
        if (lbImg.complete) lbImg.classList.remove("is-swapping");
      }, 180);
    }
    function open(trigger) {
      items = groupFor(trigger);
      lastFocus = trigger;
      show(items.indexOf(trigger));
      lb.classList.add("is-open");
      lb.removeAttribute("inert");
      lb.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      lb.querySelector(".lb-close").focus();
    }
    function close() {
      lb.classList.remove("is-open");
      lb.setAttribute("inert", "");
      lb.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      if (lastFocus) lastFocus.focus();
    }
    lb.setAttribute("inert", "");

    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-lightbox]");
      if (t) { e.preventDefault(); open(t); }
    });
    lb.querySelector(".lb-close").addEventListener("click", close);
    lb.querySelector(".lb-prev").addEventListener("click", function () { show(index - 1, -1); });
    lb.querySelector(".lb-next").addEventListener("click", function () { show(index + 1, 1); });
    lb.querySelector(".lb-stage").addEventListener("click", function (e) { if (e.target === e.currentTarget) close(); });

    document.addEventListener("keydown", function (e) {
      if (!lb.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") show(index + 1, 1);
      else if (e.key === "ArrowLeft") show(index - 1, -1);
      else if (e.key === "Tab") {
        // focus trap
        var f = lb.querySelectorAll("button");
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    // touch swipe
    var x0 = null, y0 = null;
    var stage = lb.querySelector(".lb-stage");
    stage.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    stage.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) close();
      x0 = y0 = null;
    }, { passive: true });
  }

  /* ---------- expanding portrait panels: auto-play one by one ---------- */
  document.querySelectorAll("[data-xpanels]").forEach(function (wrap) {
    var panels = Array.prototype.slice.call(wrap.querySelectorAll(".xp"));
    var RMx = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var mobile = function () { return window.matchMedia("(max-width: 900px)").matches; };
    var idx = 0, timer = null, inView = false, paused = false, DELAY = 3200;
    function activate(n, fromAuto) {
      idx = (n + panels.length) % panels.length;
      panels.forEach(function (x, i) { x.classList.toggle("is-active", i === idx); });
      if (mobile() && fromAuto) wrap.scrollTo({ left: panels[idx].offsetLeft - wrap.offsetLeft, behavior: RMx ? "auto" : "smooth" });
      schedule();
    }
    function schedule() {
      clearTimeout(timer);
      if (RMx || paused || !inView) return;
      wrap.style.setProperty("--xp-dur", DELAY + "ms");
      panels.forEach(function (x) { x.classList.remove("is-timing"); });
      void wrap.offsetWidth;
      panels[idx].classList.add("is-timing");
      timer = setTimeout(function () { activate(idx + 1, true); }, DELAY);
    }
    function pause() { paused = true; clearTimeout(timer); panels.forEach(function (x) { x.classList.remove("is-timing"); }); }
    function resume() { paused = false; schedule(); }
    panels.forEach(function (p, i) {
      p.addEventListener("mouseenter", function () { if (window.matchMedia("(hover: hover)").matches) { activate(i); pause(); } });
      p.addEventListener("focusin", function () { activate(i); pause(); });
      p.addEventListener("click", function (e) { if (!p.classList.contains("is-active")) { e.preventDefault(); activate(i); } });
      p.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target === p) activate(i); });
    });
    wrap.addEventListener("mouseleave", resume);
    wrap.addEventListener("focusout", function (e) { if (!wrap.contains(e.relatedTarget)) resume(); });
    wrap.addEventListener("touchstart", function () { pause(); setTimeout(resume, 6000); }, { passive: true });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { inView = es[0].isIntersecting; inView ? schedule() : clearTimeout(timer); }, { threshold: 0.35 }).observe(wrap);
    }
    document.addEventListener("visibilitychange", function () { document.hidden ? clearTimeout(timer) : schedule(); });
  });
  /* reveal-x fallback when the motion layer is off */
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) document.querySelectorAll(".reveal-x").forEach(function (el) { el.classList.add("is-in"); });

  /* ---------- bento cards: glow follows the pointer ---------- */
  document.querySelectorAll(".bcard").forEach(function (c) {
    c.addEventListener("pointermove", function (e) {
      var r = c.getBoundingClientRect();
      c.style.setProperty("--mx", (e.clientX - r.left) + "px");
      c.style.setProperty("--my", (e.clientY - r.top) + "px");
    });
  });

  /* ---------- back to top ---------- */
  document.querySelectorAll("[data-totop]").forEach(function (b) {
    b.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); });
  });

  /* ---------- contact form ---------- */
  var form = document.getElementById("enquiry-form");
  if (form) {
    var started = Date.now();
    var params = new URLSearchParams(location.search);
    var svc = params.get("service");
    if (svc) {
      var sel = form.querySelector("#f-service");
      Array.prototype.forEach.call(sel.options, function (o) { if (o.value === svc) sel.value = svc; });
    }
    var dateInput = form.querySelector("#f-date");
    if (dateInput) dateInput.min = new Date().toISOString().slice(0, 10);

    var rules = {
      name: function (v) { return v.trim().length >= 2 || "Please enter your name."; },
      phone: function (v) { return /^[+\d][\d\s-]{7,15}$/.test(v.trim()) || "Please enter a valid phone number."; },
      email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || "Please enter a valid email address."; },
      service: function (v) { return v !== "" || "Please choose a service."; },
      message: function (v) { return v.trim().length >= 10 || "Please tell us a little more (at least 10 characters)."; }
    };
    function check(input) {
      var rule = rules[input.name];
      if (!rule) return true;
      var res = rule(input.value);
      var field = input.closest(".field");
      var err = field.querySelector(".err");
      if (res === true) { field.classList.remove("invalid"); input.removeAttribute("aria-invalid"); return true; }
      field.classList.add("invalid"); input.setAttribute("aria-invalid", "true"); err.textContent = res; return false;
    }
    form.querySelectorAll("input, select, textarea").forEach(function (el) {
      el.addEventListener("blur", function () { if (el.value) check(el); });
      el.addEventListener("input", function () { if (el.closest(".field") && el.closest(".field").classList.contains("invalid")) check(el); });
    });

    function whatsappText(data) {
      return "Hello Tenth House Studio,%0A%0A" + encodeURIComponent(
        "Name: " + data.get("name") + "\nPhone: " + data.get("phone") + "\nEmail: " + data.get("email") +
        "\nService: " + data.get("service") + "\nPreferred date: " + (data.get("date") || "Flexible") +
        "\n\n" + data.get("message"));
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true, firstBad = null;
      form.querySelectorAll("[name]").forEach(function (el) {
        if (!check(el)) { ok = false; firstBad = firstBad || el; }
      });
      if (!ok) { firstBad.focus(); return; }
      var data = new FormData(form);
      data.append("elapsed", String(Date.now() - started));
      var status = form.querySelector(".form-status");
      var btn = form.querySelector("button[type=submit]");
      btn.disabled = true; btn.textContent = "Sending…";

      var fail = function () {
        status.className = "form-status is-error";
        status.innerHTML = '<h3>We couldn’t send that just now.</h3><p>Nothing is lost — send the same details on WhatsApp or by email instead.</p>' +
          '<div class="btn-row"><a class="btn btn--solid" target="_blank" rel="noopener" href="https://wa.me/918500403725?text=' + whatsappText(data) + '">Send on WhatsApp</a>' +
          '<a class="btn btn--ghost" href="mailto:Tenthhouseportraits@gmail.com?subject=' + encodeURIComponent("Session enquiry: " + data.get("service")) + '&body=' + whatsappText(data).replace("%0A%0A", "%0D%0A%0D%0A") + '">Email instead</a></div>';
        status.focus();
        btn.disabled = false; btn.textContent = "Send enquiry";
      };

      if (location.protocol === "file:") { fail(); return; }
      fetch(form.action, { method: "POST", body: data, headers: { "Accept": "application/json" } })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok || !res.j.ok) throw new Error((res.j && res.j.error) || "error");
          status.className = "form-status is-success";
          status.innerHTML = "<h3>Thank you — your enquiry is in.</h3><p>We’ll get back to you soon. For anything urgent, call or WhatsApp 85004 03725.</p>";
          form.querySelectorAll(".field").forEach(function (f) { f.style.display = "none"; });
          btn.style.display = "none";
          status.focus();
        })
        .catch(fail);
    });
  }
})();
