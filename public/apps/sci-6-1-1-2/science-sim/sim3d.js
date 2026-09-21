/*
 * science-sim/sim3d.js — three.js 3D 실험 장면 뷰어 (정본: scripts/templates/science-sim/)
 *
 * ▶ index.html 준비(three.js는 정확한 버전 + SRI + crossorigin):
 *   <script type="importmap">
 *   { "imports": { "three": "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js",
 *                  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/" },
 *     "integrity": { "<three.module.js URL>": "sha384-…", "<OrbitControls.js URL>": "sha384-…" } }
 *   </script>
 *   <link rel="modulepreload" href="<three.module.js URL>" integrity="sha384-…" crossorigin="anonymous">
 *   <link rel="modulepreload" href="<OrbitControls.js URL>" integrity="sha384-…" crossorigin="anonymous">
 *   <script src="./science-sim/sim3d.js"></script>   ← 일반 스크립트. three는 필요할 때 import()로 불러온다.
 *   (importmap이 CDN 모듈에 부여하는 cross-origin 요청은 CORS 모드라 SRI 검사가 적용된다.)
 *
 * ▶ 사용
 *   SciSim.Sim3D.create({
 *     container: document.getElementById("view3d"),
 *     frame: { width: 22, depth: 16, center: [0, 0, 0] },   // 화면에 꼭 들어와야 하는 범위(가로·세로 비율에 맞춰 카메라 거리 자동 조정)
 *     forceFallback: false,                                 // true면 3D를 쓰지 않는다(2D 대체 화면 테스트용)
 *     onPick: function (pick) {},                           // userData.pick이 있는 물체를 탭하면 호출
 *     onLost: function () {},                               // WebGL 컨텍스트를 잃었을 때(→ 2D로 전환)
 *   }).then(function (v) { if (!v) show2DFallback(); else buildScene(v); });
 *
 *   v.THREE, v.scene, v.camera, v.controls, v.root(장면 물체를 넣는 그룹)
 *   v.make.table / wellPlate / bottle / paperBox / paperStrip / pipette / drop / tweezers / label
 *   v.tween(ms, function (t) {})  → Promise (t: 0→1, 부드럽게)
 *   v.moveTo(obj, [x,y,z], ms)    → Promise
 *   v.fadeColor(material, "#hex", ms) → Promise
 *   v.focus([x,y,z], ratio, ms) / v.flyHome(ms) → 관찰할 곳으로 다가가기 / 처음 시점으로 돌아가기(Promise)
 *   v.pickable(obj, pickValue)    → 탭 선택 대상 등록
 *   v.discard(obj)                → 장면에서 빼고 geometry·material·texture까지 해제(잠깐 쓰는 방울·스포이트 등)
 *   v.onThemeChange(function (isDark) {})  → 지금 한 번 + 시스템 다크모드가 바뀔 때마다 호출(탁자 색 등)
 *   v.setTheme(isDark) / v.resetView() / v.render()(한 장면 즉시 그리기)
 *   v.dispose()                   → 리스너 해제 + 장면 전체 해제 + renderer.dispose() + forceContextLoss() + 캔버스 제거
 *   더블탭(더블클릭)하면 처음 보던 방향으로 돌아간다.
 *
 * ▶ 애니메이션 시간: 트윈이 남아 있는 동안에는 3D 화면이 스크롤로 가려져도 실제 시간대로 진행한다.
 *   탭이 숨겨졌을 때(document.hidden)만 바로 끝낸다. 실행 직전에 화면을 보이게 하는 일은
 *   SciSim.Experiment가 한다(ensureVisible).
 * ▶ WebGL 컨텍스트: 3D↔2D를 여러 번 바꿔도 컨텍스트가 쌓이지 않도록 dispose()가 컨텍스트를 즉시 반납한다.
 *   dispose() 뒤에는 onLost가 절대 불리지 않는다.
 *
 * 3D 장면은 실제 기구를 단순화한 "모형"이다. 화면에 반드시 "모형"이라고 밝힌다.
 */
(function () {
  "use strict";
  var SciSim = (window.SciSim = window.SciSim || {});

  var webglOK = null; // 한 번만 확인한다(확인용 컨텍스트도 바로 반납)
  function isWebGLAvailable() {
    if (webglOK !== null) return webglOK;
    try {
      var c = document.createElement("canvas");
      var gl = window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"));
      webglOK = !!gl;
      if (gl) {
        var ext = gl.getExtension("WEBGL_lose_context");
        if (ext) ext.loseContext();
      }
    } catch (e) {
      webglOK = false;
    }
    return webglOK;
  }

  function ease(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  async function create(opts) {
    if (opts.forceFallback || !isWebGLAvailable()) return null;
    var THREE, OrbitControls;
    try {
      THREE = await import("three");
      OrbitControls = (await import("three/addons/controls/OrbitControls.js")).OrbitControls;
    } catch (e) {
      console.warn("[science-sim] three.js를 불러오지 못해 2D 화면으로 진행합니다.", e);
      return null;
    }

    var container = opts.container;
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch (e) {
      console.warn("[science-sim] WebGL을 시작하지 못해 2D 화면으로 진행합니다.", e);
      return null;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = "ss-canvas";
    renderer.domElement.setAttribute("aria-label", "3D 실험 장면(모형). 드래그하면 돌려 볼 수 있어요.");
    renderer.domElement.setAttribute("role", "img");
    container.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    var root = new THREE.Group();
    scene.add(root);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
    var sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(6, 14, 8);
    scene.add(sun);

    var frame = opts.frame || { width: 20, depth: 14, center: [0, 0, 0] };
    var center = new THREE.Vector3().fromArray(frame.center || [0, 0, 0]);
    var viewDir = new THREE.Vector3(0, 0.78, 0.62).normalize();

    var controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI * 0.46; // 탁자 아래로 내려가지 않게
    controls.minPolarAngle = 0.15;
    controls.target.copy(center);
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };

    var fitDistance = 20;
    function computeFit() {
      var w = container.clientWidth || 1;
      var h = container.clientHeight || 1;
      var aspect = w / h;
      var vfov = (camera.fov * Math.PI) / 180;
      var hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
      var dW = frame.width / 2 / Math.tan(hfov / 2);
      var dD = (frame.depth * 0.8) / 2 / Math.tan(vfov / 2);
      fitDistance = Math.max(dW, dD) * 1.04 + 0.5;
      controls.minDistance = fitDistance * 0.45;
      controls.maxDistance = fitDistance * 1.8;
    }
    function resetView() {
      if (disposed) return;
      computeFit();
      camera.position.copy(center).addScaledVector(viewDir, fitDistance);
      controls.target.copy(center);
      controls.update();
      renderer.render(scene, camera);
    }
    function resize() {
      var w = container.clientWidth || 1;
      var h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      var before = fitDistance;
      computeFit();
      // 화면 크기가 바뀌면 같은 방향에서 새 거리로 맞춘다
      var dir = camera.position.clone().sub(controls.target);
      var len = dir.length() || 1;
      dir.multiplyScalar((len / before) * fitDistance / len);
      camera.position.copy(controls.target).add(dir);
      controls.update();
      renderer.render(scene, camera); // 렌더 루프가 멈춰 있어도(탭이 숨겨진 상태 등) 한 장면은 그려 둔다
    }

    // ── 렌더 루프 ──
    // 화면 밖이면 멈추되, 진행 중인 애니메이션(트윈)이 있으면 끝날 때까지 실제 시간대로 돌린다.
    // 탭이 숨겨지면(requestAnimationFrame이 멈춤) 남은 트윈을 바로 끝낸다(Promise가 영원히 기다리지 않게).
    var visible = true;
    var running = false;
    var disposed = false;
    var tweens = [];
    function finishAll() {
      tweens.splice(0).forEach(function (tw) {
        try {
          tw.fn(1, 1);
        } catch (e) {
          /* 무시 */
        }
        tw.resolve();
      });
    }
    function loop(now) {
      if (!running || disposed) return;
      for (var i = tweens.length - 1; i >= 0; i--) {
        var tw = tweens[i];
        if (tw.start == null) tw.start = now;
        var t = Math.min(1, (now - tw.start) / tw.ms);
        tw.fn(ease(t), t);
        if (t >= 1) {
          tweens.splice(i, 1);
          tw.resolve();
        }
      }
      controls.update();
      renderer.render(scene, camera);
      if (!visible && !tweens.length) {
        running = false; // 화면 밖 + 할 일 없음 → 쉰다
        return;
      }
      requestAnimationFrame(loop);
    }
    function setRunning() {
      if (disposed) return;
      if (document.hidden) {
        running = false;
        finishAll();
        return;
      }
      var should = visible || tweens.length > 0;
      if (should && !running) {
        running = true;
        requestAnimationFrame(loop);
      }
    }
    var io = null;
    var visWaiters = [];
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        function (entries) {
          var e = entries[entries.length - 1];
          visible = e.isIntersecting;
          if (e.intersectionRatio >= 0.6) visWaiters.splice(0).forEach(function (r) { r(); });
          setRunning();
        },
        { threshold: [0, 0.6, 1] }
      );
      io.observe(container);
    }
    var onVis = function () {
      setRunning();
    };
    document.addEventListener("visibilitychange", onVis);
    var ro = new ResizeObserver(function () {
      if (!disposed) resize();
    });
    ro.observe(container);

    function tween(ms, fn) {
      return new Promise(function (resolve) {
        if (disposed || document.hidden) {
          fn(1, 1);
          resolve();
          return;
        }
        tweens.push({ ms: Math.max(1, ms), fn: fn, resolve: resolve, start: null });
        setRunning();
      });
    }
    // 3D 화면이 60% 이상 보일 때까지 기다린다(최대 ms). IntersectionObserver가 없으면 바로 끝난다.
    function whenVisible(ms) {
      if (!io || disposed) return Promise.resolve();
      var r = container.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var shown = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      if (r.height > 0 && shown / r.height >= 0.6) return Promise.resolve();
      return new Promise(function (resolve) {
        visWaiters.push(resolve);
        setTimeout(resolve, ms || 1200);
      });
    }
    function wait(ms) {
      return tween(ms, function () {});
    }
    function moveTo(obj, to, ms) {
      var from = obj.position.clone();
      var target = new THREE.Vector3().fromArray(to);
      return tween(ms, function (t) {
        obj.position.lerpVectors(from, target, t);
      });
    }
    // 카메라를 한 지점(예: 관찰할 홈) 쪽으로 부드럽게 다가가게 한다. ratio: 처음 거리 대비 비율
    function focus(point, ratio, ms) {
      var fromT = controls.target.clone();
      var toT = new THREE.Vector3().fromArray(point);
      var fromP = camera.position.clone();
      var dir = fromP.clone().sub(fromT).normalize();
      var toP = toT.clone().addScaledVector(dir, fitDistance * (ratio || 0.5));
      return tween(ms || 600, function (t) {
        controls.target.lerpVectors(fromT, toT, t);
        camera.position.lerpVectors(fromP, toP, t);
      });
    }
    // 처음 보던 방향·거리로 부드럽게 돌아가기
    function flyHome(ms) {
      computeFit();
      var fromT = controls.target.clone();
      var fromP = camera.position.clone();
      var toP = center.clone().addScaledVector(viewDir, fitDistance);
      if (fromT.distanceTo(center) < 0.01 && fromP.distanceTo(toP) < 0.01) return Promise.resolve();
      return tween(ms || 600, function (t) {
        controls.target.lerpVectors(fromT, center, t);
        camera.position.lerpVectors(fromP, toP, t);
      });
    }
    function fadeColor(material, hex, ms) {
      var from = material.color.clone();
      var to = new THREE.Color(hex);
      return tween(ms, function (t) {
        material.color.copy(from).lerp(to, t);
      });
    }

    // ── 탭으로 물체 고르기 / 더블탭으로 시점 초기화 ──
    var pickables = [];
    var raycaster = new THREE.Raycaster();
    var down = null;
    var lastTap = 0;
    var el = renderer.domElement;
    function onDown(e) {
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
    }
    function onUp(e) {
      if (!down) return;
      var moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      var quick = performance.now() - down.t < 450;
      down = null;
      if (moved > 8 || !quick) return;
      var now = performance.now();
      if (now - lastTap < 320) {
        lastTap = 0;
        resetView();
        return;
      }
      lastTap = now;
      if (!opts.onPick) return;
      var rect = el.getBoundingClientRect();
      var ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      var hits = raycaster.intersectObjects(pickables, true);
      for (var i = 0; i < hits.length; i++) {
        var o = hits[i].object;
        while (o && !(o.userData && o.userData.pick != null)) o = o.parent;
        if (o) {
          opts.onPick(o.userData.pick);
          return;
        }
      }
    }
    function onContextLost(e) {
      e.preventDefault();
      if (disposed) return; // 스스로 반납한 컨텍스트(dispose)에는 반응하지 않는다
      if (opts.onLost) opts.onLost();
    }
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("webglcontextlost", onContextLost, false);

    // 물체 하나(와 자식들)의 GPU 자원 해제
    function freeObject(obj) {
      obj.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          [].concat(o.material).forEach(function (m) {
            Object.keys(m).forEach(function (k) {
              if (m[k] && m[k].isTexture) m[k].dispose();
            });
            m.dispose();
          });
        }
      });
    }
    function discard(obj) {
      if (!obj) return;
      if (obj.parent) obj.parent.remove(obj);
      var i = pickables.indexOf(obj);
      if (i >= 0) pickables.splice(i, 1);
      freeObject(obj);
    }

    // ── 물체 만들기(저폴리곤 프리미티브) ──
    function mat(color, extra) {
      return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.55, metalness: 0.02 }, extra || {}));
    }

    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    // 글자 라벨(항상 카메라를 향하는 스프라이트)
    function label(text, o) {
      o = o || {};
      var lines = String(text).split("\n");
      var fontPx = 44;
      var pad = 16;
      var c = document.createElement("canvas");
      var ctx = c.getContext("2d");
      var font = (o.bold ? "700 " : "600 ") + fontPx + "px system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
      ctx.font = font;
      var w = 0;
      lines.forEach(function (l) {
        w = Math.max(w, ctx.measureText(l).width);
      });
      c.width = Math.ceil(w + pad * 2);
      c.height = Math.ceil(lines.length * fontPx * 1.2 + pad * 1.4);
      ctx.font = font;
      roundRect(ctx, 2, 2, c.width - 4, c.height - 4, 18);
      ctx.fillStyle = o.bg || "rgba(255,255,255,0.92)";
      ctx.fill();
      if (o.border) {
        ctx.lineWidth = 4;
        ctx.strokeStyle = o.border;
        ctx.stroke();
      }
      ctx.fillStyle = o.color || "#1f2937";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      lines.forEach(function (l, i) {
        ctx.fillText(l, c.width / 2, pad * 0.7 + fontPx * 0.6 + i * fontPx * 1.2);
      });
      var tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: o.depthTest !== false, transparent: true }));
      var h = o.height || 0.55;
      sp.scale.set((h * c.width) / c.height, h, 1);
      sp.renderOrder = 10;
      return sp;
    }

    var make = {
      label: label,
      material: mat,
      table: function (w, d, color) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), mat(color || 0xd9c7a3, { roughness: 0.8 }));
        m.position.y = -0.25;
        return m;
      },
      // rows×cols 홈판. 반환: { group, wells[row][col] = { liquid, position:[x,y,z] } }
      wellPlate: function (o) {
        var g = new THREE.Group();
        var sp = o.spacing || 1.8;
        var W = sp * o.cols + 0.6;
        var D = sp * o.rows + 0.6;
        var H = 0.55;
        var plate = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), mat(o.color || 0xf4f7fb, { roughness: 0.3, transparent: true, opacity: 0.95 }));
        plate.position.y = H / 2;
        g.add(plate);
        var wells = [];
        var r = o.wellRadius || sp * 0.36;
        var holeGeo = new THREE.CylinderGeometry(r, r, 0.04, 32);
        var liqGeo = new THREE.CylinderGeometry(r * 0.92, r * 0.92, 0.05, 32);
        for (var i = 0; i < o.rows; i++) {
          wells.push([]);
          for (var j = 0; j < o.cols; j++) {
            var x = (j - (o.cols - 1) / 2) * sp;
            var z = (i - (o.rows - 1) / 2) * sp;
            var hole = new THREE.Mesh(holeGeo, mat(o.holeColor || 0xc9d3de, { roughness: 0.4 }));
            hole.position.set(x, H + 0.005, z);
            g.add(hole);
            var liquid = new THREE.Mesh(liqGeo, mat(0xdfeaf2, { transparent: true, opacity: 0.9, roughness: 0.15 }));
            liquid.position.set(x, H + 0.04, z);
            liquid.visible = false;
            g.add(liquid);
            wells[i].push({ liquid: liquid, hole: hole, position: [x, H, z] });
          }
        }
        return { group: g, wells: wells, width: W, depth: D, height: H };
      },
      // 점적병/시약병: 투명한 몸통 + 안의 액체 + 뚜껑
      bottle: function (o) {
        o = o || {};
        var g = new THREE.Group();
        var r = o.radius || 0.45;
        var h = o.height || 1.5;
        var body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), mat(0xffffff, { transparent: true, opacity: 0.35, roughness: 0.1 }));
        body.position.y = h / 2;
        g.add(body);
        var liq = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.88, r * 0.88, h * 0.62, 24), mat(o.liquid || 0xdfeaf2, { transparent: true, opacity: o.liquidOpacity || 0.8 }));
        liq.position.y = h * 0.33;
        g.add(liq);
        var neck = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r * 0.6, 0.35, 16), mat(o.cap || 0xf2f2f2));
        neck.position.y = h + 0.17;
        g.add(neck);
        var tip = new THREE.Mesh(new THREE.ConeGeometry(r * 0.28, 0.45, 16), mat(o.cap || 0xf2f2f2));
        tip.position.y = h + 0.55;
        g.add(tip);
        g.userData.liquid = liq;
        g.userData.body = body;
        g.userData.height = h + 0.8;
        return g;
      },
      // 시험지 통(색깔 시험지가 꽂혀 있는 작은 상자)
      paperBox: function (color) {
        var g = new THREE.Group();
        var box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.8), mat(0xf5f5f0));
        box.position.y = 0.25;
        g.add(box);
        for (var i = 0; i < 4; i++) {
          var s = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 0.03), mat(color));
          s.position.set(-0.36 + i * 0.24, 0.7, 0);
          g.add(s);
        }
        return g;
      },
      // 시험지 한 조각: 아래쪽(용액에 젖는 부분)과 위쪽을 따로 칠할 수 있게 둘로 나눔
      paperStrip: function (color) {
        var g = new THREE.Group();
        var lowerMat = mat(color);
        var upperMat = mat(color);
        var lower = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.55, 0.04), lowerMat);
        lower.position.y = 0.275;
        var upper = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.75, 0.04), upperMat);
        upper.position.y = 0.55 + 0.375;
        g.add(lower, upper);
        g.userData.lower = lowerMat;
        g.userData.upper = upperMat;
        return g;
      },
      // 스포이트: 유리관 + 고무 꼭지
      pipette: function (liquidColor) {
        var g = new THREE.Group();
        var tube = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.05, 1.6, 12), mat(0xffffff, { transparent: true, opacity: 0.45 }));
        tube.position.y = 0.8;
        var liq = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.04, 0.7, 12), mat(liquidColor || 0xdfeaf2, { transparent: true, opacity: 0.9 }));
        liq.position.y = 0.4;
        var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), mat(0x333a44));
        bulb.position.y = 1.75;
        bulb.scale.y = 1.4;
        g.add(tube, liq, bulb);
        g.userData.liquid = liq.material;
        return g;
      },
      drop: function (color) {
        var m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), mat(color || 0xdfeaf2, { transparent: true, opacity: 0.9 }));
        m.scale.y = 1.3;
        return m;
      },
      tweezers: function () {
        var g = new THREE.Group();
        var m = mat(0xb8c0c8, { metalness: 0.6, roughness: 0.3 });
        var a = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.1), m);
        var b = a.clone();
        a.position.set(-0.08, 0.8, 0);
        a.rotation.z = -0.06;
        b.position.set(0.08, 0.8, 0);
        b.rotation.z = 0.06;
        g.add(a, b);
        return g;
      },
    };

    var theme = { light: { bg: 0xeef3f8 }, dark: { bg: 0x1b2230 } };
    var themeFns = [];
    var darkMq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    function setTheme(dark) {
      scene.background = new THREE.Color(dark ? (opts.darkBg || theme.dark.bg) : (opts.lightBg || theme.light.bg));
    }
    // 시스템 다크모드가 바뀌면 배경과 등록한 물체 색을 바꾼다(dispose 때 리스너 해제)
    function applyTheme() {
      if (disposed) return;
      var dark = !!(darkMq && darkMq.matches);
      setTheme(dark);
      themeFns.forEach(function (fn) {
        fn(dark);
      });
      if (!running) renderer.render(scene, camera);
    }
    function onThemeChange(fn) {
      themeFns.push(fn);
      fn(!!(darkMq && darkMq.matches));
    }
    if (darkMq && darkMq.addEventListener) darkMq.addEventListener("change", applyTheme);
    setTheme(!!(darkMq && darkMq.matches));

    resize();
    resetView();
    setRunning();
    if (!io) {
      visible = true;
      setRunning();
    }

    return {
      THREE: THREE,
      scene: scene,
      camera: camera,
      renderer: renderer,
      controls: controls,
      root: root,
      make: make,
      tween: tween,
      wait: wait,
      moveTo: moveTo,
      fadeColor: fadeColor,
      focus: focus,
      flyHome: flyHome,
      pickable: function (obj, value) {
        obj.userData.pick = value;
        pickables.push(obj);
      },
      discard: discard,
      whenVisible: whenVisible,
      isDisposed: function () {
        return disposed;
      },
      setTheme: setTheme,
      onThemeChange: onThemeChange,
      resetView: resetView,
      render: function () {
        if (disposed) return;
        controls.update();
        renderer.render(scene, camera);
      },
      dispose: function () {
        if (disposed) return;
        disposed = true; // 이후 onLost·렌더·리사이즈는 모두 무시
        running = false;
        finishAll();
        visWaiters.splice(0).forEach(function (r) { r(); });
        if (io) io.disconnect();
        ro.disconnect();
        document.removeEventListener("visibilitychange", onVis);
        if (darkMq && darkMq.removeEventListener) darkMq.removeEventListener("change", applyTheme);
        themeFns.length = 0;
        el.removeEventListener("pointerdown", onDown);
        el.removeEventListener("pointerup", onUp);
        controls.dispose();
        freeObject(scene);
        if (scene.background && scene.background.isTexture) scene.background.dispose();
        pickables.length = 0;
        try {
          renderer.renderLists.dispose();
        } catch (e) {
          /* 무시 */
        }
        renderer.dispose();
        try {
          renderer.forceContextLoss(); // 컨텍스트를 바로 반납해 3D↔2D를 반복해도 쌓이지 않게
        } catch (e) {
          /* 무시 */
        }
        el.removeEventListener("webglcontextlost", onContextLost, false);
        if (el.parentNode) el.parentNode.removeChild(el);
      },
    };
  }

  SciSim.Sim3D = { create: create, isWebGLAvailable: isWebGLAvailable };
})();
