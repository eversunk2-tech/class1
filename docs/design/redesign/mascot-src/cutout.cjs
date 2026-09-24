// 흰 배경 제거: 가장자리에서 이어진 "거의 흰색" 영역만 지운다(캐릭터 안쪽 흰 가운은 이어져 있지 않으면 남는다).
const sharp = require('/Users/sungchul/Desktop/classroom/node_modules/sharp');
const [,, src, dst, previewDst, T0 = '246'] = process.argv;
const T = Number(T0);
(async () => {
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const N = w * h;
  const near = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const r = data[i*3], g = data[i*3+1], b = data[i*3+2];
    // 거의 흰색 + 채도 낮음(연보라 깃털은 제외)
    const mn = Math.min(r,g,b), mx = Math.max(r,g,b);
    near[i] = (mn >= T && mx - mn <= 12) ? 1 : 0;
  }
  const bg = new Uint8Array(N);
  const q = new Int32Array(N); let qh = 0, qt = 0;
  const push = (i) => { if (near[i] && !bg[i]) { bg[i] = 1; q[qt++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h-1)*w + x); }
  for (let y = 0; y < h; y++) { push(y*w); push(y*w + w - 1); }
  while (qh < qt) {
    const i = q[qh++], x = i % w, y = (i / w) | 0;
    if (x > 0) push(i-1); if (x < w-1) push(i+1); if (y > 0) push(i-w); if (y < h-1) push(i+w);
  }
  // 발밑 그림자: 캐릭터 아래쪽 14% 띠에서만, 배경에 이어진 연회색(채도 낮음)도 배경으로 본다(발은 주황, 깃털은 연보라라 채도가 높다)
  let top = h, bot = -1;
  for (let i = 0; i < N; i++) if (!bg[i]) { const y = (i / w) | 0; if (y < top) top = y; if (y > bot) bot = y; }
  const band = top + Math.floor((bot - top) * (Number(process.env.BAND || 0.86)));
  const near2 = (i) => { const y = (i / w) | 0; if (y < band) return false; const r = data[i*3], g = data[i*3+1], b = data[i*3+2]; const mn = Math.min(r,g,b), mx = Math.max(r,g,b); return mn >= 150 && mx - mn <= 24; };
  qh = 0; qt = 0;
  for (let i = 0; i < N; i++) if (bg[i]) q[qt++] = i;
  while (qh < qt) {
    const i = q[qh++], x = i % w, y = (i / w) | 0;
    const nb = [x > 0 ? i-1 : -1, x < w-1 ? i+1 : -1, y > 0 ? i-w : -1, y < h-1 ? i+w : -1];
    for (const j of nb) if (j >= 0 && !bg[j] && near2(j)) { bg[j] = 1; q[qt++] = j; }
  }
  // 알파: 배경=0, 그 외=255, 경계 1~2px는 흰 정도에 따라 부드럽게
  const out = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    const r = data[i*3], g = data[i*3+1], b = data[i*3+2];
    let a = bg[i] ? 0 : 255;
    if (!bg[i]) {
      const x = i % w, y = (i / w) | 0;
      let touch = false;
      for (let dy = -2; dy <= 2 && !touch; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = x+dx, yy = y+dy; if (xx<0||yy<0||xx>=w||yy>=h) continue;
        if (bg[yy*w+xx]) { touch = true; break; }
      }
      if (touch) { const mn = Math.min(r,g,b); a = Math.max(0, Math.min(255, Math.round((250 - mn) / (250 - 205) * 255))); if (mn < 225) a = Math.max(a, 110); }
    }
    out[i*4] = r; out[i*4+1] = g; out[i*4+2] = b; out[i*4+3] = a;
  }
  const img = sharp(out, { raw: { width: w, height: h, channels: 4 } }).trim({ threshold: 1 });
  const trimmed = await img.png().toBuffer();
  await sharp(trimmed).resize({ width: 640, height: 640, fit: 'inside' }).webp({ quality: 86, alphaQuality: 90 }).toFile(dst);
  // 확인용: 보라 배경 위에 얹은 미리보기
  const meta = await sharp(trimmed).metadata();
  const comp = await sharp({ create: { width: meta.width + 80, height: meta.height + 80, channels: 4, background: process.env.BG || '#6d4fe0' } })
    .composite([{ input: trimmed, top: 40, left: 40 }]).png().toBuffer();
  await sharp(comp).resize({ width: 420 }).png().toFile(previewDst);
  const st = require('fs').statSync(dst);
  console.log(dst.split('/').pop(), meta.width + 'x' + meta.height, Math.round(st.size/1024) + 'KB');
})().catch(e => { console.error(e); process.exit(1); });
