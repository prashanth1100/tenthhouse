/* Tenth House Studio — 3D layer.
   Dependency-free: a small WebGL renderer (bokeh light field + camera-aperture
   object) and CSS 3D motion (hero depth, card tilt, scroll-scrubbed reveals,
   cover-flow reel, testimonial flip, extruded footer word).
   Skipped entirely when the visitor prefers reduced motion. */
(function () {
  "use strict";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var d = document.documentElement;
  d.classList.add("t3d");
  var FINE = window.matchMedia("(pointer: fine)").matches;
  var SMALL = window.innerWidth < 760;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  /* ---------- shared pointer (normalised -1..1, smoothed) ---------- */
  var P = { x: 0, y: 0, sx: 0, sy: 0 };
  window.addEventListener("pointermove", function (e) {
    P.x = (e.clientX / window.innerWidth) * 2 - 1;
    P.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  /* =====================================================================
     WebGL scenes
     ===================================================================== */
  var VS_PTS = [
    "attribute vec3 aPos; attribute vec3 aSeed;",
    "uniform mat3 uRot; uniform vec3 uOff; uniform float uDist, uF, uAspect, uTime, uSize, uDpr;",
    "varying float vA; varying float vTone; varying float vRing;",
    "void main(){",
    "  vec3 p = aPos;",
    "  p.y += sin(uTime*0.35*(0.6+aSeed.x) + aSeed.y*6.283)*0.18;",
    "  p.x += cos(uTime*0.25*(0.6+aSeed.y) + aSeed.x*6.283)*0.14;",
    "  vec3 v = uRot * p + uOff; v.z -= uDist;",
    "  float w = -v.z;",
    "  gl_Position = vec4(v.x*uF/uAspect, v.y*uF, 0.0, w);",
    "  float tw = 0.65 + 0.35*sin(uTime*(0.8+aSeed.z*1.6) + aSeed.x*20.0);",
    "  gl_PointSize = uSize * uDpr * (0.45 + aSeed.z*1.25) / max(w, 0.2);",
    "  vA = tw * smoothstep(9.0, 2.5, w) * smoothstep(0.25, 1.2, w);",
    "  vTone = aSeed.y; vRing = step(0.78, aSeed.x);",
    "}"].join("\n");
  var FS_PTS = [
    "precision mediump float;",
    "uniform vec3 uC1, uC2; uniform float uAlpha;",
    "varying float vA; varying float vTone; varying float vRing;",
    "void main(){",
    "  float r = length(gl_PointCoord - 0.5) * 2.0;",
    "  if (r > 1.0) discard;",
    "  float disc = smoothstep(1.0, 0.15, r);",
    "  float ring = smoothstep(1.0, 0.82, r) * smoothstep(0.55, 0.85, r) * 0.9 + disc * 0.18;",
    "  float a = mix(disc, ring, vRing) * vA * uAlpha;",
    "  gl_FragColor = vec4(mix(uC1, uC2, vTone), a);",
    "}"].join("\n");
  var VS_LINE = [
    "attribute vec3 aPos;",
    "uniform mat3 uRot; uniform vec3 uOff; uniform float uDist, uF, uAspect;",
    "varying float vD;",
    "void main(){ vec3 v = uRot * aPos + uOff; v.z -= uDist; float w = -v.z;",
    "  gl_Position = vec4(v.x*uF/uAspect, v.y*uF, 0.0, w); vD = w; }"].join("\n");
  var FS_LINE = [
    "precision mediump float; uniform vec3 uC; uniform float uAlpha, uDistF; varying float vD;",
    "void main(){ float f = clamp(1.0 - (vD - uDistF + 1.2) / 2.4, 0.25, 1.0); gl_FragColor = vec4(uC, uAlpha * f); }"].join("\n");

  function compile(gl, vs, fs) {
    function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
    return { p: p, u: u, a: function (nm) { return gl.getAttribLocation(p, nm); } };
  }
  function hex(h) { h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }
  function rot(ax, ay, az) {
    var cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay), cz = Math.cos(az), sz = Math.sin(az);
    // R = Ry * Rx * Rz  (column-major for GLSL)
    var m00 = cy * cz + sy * sx * sz, m01 = -cy * sz + sy * sx * cz, m02 = sy * cx;
    var m10 = cx * sz, m11 = cx * cz, m12 = -sx;
    var m20 = -sy * cz + cy * sx * sz, m21 = sy * sz + cy * sx * cz, m22 = cy * cx;
    return new Float32Array([m00, m10, m20, m01, m11, m21, m02, m12, m22]);
  }

  /* camera-aperture geometry: lens barrel rings, focus ticks, 9 iris blades */
  var BLADES = 9, BSEG = 10;
  function apertureStatic() {
    var v = [];
    function ring(r, z, seg) { for (var i = 0; i < seg; i++) { var a = i / seg * 6.2832, b = (i + 1) / seg * 6.2832; v.push(Math.cos(a) * r, Math.sin(a) * r, z, Math.cos(b) * r, Math.sin(b) * r, z); } }
    ring(1.0, 0.0, 120); ring(1.08, 0.04, 120); ring(1.22, -0.18, 120); ring(1.22, 0.22, 120); ring(0.94, 0.3, 96);
    for (var i = 0; i < 72; i++) { var a = i / 72 * 6.2832, L = i % 6 === 0 ? 0.11 : 0.05; v.push(Math.cos(a) * 1.22, Math.sin(a) * 1.22, 0.22, Math.cos(a) * (1.22 + L), Math.sin(a) * (1.22 + L), 0.22); }
    for (i = 0; i < 24; i++) { a = i / 24 * 6.2832; v.push(Math.cos(a) * 1.22, Math.sin(a) * 1.22, -0.18, Math.cos(a) * 1.22, Math.sin(a) * 1.22, 0.22); }
    return new Float32Array(v);
  }
  function apertureBlades(open, out) {
    var k = 0, inner = 0.18 + open * 0.55;
    for (var b = 0; b < BLADES; b++) {
      var a0 = b / BLADES * 6.2832;
      var px = Math.cos(a0) * 1.0, py = Math.sin(a0) * 1.0;
      for (var s = 1; s <= BSEG; s++) {
        var t = s / BSEG, ang = a0 + t * (1.35 - open * 0.5), r = 1.0 + (inner - 1.0) * Math.sin(t * 1.5708);
        var x = Math.cos(ang) * r, y = Math.sin(ang) * r, z = 0.02 + t * 0.06;
        out[k++] = px; out[k++] = py; out[k++] = z - 0.06 / BSEG; out[k++] = x; out[k++] = y; out[k++] = z;
        px = x; py = y;
      }
    }
    return out;
  }

  var scenes = [];
  function makeScene(host, opt) {
    var cv = document.createElement("canvas");
    cv.className = "gl3d " + (opt.cls || ""); cv.setAttribute("aria-hidden", "true");
    host.insertBefore(cv, host.firstChild);
    var gl = cv.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false });
    if (!gl) { cv.remove(); return; }
    var pts = compile(gl, VS_PTS, FS_PTS), lin = compile(gl, VS_LINE, FS_LINE);
    if (!pts || !lin) { cv.remove(); return; }
    var N = opt.count, pos = new Float32Array(N * 3), seed = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * opt.spread[0];
      pos[i * 3 + 1] = (Math.random() * 2 - 1) * opt.spread[1];
      pos[i * 3 + 2] = (Math.random() * 2 - 1) * opt.spread[2];
      seed[i * 3] = Math.random(); seed[i * 3 + 1] = Math.random(); seed[i * 3 + 2] = Math.pow(Math.random(), 2.2);
    }
    function buf(data, usage) { var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, usage || gl.STATIC_DRAW); return b; }
    var bPos = buf(pos), bSeed = buf(seed), apS, bApS, apB, bApB;
    if (opt.aperture) { apS = apertureStatic(); bApS = buf(apS); apB = new Float32Array(BLADES * BSEG * 6); bApB = buf(apB, gl.DYNAMIC_DRAW); }
    var S = { host: host, cv: cv, gl: gl, visible: true, w: 0, h: 0, dpr: 1, t0: performance.now(), scroll: 0 };
    function resize() {
      var r = host.getBoundingClientRect();
      S.dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      S.w = Math.max(1, r.width); S.h = Math.max(1, r.height);
      cv.width = Math.round(S.w * S.dpr); cv.height = Math.round(S.h * S.dpr);
    }
    resize();
    var c1 = hex(opt.c1), c2 = hex(opt.c2), lc = hex(opt.line || opt.c1);
    function common(pr, R, off, dist, aspect) {
      gl.uniformMatrix3fv(pr.u.uRot, false, R);
      gl.uniform3fv(pr.u.uOff, off); gl.uniform1f(pr.u.uDist, dist);
      gl.uniform1f(pr.u.uF, 1.0 / Math.tan(0.42)); gl.uniform1f(pr.u.uAspect, aspect);
    }
    S.draw = function (now) {
      var t = (now - S.t0) / 1000, aspect = S.w / S.h;
      gl.viewport(0, 0, cv.width, cv.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, opt.additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
      var sc = S.scroll;
      var R = rot(P.sy * 0.12 + sc * 0.25, P.sx * 0.18 + t * 0.015, 0);
      // particles
      gl.useProgram(pts.p);
      common(pts, R, [0, sc * 1.2, 0], 4.2 - sc * 1.4, aspect);
      gl.uniform1f(pts.u.uTime, t); gl.uniform1f(pts.u.uSize, opt.size); gl.uniform1f(pts.u.uDpr, S.dpr);
      gl.uniform3fv(pts.u.uC1, c1); gl.uniform3fv(pts.u.uC2, c2); gl.uniform1f(pts.u.uAlpha, opt.alpha);
      var aP = pts.a("aPos"), aS = pts.a("aSeed");
      gl.bindBuffer(gl.ARRAY_BUFFER, bPos); gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bSeed); gl.enableVertexAttribArray(aS); gl.vertexAttribPointer(aS, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.POINTS, 0, N);
      gl.disableVertexAttribArray(aS);
      // aperture
      if (opt.aperture) {
        var ap = opt.aperture, wide = S.w > 860;
        var AR = rot(-0.35 + P.sy * 0.3 + Math.sin(t * 0.4) * 0.06 + sc * 0.6, (wide ? -0.55 : -0.2) + P.sx * 0.45 + Math.sin(t * 0.3) * 0.1, t * 0.12);
        var open = 0.5 + 0.5 * Math.sin(t * 0.55);
        gl.useProgram(lin.p);
        var ox = wide ? ap.x * aspect : 0, oy = wide ? ap.y : 0.15;
        common(lin, AR, [0, 0, 0], ap.dist + (wide ? 0 : 1.6), aspect);
        // offset applied after rotation in screen space: shift via uOff in rotated frame is fine for small values
        var dd = ap.dist + (wide ? 0 : 1.6); gl.uniform3fv(lin.u.uOff, [ox * dd / 2.24, oy * dd / 2.24, 0]);
        gl.uniform3fv(lin.u.uC, lc); gl.uniform1f(lin.u.uDistF, ap.dist + (wide ? 0 : 1.6));
        var aL = lin.a("aPos");
        gl.uniform1f(lin.u.uAlpha, ap.alpha * (wide ? 1 : 0.55));
        gl.bindBuffer(gl.ARRAY_BUFFER, bApS); gl.enableVertexAttribArray(aL); gl.vertexAttribPointer(aL, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.LINES, 0, apS.length / 3);
        apertureBlades(open, apB);
        gl.bindBuffer(gl.ARRAY_BUFFER, bApB); gl.bufferSubData(gl.ARRAY_BUFFER, 0, apB);
        gl.vertexAttribPointer(aL, 3, gl.FLOAT, false, 0, 0);
        gl.uniform1f(lin.u.uAlpha, ap.alpha * 1.25 * (wide ? 1 : 0.55));
        gl.drawArrays(gl.LINES, 0, apB.length / 3);
      }
    };
    S.resize = resize;
    new IntersectionObserver(function (en) { S.visible = en[0].isIntersecting; }, { rootMargin: "100px" }).observe(host);
    scenes.push(S);
    return S;
  }

  var heroEl = document.querySelector(".hero-show");
  if (heroEl) makeScene(heroEl, { cls: "gl3d--hero", count: SMALL ? 90 : 190, spread: [3.4, 2.2, 2.6], size: 44, alpha: 0.85, additive: true, c1: "#f3d9a4", c2: "#ffffff" });
  $$(".page-hero").forEach(function (ph) {
    makeScene(ph, { cls: "gl3d--page", count: SMALL ? 40 : 80, spread: [3.6, 1.8, 2.4], size: 26, alpha: 0.32, additive: false, c1: "#b08d57", c2: "#e3c48f",
      aperture: { x: 0.62, y: 0.05, dist: 2.6, alpha: 0.6 }, line: "#9a7845" });
  });
  var nf = document.querySelector(".notfound");
  if (nf) makeScene(nf, { cls: "gl3d--page", count: 70, spread: [3.6, 2.2, 2.4], size: 26, alpha: 0.32, c1: "#b08d57", c2: "#e3c48f",
    aperture: { x: 0, y: 0, dist: 3.6, alpha: 0.55 }, line: "#9a7845" });
  $$(".final, .section.dark").forEach(function (f) {
    makeScene(f, { cls: "gl3d--final", count: SMALL ? 50 : 110, spread: [3.4, 2.2, 2.4], size: 30, alpha: 0.5, additive: true, c1: "#e3c48f", c2: "#ffffff" });
  });

  /* =====================================================================
     CSS 3D
     ===================================================================== */
  // hero depth
  var heroContent = heroEl && heroEl.querySelector(".hero-show__content");

  // scroll-scrubbed 3D reveals
  var revealSel = ".section-head, .pscene__text, .svc-section > header, .story > div, .founder-x, .why2__intro, .why2__list, .hscroll__head, .page-hero > *, .intro-grid > *, .feature-rows > *, .final .inner";
  var reveals = $$(revealSel).filter(function (el) { return !el.closest(".hero-show"); });
  reveals.forEach(function (el) { el.classList.add("r3d"); if (el.parentElement) el.parentElement.classList.add("p3d"); });

  // tilt cards with glare
  var tiltSel = ".bcard, .svc-card, .collection figure, .pf figure, .pscene__main, .pscene__second, .duo figure, .founder-x .media figure, .why2__intro figure, .tst, .svc__media > button, .xp";
  var tilts = FINE ? $$(tiltSel) : [];
  tilts.forEach(function (el) {
    el.classList.add("tilt3d");
    if (el.parentElement) el.parentElement.classList.add("p3d");
    var g = document.createElement("span"); g.className = "glare3d"; g.setAttribute("aria-hidden", "true"); el.appendChild(g);
    var tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, on = false;
    var max = el.matches(".tst") ? 4 : 9;
    function loop() {
      cx += (tx - cx) * 0.14; cy += (ty - cy) * 0.14;
      var ang = Math.sqrt(cx * cx + cy * cy) * max;
      if (ang < 0.02 && !on) { el.style.rotate = ""; el.style.translate = ""; raf = 0; return; }
      el.style.rotate = (-cy).toFixed(3) + " " + cx.toFixed(3) + " 0 " + ang.toFixed(2) + "deg";
      el.style.translate = "0 0 " + (on ? 24 : 24 * ang / max).toFixed(1) + "px";
      raf = requestAnimationFrame(loop);
    }
    el.addEventListener("pointermove", function (e) {
      var r = el.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      tx = px * 2 - 1; ty = py * 2 - 1; on = true;
      el.style.setProperty("--gx", (px * 100).toFixed(1) + "%"); el.style.setProperty("--gy", (py * 100).toFixed(1) + "%");
      el.classList.add("is-tilt");
      if (!raf) raf = requestAnimationFrame(loop);
    });
    el.addEventListener("pointerleave", function () { tx = ty = 0; on = false; el.classList.remove("is-tilt"); if (!raf) raf = requestAnimationFrame(loop); });
  });

  // cover-flow reel
  var track = document.querySelector(".hscroll__track"), projs = track ? $$(".proj", track) : [];
  if (track) track.classList.add("flow3d");

  // marquee ribbon reacts to scroll speed
  var marquees = $$(".marquee"), lastY = window.scrollY, vel = 0;

  // extruded footer word
  var fwords = $$(".fword");
  fwords.forEach(function (f) { f.classList.add("fword3d"); if (f.parentElement) f.parentElement.classList.add("p3d"); });

  /* ---------- premium cursor (mouse only) ---------- */
  var cur = null, dot = null, cx0 = -100, cy0 = -100, mx0 = -100, my0 = -100;
  if (FINE) {
    cur = document.createElement("div"); cur.className = "cur3d is-hidden"; cur.setAttribute("aria-hidden", "true");
    dot = document.createElement("div"); dot.className = "cur3d-dot is-hidden"; dot.setAttribute("aria-hidden", "true");
    document.body.appendChild(cur); document.body.appendChild(dot);
    window.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      mx0 = e.clientX; my0 = e.clientY;
      cur.classList.remove("is-hidden"); dot.classList.remove("is-hidden");
      var t = e.target;
      var view = t.closest && t.closest(".proj, .pf figure, .collection figure, [data-lightbox], .svc__media > button");
      var link = !view && t.closest && t.closest("a, button, [role=button], input, select, textarea, label");
      cur.classList.toggle("is-view", !!view); cur.classList.toggle("is-link", !!link);
    }, { passive: true });
    document.addEventListener("mouseleave", function () { cur.classList.add("is-hidden"); dot.classList.add("is-hidden"); });
  }

  /* ---------- main loop ---------- */
  function frame(now) {
    P.sx += (P.x - P.sx) * 0.06; P.sy += (P.y - P.sy) * 0.06;
    var vh = window.innerHeight, vw = window.innerWidth, y = window.scrollY;
    vel += ((y - lastY) - vel) * 0.15; lastY = y;

    // hero depth + scroll exit
    if (heroEl) {
      var hr = heroEl.getBoundingClientRect();
      if (hr.bottom > 0) {
        var sp = clamp(-hr.top / Math.max(1, hr.height), 0, 1);
        heroEl.style.setProperty("--hrx", (P.sy * -3 + sp * 10).toFixed(2) + "deg");
        heroEl.style.setProperty("--hry", (P.sx * 4).toFixed(2) + "deg");
        heroEl.style.setProperty("--hz", (-sp * 260).toFixed(1) + "px");
        heroEl.style.setProperty("--htx", (P.sx * -18).toFixed(1) + "px");
        heroEl.style.setProperty("--hty", (P.sy * -10 - sp * 120).toFixed(1) + "px");
        heroEl.style.setProperty("--hsp", sp.toFixed(3));
      }
    }

    // scenes
    scenes.forEach(function (S) {
      if (!S.visible || document.hidden) return;
      var r = S.host.getBoundingClientRect();
      S.scroll = clamp(-r.top / Math.max(1, vh), -1, 1);
      if (Math.abs(r.width - S.w) > 1 || Math.abs(r.height - S.h) > 1) S.resize();
      S.draw(now);
    });

    // reveals: rotate up from below like a card lifting into place
    for (var i = 0; i < reveals.length; i++) {
      var el = reveals[i], rr = el.getBoundingClientRect();
      if (rr.top > vh + 60 || rr.bottom < -60) continue;
      var p = clamp((vh - rr.top) / (vh * 0.55), 0, 1), e = 1 - Math.pow(1 - p, 3);
      el.style.rotate = "x " + ((1 - e) * 22).toFixed(2) + "deg";
      el.style.translate = "0 " + ((1 - e) * 40).toFixed(1) + "px " + ((1 - e) * -160).toFixed(1) + "px";
      el.style.opacity = (0.25 + e * 0.75).toFixed(3);
    }

    // cover-flow
    if (track) {
      var tr = track.getBoundingClientRect();
      track.style.perspectiveOrigin = (vw / 2 - tr.left).toFixed(0) + "px 50%";
      for (i = 0; i < projs.length; i++) {
        var pr = projs[i].getBoundingClientRect();
        if (pr.right < -200 || pr.left > vw + 200) continue;
        var c = clamp((pr.left + pr.width / 2 - vw / 2) / (vw / 2), -1.4, 1.4);
        projs[i].style.rotate = "y " + (-c * 24).toFixed(2) + "deg";
        projs[i].style.translate = "0 0 " + (-Math.abs(c) * 160 + 40).toFixed(1) + "px";
        projs[i].style.setProperty("--shade", Math.min(0.55, Math.abs(c) * 0.4).toFixed(3));
      }
    }

    // marquee ribbon
    var tilt = clamp(vel * 0.6, -28, 28).toFixed(2);
    for (i = 0; i < marquees.length; i++) marquees[i].style.rotate = "x " + tilt + "deg";

    // footer word follows pointer
    for (i = 0; i < fwords.length; i++) {
      var fr = fwords[i].getBoundingClientRect();
      if (fr.bottom < 0 || fr.top > vh) continue;
      var fp = clamp((vh - fr.top) / (vh * 0.8), 0, 1);
      fwords[i].style.rotate = (1).toFixed(0) + " " + (P.sx * 0.6).toFixed(3) + " 0 " + ((1 - fp) * 40 + P.sy * -6).toFixed(2) + "deg";
    }

    if (cur) {
      cx0 += (mx0 - cx0) * 0.18; cy0 += (my0 - cy0) * 0.18;
      cur.style.transform = "translate3d(" + cx0.toFixed(1) + "px," + cy0.toFixed(1) + "px,0)";
      dot.style.transform = "translate3d(" + mx0 + "px," + my0 + "px,0)";
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.addEventListener("resize", function () { SMALL = window.innerWidth < 760; scenes.forEach(function (S) { S.resize(); }); });
})();
