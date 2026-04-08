/**
 * ASCII Tennis Ball Animation
 * Spinning 3D tennis ball rendered in ASCII characters
 * Uses Paul Bourke's seam curve formula (paulbourke.net/geometry)
 *
 * Copyright (c) 2026 Carmelo Spanó (carmelospano.com)
 * Licensed under CC BY-NC-SA 4.0
 * https://creativecommons.org/licenses/by-nc-sa/4.0/
 *
 * You are free to share and adapt this work under the following terms:
 * - Attribution: credit Carmelo Spanó and link to carmelospano.com
 * - NonCommercial: no commercial use without permission
 * - ShareAlike: derivatives must use the same license
 *
 * Credit to Paul Bourke for the tennis ball seam parametric equation.
 */

(function () {
  // Ball geometry
  var W = 60, H = 34, cx = W / 2, cy = H / 2, Rx = 28, Ry = 15.8;
  var shade = [' ', '.', '\u00B7', ':', '\u2022', '+', '*', '#', '%', '@', '\u2593', '\u2588'];
  var sn = shade.length;

  // Light direction (upper-left-front)
  var lx = -0.42, ly = -0.58, lz = 0.7;
  var lm = Math.sqrt(lx * lx + ly * ly + lz * lz);
  lx /= lm; ly /= lm; lz /= lm;

  // Paul Bourke tennis ball seam (A=0.44, T in [0, 4pi])
  var Aseam = 0.44, nSamp = 500, seamPts = [];
  for (var i = 0; i < nSamp; i++) {
    var T = i / nSamp * 4 * Math.PI;
    var phi = Math.PI / 2 - (Math.PI / 2 - Aseam) * Math.cos(T);
    var th = T / 2 + Aseam * Math.sin(2 * T);
    seamPts.push([Math.sin(phi) * Math.cos(th), Math.sin(phi) * Math.sin(th), Math.cos(phi)]);
  }

  // Pre-compute seam distance lookup table (180x90 grid)
  var GT = 180, GP = 90, dtable = new Float32Array(GT * GP);
  for (var ti = 0; ti < GT; ti++) {
    for (var pi = 0; pi < GP; pi++) {
      var theta2 = ti / GT * 2 * Math.PI, phi2 = pi / GP * Math.PI;
      var px = Math.sin(phi2) * Math.cos(theta2);
      var py = Math.sin(phi2) * Math.sin(theta2);
      var pz = Math.cos(phi2);
      var mx = -2;
      for (var j = 0; j < nSamp; j++) {
        var d = px * seamPts[j][0] + py * seamPts[j][1] + pz * seamPts[j][2];
        if (d > mx) mx = d;
      }
      dtable[ti * GP + pi] = Math.acos(Math.min(1, mx));
    }
  }

  function getSeamDist(bx, by, bz) {
    var t = Math.atan2(by, bx);
    if (t < 0) t += 2 * Math.PI;
    var p = Math.acos(Math.max(-1, Math.min(1, bz)));
    var ti = Math.floor(t / (2 * Math.PI) * GT) % GT;
    var pi2 = Math.min(GP - 1, Math.floor(p / Math.PI * GP));
    return dtable[ti * GP + pi2];
  }

  // Pre-compute sphere points and shading
  var pts = [];
  for (var r = 0; r < H; r++) {
    for (var c = 0; c < W; c++) {
      var xn = (c - cx) / Rx, yn = (r - cy) / Ry, rr = xn * xn + yn * yn;
      if (rr > 1) { pts.push(null); continue; }
      var zn = Math.sqrt(1 - rr);
      var dot = xn * lx + yn * ly + zn * lz;
      var b = 0.08 + 0.82 * Math.max(0, dot);
      var rrx = xn + lx, rry = yn + ly, rrz = zn + lz;
      var rm = Math.sqrt(rrx * rrx + rry * rry + rrz * rrz);
      if (rm > 0) rrz /= rm;
      b = Math.min(1, b + Math.pow(Math.max(0, rrz), 18) * 0.2);
      b *= 1 - Math.pow(rr, 3) * 0.35;
      if (rr > 0.92) b *= 0.55;
      pts.push({ x: xn, y: yn, z: zn, b: b });
    }
  }

  // Animation loop — dual-axis rotation + mouse tracking (Phase 2)
  var el = document.getElementById('b');
  var container = document.querySelector('.tennis-ball-container');

  var mouseOverBall = false;
  var targetSpinX = 0, targetSpinY = 0;

  container.addEventListener('mouseenter', function() {
    mouseOverBall = true;
    el.style.animationPlayState = 'paused';
  });
  container.addEventListener('mouseleave', function() {
    mouseOverBall = false;
    defaultSpinX = spinX; // lock in whatever direction/speed we're leaving at
    defaultSpinY = spinY;
    el.style.animationPlayState = 'running';
  });
  container.addEventListener('mousemove', function(e) {
    var rect = container.getBoundingClientRect();
    var centerX = rect.left + rect.width / 2;
    var centerY = rect.top + rect.height / 2;
    var dx = e.clientX - centerX;
    var dy = e.clientY - centerY;
    var distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 1) { targetSpinX = 0; targetSpinY = 0; return; }
    var speed_factor = Math.min(distance * 0.00015, 0.08);
    targetSpinX = -(dy / distance) * speed_factor;
    targetSpinY =  (dx / distance) * speed_factor;
  });

  var angleX = 0, angleY = 0;
  var defaultSpinX = -2 * Math.PI / (9 * 60); // serve topspin
  var defaultSpinY = 0;
  var spinX = defaultSpinX;
  var spinY = defaultSpinY;
  var fc = 0;

  function loop() {
    fc++;

    if (mouseOverBall) {
      // Phase 3: lerp current spin toward target
      spinX += (targetSpinX - spinX) * 0.12;
      spinY += (targetSpinY - spinY) * 0.12;
    } else {
      // Phase 4: drift back toward locked-in spin on both axes
      spinX += (defaultSpinX - spinX) * 0.02;
      spinY += (defaultSpinY - spinY) * 0.02;
    }

    angleX += spinX;
    angleY += spinY;

    if (fc % 2 === 0) {
      var cax = Math.cos(-angleX), sax = Math.sin(-angleX);
      var cay = Math.cos(-angleY), say = Math.sin(-angleY);
      var out = '';
      for (var i = 0; i < pts.length; i++) {
        if (i > 0 && i % W === 0) out += '\n';
        var p = pts[i];
        if (!p) { out += ' '; continue; }

        // Rotate around X axis (topspin/backspin)
        var y1 = p.y * cax - p.z * sax;
        var z1 = p.y * sax + p.z * cax;

        // Rotate around Y axis (sidespin)
        var bx = p.x * cay + z1 * say;
        var by = y1;
        var bz = -p.x * say + z1 * cay;

        var sd = getSeamDist(bx, by, bz);
        if (sd < 0.09) {
          var sb = Math.min(1, p.b * 1.1 + 0.15);
          out += '<span class="s">' + shade[Math.min(sn - 1, Math.max(1, Math.round(sb * (sn - 1))))] + '</span>';
        } else {
          var b2 = p.b;
          if (sd < 0.19) { var t2 = (sd - 0.09) / 0.1; b2 *= (0.78 + 0.22 * t2); }
          out += shade[Math.min(sn - 1, Math.max(0, Math.round(b2 * (sn - 1))))];
        }
      }
      el.innerHTML = out;
    }
    requestAnimationFrame(loop);
  }
  loop();
})();
