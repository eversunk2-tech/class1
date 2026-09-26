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
 *     minDistance: 2.5,                                     // 선택: 카메라가 다가갈 수 있는 가장 가까운 거리(기본: 화면 맞춤 거리의 45%).
 *                                                           //  가까이에서 보는 연출(종이 앞 낮은 시점 등)이 화면 크기 변화 때 뒤로 밀려나지 않게 할 때
 *     viewDir: [0, 0.78, 0.62],                             // 선택: 처음 시점의 방향(중심에서 카메라 쪽). 야외처럼 낮게 보려면 [0, 0.55, 0.84] 등
 *     groundY: 0,                                           // 선택: 바닥(탁자 윗면) 높이 — 이동 화살표가 과녁을 이보다 낮게 옮기지 않는다(기본 0 = make.table 윗면)
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
 *   v.draggable(obj, opts)        → 물체를 끌어 값 바꾸기(2026-09-25 추가, 순수 추가라 안 쓰면 영향 없음). opts:
 *       { plane: THREE.Plane | {normal:[x,y,z], point:[x,y,z]} | function()→그 중 하나,   // 선택: 끄는 동안 이 평면과의 교점을 point로 준다
 *         onStart(info), onDrag(info), onEnd(info) }                                    // info = { point(평면 없으면 null), ray(레이, 구면·곡선에 직접 투영할 때), event }
 *     포인터다운으로 등록한 물체(자식 포함)를 잡으면 카메라 회전을 잠시 멈추고(끝나면 끌기 전 controls.enabled 값으로 되돌림),
 *     포인터무브마다 onDrag(info)를 부른다. 레이가 물체에 맞지 않아도 물체의 보이는 부분을 화면에 그린 경계 상자에서 30px 안쪽이면
 *     잡힌다(터치가 작은 물체도 잡기 쉽게, 여러 개면 가장 가까운 것). 끌기를 시작한 pointerId만 끌고 끝낸다(다른 손가락·손바닥의
 *     포인터업은 무시), 마우스는 주(왼쪽) 버튼만, 숨긴 물체(자신·조상의 visible === false)는 안 잡힌다. 포인터취소도 onEnd로 끝난다.
 *     끄는 중에 v.discard(그 물체)·v.dispose()가 불리면 onEnd({ point: 마지막 point, ray: 마지막 ray, event: null, cancelled: true })를 부른다.
 *     끌 수 있는 물체 위에서는 커서가 grab으로 바뀐다(마우스 기기만). 예: 태양을 하늘 반구(plane 대신 onDrag의 ray로 구면 교차 계산)로 끌어
 *     가장 가까운 시각으로 스냅, 손전등을 평면 위로 끌어 각도 계산 후 기존 setAngle(deg) 호출.
 *       opts.pad(px, 기본 30): 레이가 빗나가도 물체의 화면 경계 상자에서 이 거리 안이면 잡는다. 0이면 정확히 맞을 때만(기울어진 긴 물체는
 *       경계 상자가 빈 곳까지 넓다 — pad:0에 보이지 않는 굵은 손잡이 메시(visible 그대로, 투명 재질 opacity 0)를 자식으로 붙여 쓰기를 권장).
 *   v.discard(obj)                → 장면에서 빼고 geometry·material·texture까지 해제(잠깐 쓰는 방울·스포이트 등).
 *                                   obj 안에 pickable로 등록한 자식이 있으면 그 등록도 함께 뺀다(장면 통째 바꾸기에 안전)
 *   v.cameraPose() / v.setCameraPose(pose) → 지금 시점 { position:[x,y,z], target:[x,y,z] } 얻기 / 되돌리기
 *   v.project([x,y,z], pose?)     → 화면 위 자리 { x, y (0~1, 왼쪽 위 기준), inView }. pose를 주면 그 시점 기준
 *   v.snapshot({ pose, width, marks, hide, type, quality }) → 지금 장면을 '사진'으로 찍는다(전/후 비교용).
 *       pose: 이 시점에서 찍고 원래 시점으로 돌아온다(삼각대처럼 같은 자리에서 두 번 찍을 때) · width: 사진 가로 px(기본 480)
 *       marks: [{ at: [x,y,z], radius: 0.06(사진 가로 대비), label: "" }] → 그 자리에 점선 표시 원을 그린다
 *       hide: [obj, …] → 찍는 순간에만 숨길 물체(선택 표시 화살표·라벨 등)
 *       반환 { url(dataURL), canvas(2D 캔버스), width, height, marks: [{ x, y, r, inView }](사진 px) } | null(해제된 뒤)
 *   v.onThemeChange(function (isDark) {})  → 지금 한 번 + 시스템 다크모드가 바뀔 때마다 호출(탁자 색 등)
 *   v.setTheme(isDark) / v.resetView() / v.render()(한 장면 즉시 그리기)
 *   v.dispose()                   → 리스너 해제 + 장면 전체 해제 + renderer.dispose() + forceContextLoss() + 캔버스 제거
 *   더블탭(더블클릭)하면 처음 보던 방향으로 돌아간다(이동 화살표로 옮긴 것까지).
 *
 * ▶ 이동 화살표(2026-09-26 spec 개정 8, 자동 — 앱은 할 일이 없다): 처음보다 확대했거나(거리 < 맞춤 거리 × 0.92) 과녁이 처음 중심에서
 *   옮겨져 있으면 container 가장자리 가운데에 반투명 ▲▼◀▶ 버튼(.ss-pan-btn)이 나타난다. 한 번 누르면 한 칸(보이는 높이의 12%),
 *   누르고 있으면 계속(초당 60%) — 화면 기준으로 카메라와 과녁을 함께 옮겨 돌거나 좌우가 뒤집히지 않는다. 한도는 처음 시점에서 본
 *   장면 틀(frame)과 바닥(groundY), resetView·flyHome은 옮긴 것까지 처음으로, 카메라 트윈(focus·flyHome·앱의 v.tween)·끌기 중에는
 *   옮기지 않는다.
 *   자리는 장면 칸(.ss-exp-view) 안의 다른 표시(토글·배지·HUD·안내 글)와 겹치지 않게 스스로 잡는다(0.25초마다 다시 잼).
 *   화살표가 보이는 동안 장면 칸의 드래그 안내 줄(.ss-view-tip)은 짧은 이동 안내("👆 화살표: 화면 옮기기 · 두 번 탭: 처음 방향")로
 *   바뀌고, 화살표가 숨으면 원래 안내로 돌아간다(2026-09-26 사용자 요청).
 *   코드는 아래 "확대한 장면 옮기기" 절, 설명은 README "개정 8" 절.
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
    var viewDir = new THREE.Vector3().fromArray(opts.viewDir || [0, 0.78, 0.62]).normalize();

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
      controls.minDistance = opts.minDistance != null ? Math.min(opts.minDistance, fitDistance * 0.45) : fitDistance * 0.45;
      controls.maxDistance = fitDistance * 1.8;
    }
    function resetView() {
      if (disposed) return;
      stopPan(); // 이동 화살표로 옮긴 것까지 처음으로(누르고 있던 이동도 멈춘다)
      computeFit();
      camera.position.copy(center).addScaledVector(viewDir, fitDistance);
      controls.target.copy(center);
      controls.update();
      renderer.render(scene, camera);
      if (panUI) panUI.refresh();
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
      if (panUI) panUI.refresh(true); // 화면 크기가 바뀌면 이동 화살표 자리도 다시 잰다
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
    var camWas = null; // 이동 화살표를 누르는 동안: 트윈 전 카메라·과녁(앱이 카메라를 움직이는 트윈인지 알아보려고)
    function loop(now) {
      if (!running || disposed) return;
      if (pan && tweens.length) camWas = [camera.position.clone(), controls.target.clone()];
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
      if (pan) {
        // 앱이 카메라를 움직이는 중(focus·flyHome·앱 자체 트윈)이거나 물체를 끄는 중이면 이 장면에서는 옮기지 않는다(겹쳐서 튀지 않게)
        var camTween = !!camWas && (!camWas[0].equals(camera.position) || !camWas[1].equals(controls.target));
        stepPan(now, camTween || !!dragState);
      }
      camWas = null;
      controls.update();
      renderer.render(scene, camera);
      if (panUI) panUI.tick(now);
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
      if (document.hidden) stopPan(); // 탭이 숨겨지면 이동 화살표 이동도 멈춘다
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
      stopPan(); // 앱의 카메라 연출이 시작되면 화살표 이동은 멈춘다(끝난 뒤 다시 누르면 된다)
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
      stopPan(); // 이동 화살표로 옮긴 것까지 처음으로
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

    // ── 물체 끌기(v.draggable) — 탭 선택(pickable)과는 별개, 순수 추가 ──
    var draggables = [];
    var dragState = null; // { entry, pointerId, prevEnabled, last: { point, ray } }
    var DRAG_PAD_PX = 30; // 레이가 빗나가도 물체(보이는 부분)의 화면 경계 상자에서 이 거리 안이면 잡힌 것으로 본다(작은 물체도 잡기 쉽게)
    var dragVec = new THREE.Vector3();
    var dragBox = new THREE.Box3();
    var dragBoxPart = new THREE.Box3();
    var dragCorner = new THREE.Vector3();
    function ndcOf(e, rect) {
      return new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    }
    function entryOf(obj) {
      for (var i = 0; i < draggables.length; i++) if (draggables[i].obj === obj) return draggables[i];
      return null;
    }
    // 자신이나 조상 가운데 하나라도 visible === false면 보이지 않는 물체다(장면 root까지)
    function shown(obj) {
      for (var o = obj; o; o = o.parent) if (o.visible === false) return false;
      return true;
    }
    // 물체의 보이는 부분(숨긴 자식 가지는 빼고)을 감싸는 월드 경계 상자 → 화면(클라이언트 px) 경계 상자. 카메라 뒤에 있으면 null
    function screenBox(obj, rect) {
      obj.updateWorldMatrix(true, true);
      dragBox.makeEmpty();
      (function add(o) {
        if (o.visible === false) return;
        var g = o.geometry;
        if (g) {
          if (!g.boundingBox) g.computeBoundingBox();
          if (g.boundingBox && !g.boundingBox.isEmpty()) dragBox.union(dragBoxPart.copy(g.boundingBox).applyMatrix4(o.matrixWorld));
        }
        for (var i = 0; i < o.children.length; i++) add(o.children[i]);
      })(obj);
      if (dragBox.isEmpty()) dragBox.setFromCenterAndSize(obj.getWorldPosition(dragCorner), new THREE.Vector3(0, 0, 0));
      var x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity;
      for (var k = 0; k < 8; k++) {
        dragCorner.set(k & 1 ? dragBox.max.x : dragBox.min.x, k & 2 ? dragBox.max.y : dragBox.min.y, k & 4 ? dragBox.max.z : dragBox.min.z).project(camera);
        if (dragCorner.z > 1) return null; // 카메라 뒤
        var sx = ((dragCorner.x + 1) / 2) * rect.width + rect.left;
        var sy = ((1 - dragCorner.y) / 2) * rect.height + rect.top;
        x0 = Math.min(x0, sx);
        x1 = Math.max(x1, sx);
        y0 = Math.min(y0, sy);
        y1 = Math.max(y1, sy);
      }
      return { x0: x0, y0: y0, x1: x1, y1: y1 };
    }
    function hitDraggable(e) {
      var rect = el.getBoundingClientRect();
      raycaster.setFromCamera(ndcOf(e, rect), camera);
      var list = draggables.filter(function (d) {
        return shown(d.obj);
      });
      var objs = list.map(function (d) {
        return d.obj;
      });
      var hits = objs.length ? raycaster.intersectObjects(objs, true) : [];
      for (var i = 0; i < hits.length; i++) {
        if (!shown(hits[i].object)) continue; // 숨긴 자식은 레이가 맞아도 잡지 않는다
        var o = hits[i].object;
        var found = null;
        while (o && !found) {
          found = entryOf(o);
          o = o.parent;
        }
        if (found) return found;
      }
      // 정확히 맞지 않아도 화면 경계 상자에서 가까우면(터치 오차 보정) 잡는다.
      // 물체마다 opts.pad(px, 기본 30)로 넓이를 정한다 — 0이면 레이가 정확히 맞을 때만 잡는다(기울어진 긴 물체는
      // 경계 상자가 빈 곳까지 넓어 옆의 빈 곳을 끌어도 잡히므로, pad:0 + 보이지 않는 굵은 손잡이 메시를 권장 — README).
      var best = null,
        bestD = Infinity;
      list.forEach(function (d) {
        var pad = typeof d.opts.pad === "number" ? d.opts.pad : DRAG_PAD_PX;
        if (!(pad > 0)) return;
        var b = screenBox(d.obj, rect);
        if (!b) return;
        var dx = Math.max(b.x0 - e.clientX, 0, e.clientX - b.x1);
        var dy = Math.max(b.y0 - e.clientY, 0, e.clientY - b.y1);
        var dist = Math.hypot(dx, dy);
        if (dist <= pad && dist <= bestD) {
          bestD = dist;
          best = d;
        }
      });
      return best;
    }
    function resolvePlane(p) {
      if (!p) return null;
      if (typeof p === "function") p = p();
      if (!p) return null;
      if (p.isPlane) return p;
      if (p.normal && p.point) return new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3().fromArray(p.normal), new THREE.Vector3().fromArray(p.point));
      if (p.normal && typeof p.constant === "number") return new THREE.Plane(new THREE.Vector3().fromArray(p.normal), p.constant);
      return null;
    }
    function dragInfo(e, opts2) {
      var rect = el.getBoundingClientRect();
      raycaster.setFromCamera(ndcOf(e, rect), camera);
      var plane = resolvePlane(opts2.plane);
      var point = plane && raycaster.ray.intersectPlane(plane, dragVec) ? dragVec.clone() : null;
      var info = { point: point, ray: raycaster.ray.clone(), event: e };
      if (dragState) dragState.last = info;
      return info;
    }
    function onDragDown(e) {
      if (dragState) return; // 이미 끄는 중이면 다른 손가락은 무시
      if (e.pointerType === "mouse" && e.button !== 0) return; // 마우스는 주(왼쪽) 버튼만
      var entry = hitDraggable(e);
      if (!entry) return;
      dragState = { entry: entry, pointerId: e.pointerId, prevEnabled: controls.enabled, last: null };
      controls.enabled = false; // 카메라 회전을 잠시 멈춘다(끝나면 끌기 전 값으로 되돌림)
      el.style.cursor = "grabbing";
      var info = dragInfo(e, entry.opts);
      if (entry.opts.onStart) entry.opts.onStart(info);
      window.addEventListener("pointermove", onDragMove);
      window.addEventListener("pointerup", onDragUp);
      window.addEventListener("pointercancel", onDragUp);
    }
    function onDragMove(e) {
      if (!dragState || e.pointerId !== dragState.pointerId) return; // 끌기를 시작한 포인터만
      var info = dragInfo(e, dragState.entry.opts);
      if (dragState.entry.opts.onDrag) dragState.entry.opts.onDrag(info);
    }
    function onDragUp(e) {
      if (!dragState || e.pointerId !== dragState.pointerId) return; // 다른 손가락·손바닥의 포인터업은 무시
      endDrag(dragInfo(e, dragState.entry.opts));
    }
    // 끌기 끝내기(포인터업·취소, 또는 끄는 중인 물체의 discard·dispose). info가 없으면 마지막 point로 onEnd를 부른다.
    function endDrag(info) {
      if (!dragState) return;
      var st = dragState;
      dragState = null;
      controls.enabled = st.prevEnabled;
      el.style.cursor = "";
      window.removeEventListener("pointermove", onDragMove);
      window.removeEventListener("pointerup", onDragUp);
      window.removeEventListener("pointercancel", onDragUp);
      if (!info) info = { point: st.last ? st.last.point : null, ray: st.last ? st.last.ray : null, event: null, cancelled: true };
      if (st.entry.opts.onEnd) {
        try {
          st.entry.opts.onEnd(info);
        } catch (err) {
          console.warn("[science-sim] 끌기 onEnd 오류", err);
        }
      }
    }
    var hoverMq = window.matchMedia ? window.matchMedia("(hover: hover)") : null;
    function onHoverMove(e) {
      if (dragState || !draggables.length || !(hoverMq && hoverMq.matches)) return;
      el.style.cursor = hitDraggable(e) ? "grab" : "";
    }
    el.addEventListener("pointerdown", onDragDown);
    el.addEventListener("pointermove", onHoverMove);

    // ── 확대한 장면 옮기기: 이동 화살표 ▲▼◀▶(2026-09-26 spec 개정 8, 순수 추가 — 앱 코드를 바꿀 필요 없다) ──
    // 처음보다 확대했거나(카메라~과녁 거리 < 맞춤 거리 × PAN_ZOOM) 과녁이 처음 중심에서 옮겨져 있으면 3D 칸(container) 가장자리
    // 가운데에 반투명 화살표가 나타난다(처음 시점에서는 hidden). 누르면 화면 기준(카메라의 오른쪽·위쪽 벡터 — OrbitControls의
    // screen-space pan과 같은 뜻)으로 카메라와 과녁을 함께 옮긴다 → 돌거나 좌우가 뒤집히지 않는다(▲ = 화면 위쪽이 보인다).
    // 한 번 누르면 한 칸(지금 보이는 높이의 PAN_STEP), 누르고 있으면 계속(초당 보이는 높이의 PAN_SPEED). 키보드 Enter·Space = 한 칸.
    // 한도: 과녁(화면 가운데)이 장면 틀(frame) 안 — 처음 시점 화면에서 본 틀(computeFit이 맞추는 것과 같은 방향): 좌우 width/2,
    // 위아래 depth×0.4, 앞뒤(처음 시점 방향) depth/2. 그리고 바닥(opts.groundY, 기본 0 = make.table 윗면. 중심이 더 낮으면 중심)보다
    // 아래로 가지 않는다 — 바닥에 닿으면 ▼는 탁자 면을 따라 미끄러지고(내려다보는 장면에서 앞쪽이 계속 보이게, 카메라가 탁자 아래로
    // 가지 않게), 틀의 가장자리에서는 멈춘다(그쪽 화살표는 흐리게 + aria-disabled). 앱의 focus 등으로 이미 틀 밖에 있으면 더 바깥으로만
    // 못 간다. resetView(더블탭·"처음 방향으로")·flyHome은 옮긴 것까지 처음으로, 카메라 트윈·물체 끌기 중에는 옮기지 않는다.
    var PAN_ZOOM = 0.92;
    var PAN_MOVED = 0.01; // 과녁이 맞춤 거리의 1%보다 멀리 옮겨져 있으면 "옮긴 상태"
    var PAN_STEP = 0.12;
    var PAN_SPEED = 0.6;
    var groundY = typeof opts.groundY === "number" ? opts.groundY : 0;
    var pan = null; // 지금 하는 이동 { sx, sy, held(누르고 있음), want(최소로 옮길 거리 — 한 칸), done, last }
    var panVec = new THREE.Vector3();
    var panRight = new THREE.Vector3();
    var panUp = new THREE.Vector3();
    var panOff = new THREE.Vector3();
    // 처음 시점의 화면 축(한도 틀의 방향): 앞(카메라 → 중심)·오른쪽·위 — computeFit이 frame을 맞추는 방향과 같다
    var panF0 = viewDir.clone().negate();
    var panR0 = new THREE.Vector3().crossVectors(panF0, new THREE.Vector3(0, 1, 0));
    if (panR0.lengthSq() < 1e-8) panR0.set(1, 0, 0);
    else panR0.normalize();
    var panU0 = new THREE.Vector3().crossVectors(panR0, panF0).normalize();
    var reduceMq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    function viewHeight() {
      return 2 * camera.position.distanceTo(controls.target) * Math.tan((camera.fov * Math.PI) / 360);
    }
    // 한도 하나(여유 g ≥ 0이면 안쪽)에서 이동 비율 1당 여유가 q만큼 줄 때 갈 수 있는 비율(0~1).
    // 이미 밖(g ≤ 0)이면 더 바깥으로는 0, 안쪽으로·나란히(q ≤ eps — 수치 오차로 생긴 아주 작은 값 포함)는 그대로 1.
    function sideRoom(g, q, eps) {
      return q <= eps ? 1 : g <= 0 ? 0 : Math.min(1, g / q);
    }
    // 화면 기준 이동량(sx: 오른쪽 +, sy: 위쪽 +, len: 월드 거리) → 한도를 적용한 이동 벡터(panVec)
    function panDelta(sx, sy, len) {
      panRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
      panUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
      panVec.copy(panRight).multiplyScalar(sx * len).addScaledVector(panUp, sy * len);
      var T = controls.target;
      if (panVec.y < 0) panVec.y = Math.max(panVec.y, Math.min(0, Math.min(center.y, groundY) - T.y)); // 바닥: 아래로는 거기까지(수평 성분은 그대로 — 미끄러짐)
      // 틀: 처음 시점 카메라로 보았을 때 과녁이 장면 틀 안에 보여야 한다 — 좌우 width/2, 위아래 depth×0.4(computeFit이 세로로 맞추는
      // depth×0.8의 절반), 중심 깊이에서 잰 값을 원근에 맞춰(과녁이 그 카메라 쪽으로 오면 k < 1로 좁아진다). 앞뒤(깊이)는 depth/2.
      panOff.subVectors(T, center);
      var a = panOff.dot(panR0);
      var b = panOff.dot(panU0);
      var c = panOff.dot(panF0);
      var da = panVec.dot(panR0);
      var db = panVec.dot(panU0);
      var dc = panVec.dot(panF0);
      var hw = frame.width / 2;
      var hh = frame.depth * 0.4;
      var hd = frame.depth / 2;
      var k = 1 + c / fitDistance;
      var dk = dc / fitDistance;
      var eps = panVec.length() * 1e-6;
      var s = Math.min(
        sideRoom(hw * k - a, da - hw * dk, eps),
        sideRoom(a + hw * k, -da - hw * dk, eps),
        sideRoom(hh * k - b, db - hh * dk, eps),
        sideRoom(b + hh * k, -db - hh * dk, eps),
        sideRoom(hd - c, dc, eps),
        sideRoom(c + hd, -dc, eps)
      );
      return panVec.multiplyScalar(s);
    }
    function canPan(sx, sy) {
      var len = viewHeight() * 0.02 || 0.01;
      return panDelta(sx, sy, len).length() > len * 0.05;
    }
    function startPan(sx, sy, held) {
      if (disposed || !canPan(sx, sy)) return false;
      var step = viewHeight() * PAN_STEP;
      if (!held && pan && !pan.held && pan.sx === sx && pan.sy === sy) pan.want = Math.min(pan.done + 2 * step, pan.want + step); // 같은 쪽을 또(키보드) — 두 칸까지만 쌓인다
      else pan = { sx: sx, sy: sy, held: !!held, want: step, done: 0, last: performance.now() };
      setRunning();
      return true;
    }
    function releasePan() {
      if (pan) pan.held = false; // 뗀 뒤에는 한 칸을 다 채울 때까지만 간다
    }
    function stopPan() {
      pan = null;
      if (panUI) panUI.unpress();
    }
    // 렌더 루프에서 한 장면마다: blocked(앱의 카메라 트윈·끌기 중)면 쉬고, 아니면 시간만큼 옮긴다
    function stepPan(now, blocked) {
      var dt = Math.min(0.1, Math.max(0, (now - pan.last) / 1000)); // 멈칫한 뒤에도 한 번에 크게 튀지 않게(장면이 느려도 초당 10장까지는 제 속도)
      pan.last = now;
      if (blocked) return;
      var speed = viewHeight() * PAN_SPEED;
      var len = pan.held ? speed * dt : reduceMq && reduceMq.matches ? pan.want - pan.done : Math.min(pan.want - pan.done, speed * dt);
      if (len > 0) {
        var d = panDelta(pan.sx, pan.sy, len);
        camera.position.add(d);
        controls.target.add(d);
        pan.done += len;
        if (!pan.held && d.lengthSq() === 0) pan.done = pan.want; // 한도에 닿았으면 남은 칸은 버린다
      }
      if (!pan.held && pan.done >= pan.want - 1e-9) {
        pan = null;
        if (panUI) panUI.refresh(); // 이동이 끝났으니 보이기·흐림을 다시 판단(누르는 동안에는 숨기지 않는다)
      }
    }

    var SVG_NS = "http://www.w3.org/2000/svg";
    var panUI = (function () {
      var doc = container.ownerDocument || document;
      var dirs = [
        { key: "up", sx: 0, sy: 1, label: "화면을 위로 옮기기", d: "M6 15l6-6 6 6" },
        { key: "left", sx: -1, sy: 0, label: "화면을 왼쪽으로 옮기기", d: "M15 6l-6 6 6 6" },
        { key: "right", sx: 1, sy: 0, label: "화면을 오른쪽으로 옮기기", d: "M9 6l6 6-6 6" },
        { key: "down", sx: 0, sy: -1, label: "화면을 아래로 옮기기", d: "M6 9l6 6 6-6" },
      ];
      var wrap = doc.createElement("div");
      wrap.className = "ss-pan";
      wrap.setAttribute("role", "group");
      wrap.setAttribute("aria-label", "확대한 화면 옮기기");
      wrap.hidden = true;
      var shown = false;
      var pressed = null; // { dd, id } — 누르고 있는 화살표와 포인터
      var lastLayout = 0;
      var range = doc.createRange ? doc.createRange() : null;

      // 화살표가 보이는 동안 장면 칸의 드래그 안내 줄(.ss-view-tip)을 짧은 이동 안내로 바꿔 둔다(2026-09-26 사용자 요청 — 화살표가
      // 숨으면 원래 안내로). 원래 줄보다 짧아 줄이 늘지 않는다(휴대폰도 한 줄). 안내 줄은 실험 틀·앱이 쓰는 것이므로, 그사이 앱이
      // 새로 써서 우리 안내가 빠지면 되돌릴 때 옛 글을 덮지 않고(아래 setTip), tick()이 0.25초 안에 그 새 글을 맡아 두고 다시 바꾼다.
      var tipLine = doc.createElement("span");
      tipLine.className = "ss-pan-tip";
      tipLine.textContent = "👆 화살표: 화면 옮기기 · 두 번 탭: 처음 방향";
      var tipSaved = null; // { tip, nodes } — 바꾸기 전 안내 줄의 자식 노드
      function setTip(on) {
        if (on) {
          if (tipSaved) return;
          var host = container.parentElement && container.parentElement.classList.contains("ss-exp-view") ? container.parentElement : null;
          var tip = host ? host.querySelector(".ss-view-tip") : null;
          if (!tip) return;
          tipSaved = { tip: tip, nodes: [].slice.call(tip.childNodes) };
          tipSaved.nodes.forEach(function (n) {
            tip.removeChild(n);
          });
          tip.appendChild(tipLine);
        } else if (tipSaved) {
          var saved = tipSaved;
          tipSaved = null;
          if (tipLine.parentNode !== saved.tip) return;
          saved.tip.removeChild(tipLine);
          saved.nodes.forEach(function (n) {
            saved.tip.appendChild(n);
          });
        }
      }

      function onWinUp(e) {
        if (pressed && e.pointerId === pressed.id) release();
      }
      function onWinCancel(e) {
        if (pressed && e.pointerId === pressed.id) stopPan();
      }
      // 누른 채 손가락(포인터)이 화살표 밖으로 나가면 멈춘다(터치는 떼기 전까지 pointerleave가 안 올 수 있어 자리로 본다)
      function onWinMove(e) {
        if (!pressed || e.pointerId !== pressed.id) return;
        var r = pressed.dd.btn.getBoundingClientRect();
        if (e.clientX < r.left - 6 || e.clientX > r.right + 6 || e.clientY < r.top - 6 || e.clientY > r.bottom + 6) release();
      }
      function unpress() {
        if (!pressed) return;
        pressed.dd.btn.classList.remove("is-pressed");
        pressed = null;
        window.removeEventListener("pointerup", onWinUp, true);
        window.removeEventListener("pointercancel", onWinCancel, true);
        window.removeEventListener("pointermove", onWinMove, true);
      }
      function release() {
        releasePan();
        unpress();
      }
      dirs.forEach(function (dd) {
        var b = doc.createElement("button");
        b.type = "button";
        b.className = "ss-pan-btn ss-pan-" + dd.key;
        b.setAttribute("aria-label", dd.label);
        var svg = doc.createElementNS(SVG_NS, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        var path = doc.createElementNS(SVG_NS, "path");
        path.setAttribute("d", dd.d);
        svg.appendChild(path);
        b.appendChild(svg);
        dd.btn = b;
        dd.ok = true;
        b.addEventListener("pointerdown", function (e) {
          if (e.pointerType === "mouse" && e.button !== 0) return; // 마우스는 주(왼쪽) 버튼만
          unpress();
          try {
            if (b.hasPointerCapture && b.hasPointerCapture(e.pointerId)) b.releasePointerCapture(e.pointerId); // 터치의 암묵적 붙잡기를 풀어 벗어남을 알 수 있게
          } catch (err) {
            /* 무시 */
          }
          if (!startPan(dd.sx, dd.sy, true)) return;
          pressed = { dd: dd, id: e.pointerId };
          b.classList.add("is-pressed");
          window.addEventListener("pointerup", onWinUp, true);
          window.addEventListener("pointercancel", onWinCancel, true);
          window.addEventListener("pointermove", onWinMove, true);
        });
        b.addEventListener("pointerleave", function (e) {
          if (pressed && pressed.dd === dd && e.pointerId === pressed.id) release();
        });
        // 키보드(Enter·Space)·보조 기술의 누르기(detail 0) = 한 칸. 포인터 누르기는 pointerdown이 맡는다
        b.addEventListener("click", function (e) {
          if (e.detail === 0) startPan(dd.sx, dd.sy, false);
        });
        b.addEventListener("keydown", function (e) {
          if (e.repeat && (e.key === "Enter" || e.key === " ")) e.preventDefault(); // 키를 누르고 있어도 한 번에 한 칸
        });
        b.addEventListener("contextmenu", function (e) {
          e.preventDefault(); // 길게 누르기 메뉴가 뜨지 않게
        });
        wrap.appendChild(b);
      });
      container.appendChild(wrap);

      function wanted() {
        return camera.position.distanceTo(controls.target) < fitDistance * PAN_ZOOM || controls.target.distanceTo(center) > fitDistance * PAN_MOVED;
      }
      // 보이기·흐림 다시 판단(카메라가 바뀔 때마다). again이면 자리도 다시 잰다(화면 크기가 바뀔 때)
      function refresh(again) {
        if (disposed) return;
        var want = wanted();
        if (!want && pan) return; // 옮기는 중에는 숨기지 않는다 — 이동이 끝나면 stepPan이 다시 부른다
        var appear = want && !shown;
        if (want !== shown) {
          shown = want;
          wrap.hidden = !want;
          setTip(want); // 자리를 재기 전에 안내 줄을 바꾼다(바뀐 줄을 피해서 자리를 잡게)
          if (!want) unpress();
        }
        if (!shown) return;
        dirs.forEach(function (dd) {
          var ok = canPan(dd.sx, dd.sy);
          if (ok === dd.ok) return;
          dd.ok = ok;
          dd.btn.classList.toggle("is-limit", !ok);
          if (ok) dd.btn.removeAttribute("aria-disabled");
          else dd.btn.setAttribute("aria-disabled", "true");
        });
        if (appear || again) layout();
      }

      // ── 자리 잡기: 가장자리 가운데에서 시작해, 장면 칸(.ss-exp-view) 안에 보이는 다른 요소(토글·모형 배지·앱 표시·드래그 안내 글)와
      //    겹치지 않는 가장 가까운 자리로(▲는 아래로, ▼는 위로, ◀▶는 가운데 높이에서 위아래로). 바탕이 없는 글은 글자 줄만 피한다.
      function solidBox(e, cs) {
        if (/^(svg|img|canvas|video|button|input|select|textarea|progress|meter)$/i.test(e.tagName)) return true;
        if (cs.backgroundImage && cs.backgroundImage !== "none") return true;
        if (cs.boxShadow && cs.boxShadow !== "none") return true;
        var clear = /^(transparent|rgba\(.*,\s*0\))$/;
        if (cs.backgroundColor && !clear.test(cs.backgroundColor)) return true;
        return ["Top", "Right", "Bottom", "Left"].some(function (s) {
          return parseFloat(cs["border" + s + "Width"]) > 0 && cs["border" + s + "Style"] !== "none" && !clear.test(cs["border" + s + "Color"]);
        });
      }
      function obstacles(host, cr) {
        var out = [];
        var list = host.getElementsByTagName("*");
        for (var i = 0; i < list.length; i++) {
          var e = list[i];
          if (e === el || e === wrap || wrap.contains(e)) continue;
          if (e.namespaceURI === SVG_NS && e.tagName.toLowerCase() !== "svg") continue; // svg 안 도형은 svg 상자로 충분
          var r = e.getBoundingClientRect();
          if (!(r.width > 0 && r.height > 0)) continue;
          if (r.right <= cr.left || r.left >= cr.right || r.bottom <= cr.top || r.top >= cr.bottom) continue; // 3D 칸 밖(아래 막대 등)
          if (r.width > cr.width * 0.6 && r.height > cr.height * 0.6) continue; // 장면을 덮는 겹(3D 칸·글 층) — 그 안의 요소는 따로 본다
          var cs = getComputedStyle(e);
          if (cs.visibility === "hidden" || cs.opacity === "0") continue;
          if (solidBox(e, cs)) out.push(r);
          else if (range) {
            var clip = cs.overflowX !== "visible" || cs.overflowY !== "visible"; // 넘친 글자가 잘려 안 보이면(… 줄임) 요소 상자까지만
            for (var n = e.firstChild; n; n = n.nextSibling) {
              if (n.nodeType !== 3 || !/\S/.test(n.nodeValue)) continue;
              range.selectNodeContents(n);
              var rs = range.getClientRects();
              for (var k = 0; k < rs.length; k++) {
                var q = rs[k];
                if (clip) q = { left: Math.max(q.left, r.left), top: Math.max(q.top, r.top), right: Math.min(q.right, r.right), bottom: Math.min(q.bottom, r.bottom) };
                if (q.right > q.left && q.bottom > q.top) out.push(q);
              }
            }
          }
        }
        return out;
      }
      function layout() {
        lastLayout = performance.now();
        if (!shown) return;
        var cr = container.getBoundingClientRect();
        if (!(cr.width > 0 && cr.height > 0)) return;
        var host = container.parentElement && container.parentElement.classList.contains("ss-exp-view") ? container.parentElement : container;
        var obs = obstacles(host, cr).map(function (r) {
          return { x0: r.left - cr.left, y0: r.top - cr.top, x1: r.right - cr.left, y1: r.bottom - cr.top };
        });
        var S = dirs[0].btn.offsetWidth || 44;
        var W = cr.width;
        var H = cr.height;
        var M = 8; // 가장자리에서 떨어진 거리
        var G = 4; // 다른 요소와 띄울 틈
        function hit(x, y) {
          for (var i = 0; i < obs.length; i++) {
            var o = obs[i];
            if (x - G < o.x1 && x + S + G > o.x0 && y - G < o.y1 && y + S + G > o.y0) return true;
          }
          return false;
        }
        function put(dd, x, y) {
          var at = Math.round(x) + "," + Math.round(y);
          if (dd.at !== at) {
            dd.at = at; // 자리가 바뀔 때만 쓴다(0.25초마다 다시 재도 스타일을 건드리지 않게)
            dd.btn.style.left = Math.round(x) + "px";
            dd.btn.style.top = Math.round(y) + "px";
          }
          obs.push({ x0: x, y0: y, x1: x + S, y1: y + S });
        }
        var cx = (W - S) / 2;
        var cy = (H - S) / 2;
        var y;
        var got = null;
        for (y = M; y <= cy; y += 2) if (!hit(cx, y)) {
          got = y;
          break;
        }
        put(dirs[0], cx, got == null ? M : got); // ▲
        got = null;
        for (y = H - M - S; y >= M; y -= 2) if (!hit(cx, y)) {
          got = y;
          break;
        }
        put(dirs[3], cx, got == null ? H - M - S : got); // ▼
        [dirs[1], dirs[2]].forEach(function (dd) {
          var x = dd.sx < 0 ? M : W - M - S;
          var at = null;
          for (var k = 0; at == null && (cy + k <= H - M - S || cy - k >= M); k += 2) {
            if (cy + k <= H - M - S && !hit(x, cy + k)) at = cy + k;
            else if (k && cy - k >= M && !hit(x, cy - k)) at = cy - k;
          }
          put(dd, x, at == null ? cy : at); // ◀ ▶
        });
      }
      // 렌더 루프에서: 보이는 동안 앱 표시(안내 글·HUD 등)가 생기고 없어지는 것을 따라 가끔(0.25초마다) 자리를 다시 잰다 — 누르는 동안은 그대로
      function tick(now) {
        // 화살표가 보이는 동안 앱이 안내 줄을 새로 썼으면(3D를 붙인 뒤 쓰는 앱 등) 새 글을 맡아 두고 다시 이동 안내로 바꾼다
        if (shown && tipSaved && tipLine.parentNode !== tipSaved.tip) {
          tipSaved = null;
          setTip(true);
        }
        if (!shown || pressed || pan || now - lastLayout < 250) return;
        layout();
      }
      function dispose() {
        unpress();
        setTip(false);
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      }
      return { refresh: refresh, unpress: unpress, tick: tick, dispose: dispose, wrap: wrap };
    })();
    function onPanChange() {
      panUI.refresh(false);
    }
    controls.addEventListener("change", onPanChange);
    function onPanBlur() {
      stopPan(); // 창을 떠나면 멈춘다
    }
    window.addEventListener("blur", onPanBlur);

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
      // obj와 그 자식 가운데 탭·끌기 대상으로 등록한 것은 모두 뺀다(떼어 낸 물체가 계속 걸리지 않게)
      if (dragState && entryOfObjTree(obj, dragState.entry.obj)) endDrag(null); // 끄는 중이던 물체면 마지막 point로 onEnd
      obj.traverse(function (o) {
        var i = pickables.indexOf(o);
        if (i >= 0) pickables.splice(i, 1);
        for (var j = draggables.length - 1; j >= 0; j--) if (draggables[j].obj === o) draggables.splice(j, 1);
      });
      freeObject(obj);
    }
    // obj(또는 그 자손)가 target인지 확인(끌던 물체가 discard될 때 드래그를 안전하게 끝내려고)
    function entryOfObjTree(obj, target) {
      var found = false;
      obj.traverse(function (o) {
        if (o === target) found = true;
      });
      return found;
    }

    // ── 시점 저장·되돌리기 / 화면 위 자리 / 사진(스냅샷) ──
    function cameraPose() {
      return { position: camera.position.toArray(), target: controls.target.toArray() };
    }
    function applyPose(p) {
      camera.position.fromArray(p.position);
      controls.target.fromArray(p.target);
      camera.lookAt(controls.target);
      camera.updateMatrixWorld();
    }
    function setCameraPose(p) {
      if (disposed || !p) return;
      applyPose(p);
      controls.update();
      renderer.render(scene, camera);
    }
    function projectNow(at) {
      var v3 = new THREE.Vector3().fromArray(at).project(camera);
      var x = (v3.x + 1) / 2;
      var y = (1 - v3.y) / 2;
      return { x: x, y: y, inView: v3.z < 1 && x >= 0 && x <= 1 && y >= 0 && y <= 1 };
    }
    function project(at, pose) {
      if (!pose) {
        camera.updateMatrixWorld();
        return projectNow(at);
      }
      var keep = cameraPose();
      applyPose(pose);
      var r = projectNow(at);
      applyPose(keep);
      return r;
    }
    function snapshot(o) {
      if (disposed) return null;
      o = o || {};
      var keep = cameraPose();
      var hidden = (o.hide || []).filter(function (h) {
        return h && h.visible;
      });
      hidden.forEach(function (h) {
        h.visible = false;
      });
      if (o.pose) applyPose(o.pose);
      else camera.updateMatrixWorld();
      renderer.render(scene, camera);
      var src = renderer.domElement;
      var w = Math.max(64, Math.round(o.width || 480));
      var h = Math.max(1, Math.round((w * (src.height || 1)) / (src.width || 1)));
      var c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      var g = c.getContext("2d");
      g.drawImage(src, 0, 0, w, h); // 같은 작업 안에서 복사해야 WebGL 버퍼가 비워지기 전에 담긴다
      var marks = (o.marks || []).map(function (m) {
        var p = projectNow(m.at);
        var r = (m.radius || 0.06) * w;
        var mk = { x: p.x * w, y: p.y * h, r: r, inView: p.inView };
        if (p.inView) {
          g.save();
          g.setLineDash([Math.max(4, r * 0.28), Math.max(3, r * 0.18)]);
          g.lineWidth = Math.max(3, w / 110);
          g.strokeStyle = "rgba(255,255,255,0.95)";
          g.beginPath();
          g.arc(mk.x, mk.y, r, 0, Math.PI * 2);
          g.stroke();
          g.lineWidth = Math.max(2, w / 180);
          g.strokeStyle = m.color || "#e8590c";
          g.stroke();
          g.restore();
          if (m.label) {
            g.font = "700 " + Math.round(Math.max(12, w / 30)) + "px system-ui, sans-serif";
            g.textAlign = "center";
            g.textBaseline = "bottom";
            g.lineWidth = 4;
            g.strokeStyle = "rgba(255,255,255,0.95)";
            var ty = mk.y - r - 4 < 14 ? mk.y + r + Math.max(14, w / 28) : mk.y - r - 4;
            g.strokeText(m.label, mk.x, ty);
            g.fillStyle = "#1f2733";
            g.fillText(m.label, mk.x, ty);
          }
        }
        return mk;
      });
      hidden.forEach(function (hd) {
        hd.visible = true;
      });
      applyPose(keep);
      controls.update();
      renderer.render(scene, camera);
      var url = "";
      try {
        url = c.toDataURL(o.type || "image/jpeg", o.quality || 0.86);
      } catch (e) {
        /* 무시(캔버스만 쓴다) */
      }
      return { url: url, canvas: c, width: w, height: h, marks: marks };
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
      draggable: function (obj, dopts) {
        draggables.push({ obj: obj, opts: dopts || {} });
      },
      discard: discard,
      cameraPose: cameraPose,
      setCameraPose: setCameraPose,
      project: project,
      snapshot: snapshot,
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
        if (dragState) endDrag(null); // 끄는 중이면 마지막 point로 onEnd(카메라 조작 값도 되돌린다)
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
        el.removeEventListener("pointerdown", onDragDown);
        el.removeEventListener("pointermove", onHoverMove);
        pan = null;
        panUI.dispose(); // 이동 화살표(누르는 중이면 창 리스너까지) 떼기
        controls.removeEventListener("change", onPanChange);
        window.removeEventListener("blur", onPanBlur);
        window.removeEventListener("pointermove", onDragMove);
        window.removeEventListener("pointerup", onDragUp);
        window.removeEventListener("pointercancel", onDragUp);
        dragState = null;
        controls.dispose();
        freeObject(scene);
        if (scene.background && scene.background.isTexture) scene.background.dispose();
        pickables.length = 0;
        draggables.length = 0;
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
