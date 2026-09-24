// 부엉이 마스코트 흰 배경 제거 v2 (2026-09-25) — 가장자리 흰 테두리(헤일로)·울퉁불퉁한 윤곽·발밑 그림자 없애기.
// 사용: node cutout.cjs <원본.jpg> <결과.webp> [원본크기 확인용.png] [BAND]
//   예) for p in wave tablet think cheer; do node cutout.cjs owl-$p-source.jpg ../../../../public/illustrations/mascot/owl-$p.webp; done
//   BAND를 비우거나 auto면 발 위치로 그림자 띠를 자동으로 잡는다(4장 모두 auto로 만들었다). 1보다 큰 수면 그 행부터(수동 조정용).
//
// v1(단순 "거의 흰색" flood fill)은 가장자리 1~4px의 "부엉이 색 + 흰 배경이 섞인" 픽셀을 그대로 남겨 어두운 바탕에서
// 흰 띠가 보였고, JPEG 압축 얼룩 때문에 윤곽이 들쭉날쭉했다. v2는 다음 순서로 처리한다(모두 원본 해상도 1264px에서).
//  1) 배경 찾기: 얼룩을 살짝 흐린 값으로, 테두리에서 이어진 거의 흰색을 두 문턱(252 보수적 / 248은 그 4px 안쪽까지만)으로
//     채운다. 주황 발을 찾아 발 높이의 바닥 그림자(회색·발빛 반사)와, 다리 사이에 막힌 흰 구멍(둘레가 색 있는 몸)도 배경으로.
//  2) 잡티 제거·윤곽 다듬기: 작은 조각 제거, 흰 가운 가장자리의 가는 흰 돌기 깎기(색 있는 끝은 보존), 가우시안으로 흐린 뒤
//     0.5에서 다시 잘라 매끈한 윤곽.
//  3) 윤곽까지의 부호 거리(EDT)로 "확실한 안쪽 / 확실한 배경 / 경계 띠"를 나눈다.
//  3.5) 윤곽 다시 잡기: 윤곽 안쪽 10px 이내에서 주변 몸 색 F보다 배경색 B에 더 가까운 픽셀을 배경 쪽부터 걷어 낸다
//     (흰 가운처럼 가장자리가 완만하게 바래는 곳의 흰 띠·돌기 제거, 배경만큼 밝은 소매 끝은 건드리지 않음).
//     떨어져 남은 작은 조각·거의 흰 덩어리(800px 미만)도 지운다.
//  4) 경계 띠의 픽셀마다 주변 안쪽의 부엉이 색 F와 주변 배경색 B를 구해(정규화 합성곱),
//     실제 색 C가 B→F 사이 어디쯤인지로 투명도 α를 계산한다(α = (C−B)·(F−B) / |F−B|²).
//     F가 배경과 거의 같은 곳(|F−B|<20)은 색으로 가를 수 없으므로 매끈한 윤곽의 기하 α(1px 부드러운 경계)를 쓴다.
//  5) 색 오염 제거: 경계 픽셀의 색에서 흰 배경을 걷어 내(F' = B + (C−B)/α), α가 작을수록 주변 부엉이 색 F 쪽으로 맞춘다
//     → 어떤 바탕에 올려도 흰 테두리가 남지 않는다.
//  6) 투명 여백을 잘라 640px 상자에 맞춰 줄인 뒤(알파 곱셈 보정은 sharp가 처리) WebP(알파 무손실)로 저장.
//  크기가 바뀌면 src/components/illustrations/mascot.tsx의 MASCOT_PIXELS도 고친다.
const sharp = require("/Users/sungchul/Desktop/classroom/node_modules/sharp");
const [, , src, dst, previewDst, BAND0 = "auto"] = process.argv;
const BAND = BAND0 === "auto" ? 0 : Number(BAND0);

function gaussKernel(sigma) {
  const r = Math.max(1, Math.ceil(sigma * 3));
  const k = new Float32Array(2 * r + 1);
  let s = 0;
  for (let i = -r; i <= r; i++) s += k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma));
  for (let i = 0; i < k.length; i++) k[i] /= s;
  return { k, r };
}
// 한 채널 가우시안 흐림(분리형, 가장자리는 늘려 채움)
function blur(src, w, h, sigma) {
  const { k, r } = gaussKernel(sigma);
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let j = -r; j <= r; j++) { const xx = x + j < 0 ? 0 : x + j >= w ? w - 1 : x + j; s += src[row + xx] * k[j + r]; }
      tmp[row + x] = s;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let j = -r; j <= r; j++) { const yy = y + j < 0 ? 0 : y + j >= h ? h - 1 : y + j; s += tmp[yy * w + x] * k[j + r]; }
      out[y * w + x] = s;
    }
  }
  return out;
}
// Felzenszwalb–Huttenlocher 제곱 유클리드 거리 변환: feature(1)까지의 거리
function edt(feature, w, h) {
  const INF = 1e20, f = new Float64Array(Math.max(w, h)), d = new Float64Array(Math.max(w, h));
  const v = new Int32Array(Math.max(w, h)), z = new Float64Array(Math.max(w, h) + 1);
  const grid = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) grid[i] = feature[i] ? 0 : INF;
  const pass = (n, get, set) => {
    for (let q = 0; q < n; q++) f[q] = get(q);
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
    for (let q = 0; q < n; q++) set(q, d[q]);
  };
  for (let x = 0; x < w; x++) pass(h, (q) => grid[q * w + x], (q, val) => { grid[q * w + x] = val; });
  for (let y = 0; y < h; y++) pass(w, (q) => grid[y * w + q], (q, val) => { grid[y * w + q] = val; });
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = Math.sqrt(grid[i]);
  return out;
}
// 정규화 합성곱: weight가 있는 곳의 색을 주변으로 번지게 한 지역 평균(가까운 곳 우선). 여러 σ로 빈 곳을 채운다.
function localMean(chs, weight, w, h, sigmas) {
  const N = w * h, out = chs.map(() => new Float32Array(N)), filled = new Uint8Array(N);
  for (const sg of sigmas) {
    const den = blur(weight, w, h, sg);
    const nums = chs.map((c) => { const t = new Float32Array(N); for (let i = 0; i < N; i++) t[i] = c[i] * weight[i]; return blur(t, w, h, sg); });
    for (let i = 0; i < N; i++) if (!filled[i] && den[i] > 1e-3) { for (let c = 0; c < chs.length; c++) out[c][i] = nums[c][i] / den[i]; filled[i] = 1; }
  }
  return { out, filled };
}

(async () => {
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height, N = w * h;
  const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N);
  for (let i = 0; i < N; i++) { R[i] = data[i * 3]; G[i] = data[i * 3 + 1]; B[i] = data[i * 3 + 2]; }
  // 배경·그림자 판정은 JPEG 얼룩(배경 253±2)을 살짝 흐린 값으로 한다 — 그대로 문턱을 대면 흰 가운 윤곽이 얼룩을 따라 들쭉날쭉해진다.
  // (최종 색·투명도 계산은 원래 값 R·G·B를 쓴다)
  const Rs = blur(R, w, h, 1.0), Gs = blur(G, w, h, 1.0), Bs = blur(B, w, h, 1.0);
  const mn = (i) => Math.min(Rs[i], Gs[i], Bs[i]), sat = (i) => Math.max(Rs[i], Gs[i], Bs[i]) - Math.min(Rs[i], Gs[i], Bs[i]);

  // 1) 배경: 테두리에서 이어진 거의 흰색(채도 낮음). 문턱은 252로 높게 — 248로 낮추면 태블릿 부엉이의 밝은 소매 끝으로
  //    배경이 새어 들어가 소매에 구멍이 났다(v1이 252를 쓴 까닭). 문턱 아래의 가장자리 픽셀은 4)의 경계 띠가 처리한다.
  const bg = new Uint8Array(N), q = new Int32Array(N);
  let qh = 0, qt = 0;
  const near = (i) => mn(i) >= 252 && sat(i) <= 14;
  const push = (i) => { if (!bg[i] && near(i)) { bg[i] = 1; q[qt++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  const grow = (ok) => {
    while (qh < qt) {
      const i = q[qh++], x = i % w, y = (i / w) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && !bg[j] && ok(j)) { bg[j] = 1; q[qt++] = j; }
      }
    }
  };
  grow(near);
  // 두 문턱(히스테리시스): 248로 넓게 잡은 배경은 252(보수적) 배경에서 4px 안쪽까지만 인정한다.
  //  - 흰 가운·색종이 둘레의 248~251 흰 조각(JPEG 얼룩)은 보수적 배경 바로 옆이라 지워지고,
  //  - 태블릿 부엉이 소매 끝처럼 배경만큼 밝은 곳으로 깊이 새어 든 부분(4px보다 안쪽)은 지켜진다.
  {
    const nearLo = (i) => mn(i) >= 248 && sat(i) <= 14;
    const bgA = new Uint8Array(N), qa = new Int32Array(N);
    let ah = 0, at = 0;
    const pa = (i) => { if (!bgA[i] && nearLo(i)) { bgA[i] = 1; qa[at++] = i; } };
    for (let x = 0; x < w; x++) { pa(x); pa((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { pa(y * w); pa(y * w + w - 1); }
    while (ah < at) {
      const i = qa[ah++], x = i % w, y = (i / w) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0) pa(j);
    }
    const dCons = edt(bg, w, h);
    for (let i = 0; i < N; i++) if (!bg[i] && bgA[i] && dCons[i] <= 4) bg[i] = 1;
  }
  // 발 찾기: 아래쪽 30%에서 주황 발(큰 덩어리)만 — 색종이 조각처럼 작은 주황·노랑 조각은 뺀다.
  // 바닥 그림자는 발 높이에 있고, 흰 가운 아랫단·배·다리는 발보다 위에 있으므로 발을 기준으로 띠를 잡는다
  // (캐릭터 높이 비율로 잡으면 자세마다 가운 길이가 달라 가운 아랫단이 가로로 잘리거나 그림자가 남았다).
  const orange = (i) => { const r = R[i], g = G[i], b = B[i]; return r >= 150 && r - b >= 60 && g >= 80 && r - g >= 15 && g - b >= 25; };
  let feetTop = h, feetBot = -1, feetL = w, feetR = -1;
  {
    const seen = new Uint8Array(N), y0 = Math.floor(h * 0.7);
    for (let s0 = y0 * w; s0 < N; s0++) {
      if (seen[s0] || !orange(s0)) continue;
      const comp = [s0]; seen[s0] = 1;
      for (let t = 0; t < comp.length; t++) {
        const i = comp[t], x = i % w, y = (i / w) | 0;
        for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > y0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
          if (j >= 0 && !seen[j] && orange(j)) { seen[j] = 1; comp.push(j); }
        }
      }
      if (comp.length >= 800) for (const i of comp) {
        const x = i % w, y = (i / w) | 0;
        if (y < feetTop) feetTop = y; if (y > feetBot) feetBot = y; if (x < feetL) feetL = x; if (x > feetR) feetR = x;
      }
    }
  }
  if (feetBot < 0) throw new Error("발(주황 덩어리)을 찾지 못했다 — BAND를 행 번호로 직접 주세요");
  // 바닥 그림자 띠: 발 윗선 5px 위부터 아래(바닥 그림자는 발 옆으로 넓게 퍼져 발 윗선 가까이까지 올라온다 — 더 아래서
  // 시작하면 그림자 윗부분이 가로선으로 잘려 남는다. 가운 아랫단은 발 윗선보다 10~25px 위라 걸리지 않는다).
  // BAND 인자가 1보다 크면 그 행으로 덮어쓴다(수동 조정용).
  const bandY = BAND > 1 ? Math.round(BAND) : feetTop - 5;
  // 아래쪽 띠에서의 바닥 그림자 규칙(발은 주황·발톱은 연보라라 걸리지 않는다):
  //  - 채도가 아주 낮은 회색이면 진해도 그림자(발 사이 접지 그림자는 밝기 130~140 — v1의 "150 이상"으로는 남았다)
  //  - 발바닥 바로 아래 바닥에 비친 주황빛(따뜻한 연회색: 밝고, R≥G≥B, 채도 45 이하)도 그림자
  const inBand = (j) => ((j / w) | 0) >= bandY;
  const shadowLike = (j) => {
    if (!inBand(j)) return false;
    const r = R[j], g = G[j], b = B[j], lo = mn(j), s = sat(j);
    if (lo >= 95 && s <= 18) return true;
    return lo >= 170 && s <= 45 && r >= g && g >= b - 2;
  };
  const reseed = () => { qh = 0; qt = 0; for (let i = 0; i < N; i++) if (bg[i]) q[qt++] = i; };
  // 막힌 흰 구멍(배 아래·다리 사이처럼 발·다리·그림자에 둘러싸여 테두리와 이어지지 않은 흰 배경):
  //  발 근처(발 위 40px ~ 발 아래, 두 발 가로 범위)에 있고, 둘레 2px에 색 있는 픽셀(보라 다리·주황 발, 채도 25 이상)이
  //  30% 이상이면 배경으로. 둘레가 흰·회색뿐인 것(가운의 반짝임)과 발 근처 밖(눈·고글·시험관 반짝임)은 건드리지 않는다.
  const nearHole = (i) => mn(i) >= 244 && sat(i) <= 14;
  const holeZone = (i) => { const x = i % w, y = (i / w) | 0; return y >= feetTop - 40 && y <= feetBot + 10 && x >= feetL - 10 && x <= feetR + 10; };
  const holes = [], skipped = [];
  for (let pass = 0; pass < 2; pass++) {
    const seen = new Uint8Array(N);
    for (let s0 = 0; s0 < N; s0++) {
      if (bg[s0] || seen[s0] || !nearHole(s0) || !holeZone(s0)) continue;
      const comp = [s0]; seen[s0] = 1;
      let touchesBg = false;
      for (let t = 0; t < comp.length; t++) {
        const i = comp[t], x = i % w, y = (i / w) | 0;
        for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
          if (j < 0) continue;
          if (bg[j]) touchesBg = true;
          else if (!seen[j] && nearHole(j)) { seen[j] = 1; comp.push(j); }
        }
      }
      if (comp.length > 6000 || !comp.every(holeZone)) { skipped.push(((comp[0] / w) | 0) + ":" + comp.length); continue; }
      const inComp = new Set(comp), ring = new Set();
      for (const i of comp) {
        const x = i % w, y = (i / w) | 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          if (!inComp.has(j) && !bg[j]) ring.add(j);
        }
      }
      let colored = 0;
      for (const j of ring) if (sat(j) >= 25) colored++;
      // 배경에 닿아 있든 막혀 있든 "둘레가 색 있는 몸"일 때만 지운다(가운 아랫단처럼 둘레가 흰색이면 남긴다)
      if (ring.size > 0 && colored / ring.size >= 0.3) { for (const i of comp) bg[i] = 1; holes.push(comp.length + (touchesBg ? "t" : "")); }
      else skipped.push(((comp[0] / w) | 0) + ":" + comp.length + "w");
    }
    reseed(); grow(shadowLike);
    // 그림자를 걷어 내면 새로 이어지는 흰 배경(배 아래·두 발 사이처럼 발과 그림자에 둘러싸여 있던 곳)도 배경으로
    reseed(); grow(near);
  }

  // 2) 작은 조각(배경 속 JPEG 얼룩) 제거: 전경 연결 요소 중 면적 60px 미만은 배경으로
  const lab = new Int32Array(N).fill(-1);
  for (let s = 0; s < N; s++) {
    if (bg[s] || lab[s] >= 0) continue;
    const comp = [s]; lab[s] = s;
    for (let t = 0; t < comp.length; t++) {
      const i = comp[t], x = i % w, y = (i / w) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && !bg[j] && lab[j] < 0) { lab[j] = s; comp.push(j); }
      }
    }
    if (comp.length < 60) for (const i of comp) bg[i] = 1;
  }
  // 흰 돌기 깎기(열림 연산, 반지름 2.5px): 흰 가운 가장자리에 붙은 폭 5px 미만의 흰 돌기(JPEG 얼룩)를 없앤다.
  // 깎인 픽셀 중 색이 있는 것(발톱·깃털 끝·색종이 모서리: 채도 30 이상 또는 밝기 200 미만)은 되살린다.
  {
    const notFg0 = new Uint8Array(N);
    for (let i = 0; i < N; i++) notFg0[i] = bg[i];
    const dInside = edt(notFg0, w, h);
    const eroded = new Uint8Array(N);
    for (let i = 0; i < N; i++) eroded[i] = !bg[i] && dInside[i] > 2.5 ? 1 : 0;
    const dToEroded = edt(eroded, w, h);
    for (let i = 0; i < N; i++) {
      if (bg[i] || dToEroded[i] <= 2.5) continue;
      if (sat(i) >= 30 || mn(i) < 200) continue;
      bg[i] = 1;
    }
  }
  // 윤곽 다듬기: 전경 마스크를 σ=1.6으로 흐린 뒤 0.5에서 다시 자른다(들쭉날쭉한 1~2px 굴곡 제거)
  const smoothMask = (src01, sigma) => {
    const m = new Float32Array(N);
    for (let i = 0; i < N; i++) m[i] = src01[i];
    const s = blur(m, w, h, sigma), out = new Uint8Array(N);
    for (let i = 0; i < N; i++) out[i] = s[i] >= 0.5 ? 1 : 0;
    return out;
  };
  const fg0 = new Uint8Array(N);
  for (let i = 0; i < N; i++) fg0[i] = bg[i] ? 0 : 1;
  let fg = smoothMask(fg0, 1.6);

  // 3) 부호 거리: 안쪽은 +(배경까지 거리), 바깥은 −(전경까지 거리). 0.5px 보정으로 윤곽이 픽셀 경계에 오게.
  const signedDist = (m) => {
    const nm = new Uint8Array(N);
    for (let i = 0; i < N; i++) nm[i] = 1 - m[i];
    const dI = edt(nm, w, h), dO = edt(m, w, h), s = new Float32Array(N);
    for (let i = 0; i < N; i++) s[i] = m[i] ? dI[i] - 0.5 : -(dO[i] - 0.5);
    return s;
  };
  // 4) 주변 부엉이 색 F(안쪽 4px 이상), 주변 배경색 Bg(바깥 3px 이상)
  const colorsFor = (s) => {
    const core = new Float32Array(N), coreBg = new Float32Array(N);
    for (let i = 0; i < N; i++) { core[i] = s[i] >= 4 ? 1 : 0; coreBg[i] = s[i] <= -3 ? 1 : 0; }
    const { out: [FR, FG, FB] } = localMean([R, G, B], core, w, h, [2.5, 6]);
    const { out: [BR, BGc, BB], filled: bFilled } = localMean([R, G, B], coreBg, w, h, [6, 16]);
    return { FR, FG, FB, BR, BGc, BB, bFilled };
  };
  let sd = signedDist(fg);
  let refined = 0;

  // 3.5) 윤곽 다시 잡기: 흰 가운처럼 가장자리가 배경으로 6~10px에 걸쳐 완만하게 바래는 곳은 어떤 고정 문턱으로도 윤곽이
  //  흔들리고, 가운 밑 옅은 그림자까지 흰 띠·돌기로 남았다. 윤곽 안쪽 10px 이내에서 "주변 몸 색 F보다 배경색 B에 더 가까운"
  //  픽셀(α<0.5, 얼룩을 흐린 값으로 판정)을 배경 쪽에서부터 이어서 걷어 낸다. F와 B가 거의 같은 곳(|F−B|<12, 배경만큼 밝은
  //  소매 끝 등)은 가를 정보가 없으므로 건드리지 않는다. 몸 안쪽의 반짝임은 배경과 이어져 있지 않아 남는다.
  {
    const c1 = colorsFor(sd);
    const cand = (i) => {
      if (!fg[i] || sd[i] >= 10) return false;
      const br = c1.bFilled[i] ? c1.BR[i] : 253, bgc = c1.bFilled[i] ? c1.BGc[i] : 253, bb = c1.bFilled[i] ? c1.BB[i] : 253;
      const vr = c1.FR[i] - br, vg = c1.FG[i] - bgc, vb = c1.FB[i] - bb, L2 = vr * vr + vg * vg + vb * vb;
      if (L2 < 12 * 12) return false;
      return ((Rs[i] - br) * vr + (Gs[i] - bgc) * vg + (Bs[i] - bb) * vb) / L2 < 0.5;
    };
    const qq = new Int32Array(N);
    let h1 = 0, t1 = 0;
    const nb4 = (i) => { const x = i % w, y = (i / w) | 0; return [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]; };
    for (let i = 0; i < N; i++) if (!fg[i]) for (const j of nb4(i)) if (j >= 0 && cand(j)) { fg[j] = 0; qq[t1++] = j; }
    while (h1 < t1) { const i = qq[h1++]; for (const j of nb4(i)) if (j >= 0 && cand(j)) { fg[j] = 0; qq[t1++] = j; } }
    refined = t1;
    fg = smoothMask(fg, 1.2); // 판정 얼룩으로 생긴 1px 굴곡을 다시 편다
    // 걷어 낸 뒤 떨어져 남은 조각 지우기: 60px 미만은 무조건, 800px 미만이면서 거의 흰색(평균 밝기 232 이상·채도 18 이하)인
    // 것도(다리와 발 사이 흰 배경 속 JPEG 색 얼룩 덩어리). 비눗방울·색종이·물음표처럼 색이 있는 조각은 남는다.
    const seen = new Uint8Array(N);
    for (let s0 = 0; s0 < N; s0++) {
      if (!fg[s0] || seen[s0]) continue;
      const comp = [s0]; seen[s0] = 1;
      for (let t = 0; t < comp.length; t++) for (const j of nb4(comp[t])) if (j >= 0 && fg[j] && !seen[j]) { seen[j] = 1; comp.push(j); }
      let drop = comp.length < 60;
      if (!drop && comp.length < 800) {
        let sm = 0, ss = 0;
        for (const i of comp) { sm += mn(i); ss += sat(i); }
        drop = sm / comp.length >= 232 && ss / comp.length <= 18;
      }
      if (drop) for (const i of comp) fg[i] = 0;
    }
  }
  sd = signedDist(fg);
  const { FR, FG, FB, BR, BGc, BB, bFilled } = colorsFor(sd);

  const outBuf = Buffer.alloc(N * 4);
  let bandCount = 0, colorAlphaCount = 0;
  for (let i = 0; i < N; i++) {
    const d = sd[i];
    let r = R[i], g = G[i], b = B[i], a;
    if (d >= 4) a = 1;
    else if (d <= -3) a = 0;
    else {
      bandCount++;
      const br = bFilled[i] ? BR[i] : 253, bgc = bFilled[i] ? BGc[i] : 253, bb = bFilled[i] ? BB[i] : 253;
      const vr = FR[i] - br, vg = FG[i] - bgc, vb = FB[i] - bb;
      const L2 = vr * vr + vg * vg + vb * vb;
      const geo = Math.min(1, Math.max(0, 0.5 + d)); // 매끈한 윤곽 위 1px 부드러운 경계
      if (L2 >= 20 * 20) {
        // 색으로 α 계산(부엉이 색이 배경과 뚜렷이 다른 곳: 연보라 깃털·발·청록 소품, 그늘진 흰 가운 가장자리 등)
        colorAlphaCount++;
        const aCol = Math.min(1, Math.max(0, ((r - br) * vr + (g - bgc) * vg + (b - bb) * vb) / L2));
        const inner = Math.min(1, Math.max(0, (d - 1) / 2)); // 윤곽에서 1px 안쪽부터 3px까지 점점 불투명 보장
        a = Math.max(aCol, inner);
        if (d < 0) a = Math.min(a, geo); // 다듬은 윤곽 바깥으로는 번지지 않게
        // 색 오염 제거: 흰 배경을 걷어 낸 색 F'와 주변 부엉이 색 F를 "실제로 섞인 정도"(aCol)에 따라 섞는다.
        // (안쪽이라 α를 올려 준 픽셀도 색은 aCol 기준 → 흰 기가 섞인 픽셀은 부엉이 색으로 바뀐다)
        const ai = Math.max(aCol, 0.05);
        const pr = br + (r - br) / ai, pg = bgc + (g - bgc) / ai, pb = bb + (b - bb) / ai;
        const tt = Math.min(1, Math.max(0, (aCol - 0.35) / 0.55)), t2 = tt * tt * (3 - 2 * tt);
        r = FR[i] + (Math.min(255, Math.max(0, pr)) - FR[i]) * t2;
        g = FG[i] + (Math.min(255, Math.max(0, pg)) - FG[i]) * t2;
        b = FB[i] + (Math.min(255, Math.max(0, pb)) - FB[i]) * t2;
      } else {
        // 흰 가운·흰 털처럼 배경과 색이 거의 같은 곳: 매끈한 윤곽의 기하 α
        a = geo;
      }
    }
    outBuf[i * 4] = Math.round(r); outBuf[i * 4 + 1] = Math.round(g); outBuf[i * 4 + 2] = Math.round(b);
    outBuf[i * 4 + 3] = Math.round(a * 255);
  }

  // 6) 투명 여백 자르기(2px 여유) → 640px 상자 → WebP(알파 무손실)
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let i = 0; i < N; i++) if (outBuf[i * 4 + 3] > 0) { const x = i % w, y = (i / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(w - 1, x1 + 2); y1 = Math.min(h - 1, y1 + 2);
  const full = sharp(outBuf, { raw: { width: w, height: h, channels: 4 } }).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 });
  const cut = await full.png().toBuffer();
  await sharp(cut).resize({ width: 640, height: 640, fit: "inside", kernel: "lanczos3" })
    .webp({ quality: 90, alphaQuality: 100, effort: 6, smartSubsample: true }).toFile(dst);
  if (previewDst) await sharp(cut).png().toFile(previewDst); // 원본 해상도 확인용(저장소에 넣지 않음)
  const meta = await sharp(dst).metadata();
  const st = require("fs").statSync(dst);
  console.log(dst.split("/").pop(), `${meta.width}x${meta.height}`, `${Math.round(st.size / 1024)}KB`, `band=${bandCount}`, `colorAlpha=${colorAlphaCount}`, `refined=${refined}`, `crop=${x0},${y0}`, `feet=${feetTop}-${feetBot}/${feetL}-${feetR}`, `bandY=${bandY}`, `holes=[${holes}]`, `skipped=[${skipped}]`);
})().catch((e) => { console.error(e); process.exit(1); });
