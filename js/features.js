/* 정훈이와 찬양하라 — 확장 기능
 * 식단 기록 · 1RM 계산기 · 피로도/디로딩 · AI(자세 체크·음식 칼로리)
 * app.js 로직/헬퍼(state, saveState, est1RM, compressImage, weekVolume, allExercises,
 * findExercise, openModal/closeModal, toast, esc, animateCounts, todayStr, unit …)를 재사용한다.
 */

/* ========== 공통 유틸 ========== */
function blobToDataURL(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* ========== 식단 ========== */
const MEALS = [
  { id: 'breakfast', label: '아침', ic: '🌅' },
  { id: 'lunch',     label: '점심', ic: '☀️' },
  { id: 'dinner',    label: '저녁', ic: '🌙' },
  { id: 'snack',     label: '간식', ic: '🍎' },
];
let dietDate = null;   // 보고 있는 날짜 (null=오늘)
function dietDayStr() { return dietDate || todayStr(); }
function dietFor(ds) { return (state.diet && state.diet[ds]) || []; }
function dietTotals(ds) {
  return dietFor(ds).reduce((a, m) => ({
    kcal: a.kcal + (+m.kcal || 0), carb: a.carb + (+m.carb || 0),
    protein: a.protein + (+m.protein || 0), fat: a.fat + (+m.fat || 0),
  }), { kcal: 0, carb: 0, protein: 0, fat: 0 });
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('이미지 생성 실패')), 'image/png'));
}
function loadDietImage(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = src;
  });
}
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.lineTo(x + w - rr, y); ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr); ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr); ctx.quadraticCurveTo(x, y, x + rr, y); ctx.closePath(); return ctx;
}
function fitCanvasText(ctx, text, maxWidth) {
  const s = String(text || '음식');
  if (ctx.measureText(s).width <= maxWidth) return s;
  let out = s;
  while (out.length && ctx.measureText(out + '…').width > maxWidth) out = out.slice(0, -1);
  return out + '…';
}

async function shareDietCard() {
  const ds = dietDayStr(), items = dietFor(ds), t = dietTotals(ds);
  if (!items.length) { toast('먼저 식단을 하나 이상 기록해 주세요'); return; }
  const goal = state.dietGoal || { kcal: 2000, carb: 250, protein: 130, fat: 60 };
  const groups = MEALS.map(m => ({ ...m, items: items.filter(x => x.meal === m.id) })).filter(g => g.items.length);
  const W = 1080, pad = 70, headerH = 390, groupHead = 78, rowH = 122, groupGap = 28;
  const H = headerH + groups.reduce((n, g) => n + groupHead + g.items.length * rowH + groupGap, 0) + 100;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const photos = await Promise.all(items.map(x => loadDietImage(x.photo)));
  const photoById = new Map(items.map((x, i) => [x.id, photos[i]]));

  ctx.fillStyle = '#11151f'; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * .85, 0, 10, W * .85, 0, 520);
  glow.addColorStop(0, 'rgba(91,224,176,.24)'); glow.addColorStop(1, 'rgba(91,224,176,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, 620);
  ctx.fillStyle = '#5be0b0'; roundRect(ctx, pad, 62, 115, 42, 21).fill();
  ctx.fillStyle = '#10151d'; ctx.font = '800 22px -apple-system, BlinkMacSystemFont, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('MY DIET', pad + 57, 91);
  ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff'; ctx.font = '800 52px -apple-system, BlinkMacSystemFont, sans-serif';
  const d = new Date(ds); ctx.fillText(`${d.getMonth() + 1}월 ${d.getDate()}일 식단`, pad, 166);
  ctx.fillStyle = '#9aa5b5'; ctx.font = '600 25px -apple-system, BlinkMacSystemFont, sans-serif'; ctx.fillText('오늘 먹은 것을 한눈에 기록했어요', pad, 208);
  ctx.fillStyle = '#202735'; roundRect(ctx, pad, 238, W - pad * 2, 112, 28).fill();
  ctx.fillStyle = '#ffffff'; ctx.font = '800 46px -apple-system, BlinkMacSystemFont, sans-serif'; ctx.fillText(`${Math.round(t.kcal).toLocaleString()} kcal`, pad + 32, 306);
  ctx.fillStyle = '#8490a1'; ctx.font = '600 22px -apple-system, BlinkMacSystemFont, sans-serif'; ctx.fillText(`/ ${goal.kcal.toLocaleString()} 목표`, pad + 292, 304);
  const macros = [['탄수', t.carb, '#f6a94a'], ['단백', t.protein, '#5bc8ff'], ['지방', t.fat, '#ff7a9c']];
  macros.forEach((m, i) => { const x = 590 + i * 142; ctx.fillStyle = m[2]; ctx.font = '800 22px -apple-system, BlinkMacSystemFont, sans-serif'; ctx.fillText(`${m[0]} ${Math.round(m[1])}g`, x, 303); });

  let y = 390;
  for (const g of groups) {
    const subtotal = g.items.reduce((n, x) => n + (+x.kcal || 0), 0);
    ctx.fillStyle = '#1a202c'; roundRect(ctx, pad, y, W - pad * 2, groupHead + g.items.length * rowH, 30).fill();
    ctx.fillStyle = '#ffffff'; ctx.font = '800 30px -apple-system, BlinkMacSystemFont, sans-serif'; ctx.fillText(`${g.ic}  ${g.label}`, pad + 30, y + 50);
    ctx.textAlign = 'right'; ctx.fillStyle = '#5be0b0'; ctx.font = '800 24px -apple-system, BlinkMacSystemFont, sans-serif'; ctx.fillText(`${subtotal} kcal`, W - pad - 30, y + 49); ctx.textAlign = 'left';
    y += groupHead;
    for (const item of g.items) {
      ctx.strokeStyle = '#2b3341'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pad + 28, y); ctx.lineTo(W - pad - 28, y); ctx.stroke();
      const img = photoById.get(item.id), ix = pad + 28, iy = y + 16, size = 90;
      ctx.save(); roundRect(ctx, ix, iy, size, size, 20).clip();
      if (img) { const scale = Math.max(size / img.width, size / img.height), sw = size / scale, sh = size / scale; ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, ix, iy, size, size); }
      else { ctx.fillStyle = '#293140'; ctx.fillRect(ix, iy, size, size); ctx.font = '40px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(g.ic, ix + size / 2, iy + 59); ctx.textAlign = 'left'; }
      ctx.restore();
      ctx.fillStyle = '#ffffff'; ctx.font = '800 28px -apple-system, BlinkMacSystemFont, sans-serif'; ctx.fillText(fitCanvasText(ctx, item.name, 500), ix + 116, y + 49);
      ctx.fillStyle = '#8994a5'; ctx.font = '600 21px -apple-system, BlinkMacSystemFont, sans-serif'; ctx.fillText(`탄 ${Math.round(item.carb || 0)}g  ·  단 ${Math.round(item.protein || 0)}g  ·  지 ${Math.round(item.fat || 0)}g`, ix + 116, y + 82);
      ctx.textAlign = 'right'; ctx.fillStyle = '#ffffff'; ctx.font = '800 27px -apple-system, BlinkMacSystemFont, sans-serif'; ctx.fillText(`${item.kcal || 0} kcal`, W - pad - 30, y + 65); ctx.textAlign = 'left';
      y += rowH;
    }
    y += groupGap;
  }
  ctx.fillStyle = '#687486'; ctx.font = '600 21px -apple-system, BlinkMacSystemFont, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('정훈이와 찬양하라 · 식단 기록', W / 2, H - 44);

  let blob, file;
  try { blob = await canvasBlob(canvas); file = new File([blob], `diet-${ds}.png`, { type: 'image/png' }); }
  catch { toast('이미지를 만들지 못했어요. 다시 시도해 주세요'); return; }
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ title: `${ds} 식단`, text: `${Math.round(t.kcal)} kcal 식단 기록`, files: [file] }); return; }
    catch (e) { if (e?.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('식단 이미지를 저장했어요 📸');
}

function renderDiet() {
  const el = document.querySelector('#panel-diet');
  const ds = dietDayStr();
  const isToday = ds === todayStr();
  const items = dietFor(ds);
  const t = dietTotals(ds);
  const goal = state.dietGoal || { kcal: 2000, carb: 250, protein: 130, fat: 60 };
  const d = new Date(ds); const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  const dateLabel = `${d.getMonth() + 1}월 ${d.getDate()}일 (${wd})${isToday ? ' · 오늘' : ''}`;

  // 칼로리 링
  const pct = clamp(goal.kcal ? t.kcal / goal.kcal : 0, 0, 1);
  const R = 46, C = 2 * Math.PI * R;
  const over = t.kcal > goal.kcal;
  const ring = `<div class="kcal-ring">
    <svg viewBox="0 0 108 108">
      <circle cx="54" cy="54" r="${R}" fill="none" stroke="var(--bg2)" stroke-width="11"/>
      <circle class="kr-fg" cx="54" cy="54" r="${R}" fill="none" stroke="${over ? 'var(--accent2)' : 'var(--green)'}" stroke-width="11"
        stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-off="${C * (1 - pct)}" transform="rotate(-90 54 54)"/>
    </svg>
    <div class="kr-txt"><b data-count="${t.kcal}">0</b><small>/ ${goal.kcal} kcal</small></div>
  </div>`;

  const macro = (label, val, g, color) => {
    const p = clamp(g ? val / g : 0, 0, 1);
    return `<div class="macro">
      <div class="macro-top"><span>${label}</span><b>${Math.round(val)}<small>/${g}g</small></b></div>
      <div class="macro-track"><div class="macro-fill" data-w="${(p * 100).toFixed(0)}%" style="width:0;background:${color}"></div></div>
    </div>`;
  };

  const groups = MEALS.map(mk => {
    const list = items.filter(x => x.meal === mk.id);
    const sub = list.reduce((a, x) => a + (+x.kcal || 0), 0);
    const rows = list.map(x => `
      <div class="meal-row" data-edit="${x.id}">
        ${x.photo ? `<img class="meal-thumb" src="${x.photo}" alt="">` : `<span class="meal-ic">${mk.ic}</span>`}
        <div class="meal-info"><b>${esc(x.name)}</b><small>${x.kcal || 0}kcal · 탄${Math.round(x.carb || 0)} 단${Math.round(x.protein || 0)} 지${Math.round(x.fat || 0)}</small></div>
        <button class="meal-del" data-del="${x.id}" aria-label="삭제">✕</button>
      </div>`).join('');
    return `<div class="meal-group">
      <div class="mg-head"><span>${mk.ic} ${mk.label}</span><b>${sub ? sub + ' kcal' : ''}</b></div>
      ${rows || '<p class="mg-empty">아직 없어요</p>'}
      <div class="mg-add"><button class="mg-add-btn" data-add="${mk.id}">＋ 직접 추가</button><button class="mg-cam-btn" data-cam="${mk.id}">📷 사진으로 칼로리</button></div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <header class="tab-head"><div class="th-left"><span class="kicker">Diet</span><h2>식단</h2></div>
      <div class="diet-head-actions"><button id="diet-ai" class="pill-btn">🤖 피드백</button><button id="diet-share" class="pill-btn ghost">📸 저장</button><button id="diet-goal" class="pill-btn ghost">🎯 목표</button></div></header>
    <div class="diet-datenav">
      <button id="diet-prev">‹</button><b>${dateLabel}</b>
      <button id="diet-next" ${isToday ? 'disabled' : ''}>›</button>
    </div>
    <div class="kcal-card">
      ${ring}
      <div class="macros">
        ${macro('탄수', t.carb, goal.carb, '#F6A94A')}
        ${macro('단백', t.protein, goal.protein, '#5BC8FF')}
        ${macro('지방', t.fat, goal.fat, '#FF7A9C')}
      </div>
    </div>
    <input id="me-file" type="file" accept="image/*" hidden>
    ${groups}
    <p class="hint" style="margin-top:14px">📷 <b>사진으로 칼로리</b>는 AI가 음식 사진을 보고 칼로리·영양을 추정해요. <b>새로 촬영</b>하거나 <b>앨범의 기존 사진</b>을 골라도 됩니다. ${aiReady() ? '' : '<b>AI 설정 전에는</b> 직접 추가로 기록하세요.'}</p>`;

  animateCounts(el); animateFills(el);
  el.querySelector('#diet-share').addEventListener('click', shareDietCard);
  el.querySelector('#diet-ai').addEventListener('click', aiDietFeedback);
  el.querySelector('#diet-goal').addEventListener('click', openDietGoal);
  el.querySelector('#diet-prev').addEventListener('click', () => { const x = new Date(ds); x.setDate(x.getDate() - 1); dietDate = todayStr(x); renderDiet(); });
  el.querySelector('#diet-next').addEventListener('click', () => { if (isToday) return; const x = new Date(ds); x.setDate(x.getDate() + 1); dietDate = todayStr(x); renderDiet(); });
  el.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => openMealEdit(b.dataset.add)));
  el.querySelectorAll('[data-cam]').forEach(b => b.addEventListener('click', () => aiFoodCapture(b.dataset.cam)));
  el.querySelectorAll('[data-edit]').forEach(r => r.addEventListener('click', e => { if (e.target.closest('[data-del]')) return; openMealEdit(null, r.dataset.edit); }));
  el.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); delMeal(b.dataset.del); }));
}

function openMealEdit(meal, editId, prefill) {
  const ds = dietDayStr();
  const existing = editId ? dietFor(ds).find(x => x.id === editId) : null;
  const base = existing || prefill || { meal: meal || 'breakfast', name: '', kcal: '', carb: '', protein: '', fat: '', photo: null };
  const vals = { meal: base.meal || 'breakfast', name: base.name || '', kcal: base.kcal ?? '', carb: base.carb ?? '', protein: base.protein ?? '', fat: base.fat ?? '' };
  let photo = base.photo || null, aiBusy = false;
  const m = document.querySelector('#meal-edit');
  m.querySelector('.modal-head h3').textContent = existing ? '음식 편집' : '음식 추가';

  const read = () => {   // 현재 입력값 보존 (재렌더 전 호출)
    if (!m.querySelector('#me-name')) return;
    vals.name = m.querySelector('#me-name').value; vals.meal = m.querySelector('#me-meal').value;
    vals.kcal = m.querySelector('#me-kcal').value; vals.carb = m.querySelector('#me-carb').value;
    vals.protein = m.querySelector('#me-protein').value; vals.fat = m.querySelector('#me-fat').value;
  };
  const draw = () => {
    m.querySelector('#me-body').innerHTML = `
      <div class="me-photo-box">
        ${photo
          ? `<div class="me-photo"><img src="${photo}" alt=""><button type="button" id="me-delphoto">✕ 사진 삭제</button></div>
             ${aiReady() ? `<button type="button" id="me-aiphoto" class="me-ai-btn" ${aiBusy ? 'disabled' : ''}>${aiBusy ? 'AI 분석 중…' : '🤖 이 사진으로 칼로리 자동 채우기'}</button>` : ''}`
          : `<button type="button" id="me-addphoto" class="me-photo-add">🖼️ 사진 첨부 <small>(앨범·촬영 모두 가능, 선택)</small></button>`}
        <input id="me-photofile" type="file" accept="image/*" hidden>
      </div>
      <label>음식 이름<input id="me-name" value="${esc(vals.name)}" placeholder="예: 닭가슴살 100g" maxlength="40"></label>
      <div class="me-grid">
        <label>끼니<select id="me-meal">${MEALS.map(x => `<option value="${x.id}" ${vals.meal === x.id ? 'selected' : ''}>${x.ic} ${x.label}</option>`).join('')}</select></label>
        <label>칼로리(kcal)<input id="me-kcal" type="number" inputmode="numeric" value="${vals.kcal ?? ''}" placeholder="0"></label>
      </div>
      <div class="me-grid3">
        <label>탄수(g)<input id="me-carb" type="number" inputmode="decimal" value="${vals.carb ?? ''}" placeholder="0"></label>
        <label>단백(g)<input id="me-protein" type="number" inputmode="decimal" value="${vals.protein ?? ''}" placeholder="0"></label>
        <label>지방(g)<input id="me-fat" type="number" inputmode="decimal" value="${vals.fat ?? ''}" placeholder="0"></label>
      </div>
      <button id="me-save" class="big-btn">${existing ? '저장' : '추가'}</button>
      ${existing ? '<button id="me-remove" class="text-btn danger">삭제</button>' : ''}`;
    m.querySelector('#me-addphoto')?.addEventListener('click', () => m.querySelector('#me-photofile').click());
    m.querySelector('#me-delphoto')?.addEventListener('click', () => { read(); photo = null; draw(); });
    m.querySelector('#me-photofile').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      read();
      try { const blob = await compressImage(f); photo = await blobToDataURL(blob); } catch { toast('사진을 불러오지 못했어요'); }
      draw();
    });
    m.querySelector('#me-aiphoto')?.addEventListener('click', runAI);
    m.querySelector('#me-save').addEventListener('click', save);
    m.querySelector('#me-remove')?.addEventListener('click', () => { delMeal(existing.id); closeModal('#meal-edit'); });
  };
  const runAI = async () => {
    if (aiBusy || !photo) return;
    read(); aiBusy = true; draw();
    try {
      const r = await aiCall({ mode: 'food', image: photo });
      vals.name = r.name || vals.name || '음식';
      if (r.kcal != null) vals.kcal = r.kcal; if (r.carb != null) vals.carb = r.carb;
      if (r.protein != null) vals.protein = r.protein; if (r.fat != null) vals.fat = r.fat;
      toast('AI 추정 완료! 값을 확인·수정하세요');
    } catch (e) { toast(aiErrMsg(e)); }
    aiBusy = false; draw();
  };
  const save = () => {
    read();
    const item = {
      id: existing ? existing.id : uid(),
      meal: vals.meal, name: (vals.name || '').trim() || '음식',
      kcal: parseInt(vals.kcal) || 0, carb: parseFloat(vals.carb) || 0,
      protein: parseFloat(vals.protein) || 0, fat: parseFloat(vals.fat) || 0,
      photo: photo || null,
    };
    if (!state.diet) state.diet = {};
    if (!state.diet[ds]) state.diet[ds] = [];
    if (existing) { const i = state.diet[ds].findIndex(x => x.id === existing.id); state.diet[ds][i] = item; }
    else state.diet[ds].push(item);
    saveState(); closeModal('#meal-edit'); renderDiet(); toast(existing ? '저장했어요' : '추가했어요 🍱');
  };
  draw(); openModal('#meal-edit');
}
function delMeal(id) {
  const ds = dietDayStr();
  if (!state.diet || !state.diet[ds]) return;
  state.diet[ds] = state.diet[ds].filter(x => x.id !== id);
  if (!state.diet[ds].length) delete state.diet[ds];
  saveState(); renderDiet();
}
function openDietGoal() {
  const g = state.dietGoal || { kcal: 2000, carb: 250, protein: 130, fat: 60 };
  const m = document.querySelector('#meal-edit');
  m.querySelector('.modal-head h3').textContent = '🎯 하루 목표';
  m.querySelector('#me-body').innerHTML = `
    <label>칼로리(kcal)<input id="g-kcal" type="number" inputmode="numeric" value="${g.kcal}"></label>
    <div class="me-grid3">
      <label>탄수(g)<input id="g-carb" type="number" value="${g.carb}"></label>
      <label>단백(g)<input id="g-protein" type="number" value="${g.protein}"></label>
      <label>지방(g)<input id="g-fat" type="number" value="${g.fat}"></label>
    </div>
    <p class="hint">체중 1kg당 단백 1.6~2.2g이 근성장에 권장돼요.</p>
    <button id="g-save" class="big-btn">저장</button>`;
  m.querySelector('#g-save').addEventListener('click', () => {
    state.dietGoal = {
      kcal: parseInt(m.querySelector('#g-kcal').value) || 2000,
      carb: parseInt(m.querySelector('#g-carb').value) || 0,
      protein: parseInt(m.querySelector('#g-protein').value) || 0,
      fat: parseInt(m.querySelector('#g-fat').value) || 0,
    };
    saveState(); closeModal('#meal-edit'); renderDiet(); toast('목표를 저장했어요 🎯');
  });
  openModal('#meal-edit');
}

/* ========== 1RM 계산기 ========== */
/* 여러 공식 평균으로 안정적 추정 */
function calc1RM(w, r) {
  if (!w || !r) return 0;
  if (r === 1) return w;
  const epley = w * (1 + r / 30);
  const brzycki = w * 36 / (37 - r);        // r<37
  const lombardi = w * Math.pow(r, 0.10);
  const vals = [epley, brzycki, lombardi].filter(v => isFinite(v) && v > 0);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
const ORM_PCTS = [
  [100, 1], [95, 2], [90, 4], [85, 6], [80, 8], [75, 10], [70, 12], [65, 15], [60, 20],
];
function open1RM(prefillW, prefillR) {
  const m = document.querySelector('#orm-calc');
  const draw = (w, r) => {
    const orm = calc1RM(w, r);
    const rows = orm ? ORM_PCTS.map(([p, reps]) => `
      <tr><td>${p}%</td><td><b>${(orm * p / 100).toFixed(1)}</b> ${unit()}</td><td>${reps}회</td></tr>`).join('') : '';
    m.querySelector('#orm-body').innerHTML = `
      <div class="me-grid">
        <label>무게(${unit()})<input id="orm-w" type="number" inputmode="decimal" value="${w || ''}" placeholder="예: 80"></label>
        <label>반복 횟수<input id="orm-r" type="number" inputmode="numeric" value="${r || ''}" placeholder="예: 5"></label>
      </div>
      ${orm ? `<div class="orm-result"><span>추정 1RM</span><b>${orm.toFixed(1)}<small>${unit()}</small></b></div>
      <p class="hint" style="text-align:center;margin-top:-4px">Epley·Brzycki·Lombardi 평균</p>
      <table class="orm-table"><thead><tr><th>%1RM</th><th>무게</th><th>목표 반복</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<p class="hint">무게와 반복 횟수를 넣으면 1RM과 %별 목표 무게가 나와요.</p>'}`;
    const wi = m.querySelector('#orm-w'), ri = m.querySelector('#orm-r');
    const upd = () => draw(parseFloat(wi.value) || 0, parseInt(ri.value) || 0);
    wi.addEventListener('input', upd); ri.addEventListener('input', upd);
  };
  draw(prefillW || 0, prefillR || 0);
  openModal('#orm-calc');
}

/* ========== 피로도 / 디로딩 ========== */
function logFatigue(v) {
  const ds = todayStr();
  if (!state.fatigue) state.fatigue = {};
  if (state.fatigue[ds] === v) delete state.fatigue[ds]; else state.fatigue[ds] = v;
  saveState(); renderStats();
}
/* n주 전(0=이번주) 주간 볼륨 */
function weekVolumeOffset(n) {
  const ws = weekStart(new Date()); ws.setDate(ws.getDate() - 7 * n);
  const we = new Date(ws); we.setDate(we.getDate() + 7);
  return state.sessions.filter(s => { const d = new Date(s.date); return d >= ws && d < we; })
    .reduce((a, s) => a + s.entries.reduce((b, e) => b + entryVolume(e), 0), 0);
}
function weekSessionsOffset(n) {
  const ws = weekStart(new Date()); ws.setDate(ws.getDate() - 7 * n);
  const we = new Date(ws); we.setDate(we.getDate() + 7);
  return state.sessions.filter(s => { const d = new Date(s.date); return d >= ws && d < we; }).length;
}
function recentFatigueAvg(days) {
  const f = state.fatigue || {}; const out = [];
  for (let i = 0; i < (days || 7); i++) { const d = new Date(); d.setDate(d.getDate() - i); const v = f[todayStr(d)]; if (v) out.push(v); }
  return out.length ? { avg: out.reduce((a, b) => a + b, 0) / out.length, n: out.length } : null;
}
/* 디로딩 판단 — 연속 훈련주·볼륨추세·피로도 종합 */
function deloadAssess() {
  const reasons = []; let score = 0;
  // 연속 훈련 주(주 2회 이상) 수
  let streakWk = 0; for (let n = 0; n < 12; n++) { if (weekSessionsOffset(n) >= 2) streakWk++; else break; }
  if (streakWk >= 6) { score += 2; reasons.push(`쉬는 주 없이 <b>${streakWk}주 연속</b> 훈련 중`); }
  else if (streakWk >= 4) { score += 1; reasons.push(`<b>${streakWk}주 연속</b> 훈련 중`); }
  // 볼륨 추세: 이번주 vs 지난주 (수행 저하 = 피로 신호)
  const v0 = weekVolumeOffset(0), v1 = weekVolumeOffset(1), v2 = weekVolumeOffset(2);
  if (v1 > 0 && v0 > 0 && v0 < v1 * 0.9 && weekSessionsOffset(0) >= weekSessionsOffset(1)) {
    score += 1; reasons.push(`같은 빈도인데 볼륨이 지난주보다 <b>${Math.round((1 - v0 / v1) * 100)}% 감소</b> (수행 저하)`);
  }
  if (v2 > 0 && v1 > v2 * 1.1 && v0 > v1 * 1.1) { score += 1; reasons.push('3주 연속 볼륨 급증 (과부하 누적)'); }
  // 주관적 피로도
  const fa = recentFatigueAvg(7);
  if (fa && fa.n >= 2) {
    if (fa.avg >= 4) { score += 2; reasons.push(`최근 피로도 평균 <b>${fa.avg.toFixed(1)}/5</b> (높음)`); }
    else if (fa.avg >= 3.2) { score += 1; reasons.push(`최근 피로도 평균 <b>${fa.avg.toFixed(1)}/5</b>`); }
  }
  // 연속일 (무휴식)
  const st = calcStreak();
  if (st >= 10) { score += 1; reasons.push(`<b>${st}일</b> 연속 무휴식`); }

  let level = 'ok';
  if (score >= 3) level = 'deload'; else if (score >= 2) level = 'caution';
  return { level, score, reasons, streakWk, fatigue: fa };
}
function deloadCard() {
  const a = deloadAssess();
  const meta = {
    ok:      { emoji: '🟢', title: '컨디션 양호', color: 'var(--green)', tip: '지금 페이스를 유지하며 점진적으로 볼륨을 올려도 좋아요.' },
    caution: { emoji: '🟡', title: '피로 누적 주의', color: '#F6A94A', tip: '한 주 더 지켜보되, 잘 안 오르면 다음 주 디로딩을 고려하세요.' },
    deload:  { emoji: '🔴', title: '디로딩 추천', color: 'var(--accent2)', tip: '이번 주는 <b>볼륨을 40~50% 줄이고</b>(세트 수↓, 무게는 70~80% 유지) 수면·영양·휴식을 늘리세요. 다음 주 더 강하게 복귀합니다.' },
  }[a.level];
  const today = state.fatigue && state.fatigue[todayStr()];
  const faces = [[1, '쌩쌩'], [2, '좋음'], [3, '보통'], [4, '피곤'], [5, '지침']];
  return `<div class="deload-card ${a.level}">
    <div class="dl-head"><span class="dl-emoji">${meta.emoji}</span>
      <div><b>${meta.title}</b><small>디로딩 신호 ${a.score}점</small></div></div>
    ${a.reasons.length ? `<ul class="dl-reasons">${a.reasons.map(r => `<li>${r}</li>`).join('')}</ul>` : '<p class="dl-none">아직 뚜렷한 피로 신호가 없어요. 기록이 쌓일수록 정확해져요.</p>'}
    <p class="dl-tip">${meta.tip}</p>
    <div class="dl-fatigue">
      <span>오늘 컨디션</span>
      <div class="fat-btns">${faces.map(([v, l]) => `<button class="fat-btn ${today === v ? 'on' : ''}" data-fat="${v}"><b>${v}</b><small>${l}</small></button>`).join('')}</div>
    </div>
  </div>`;
}

/* ========== AI (Edge Function 프록시) ========== */
function aiEndpoint() {
  if (typeof SUPABASE_CONFIG === 'undefined' || !SUPABASE_CONFIG.url) return null;
  return `${SUPABASE_CONFIG.url}/functions/v1/coach-ai`;
}
function aiReady() { return !!aiEndpoint(); }   // 구조상 준비. 실제 배포 여부는 호출 시 확인
async function aiCall(payload) {
  const ep = aiEndpoint();
  if (!ep) throw new Error('no-endpoint');
  const res = await fetch(ep, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_CONFIG.anonKey, Authorization: `Bearer ${SUPABASE_CONFIG.anonKey}` },
    body: JSON.stringify(payload),
  });
  if (res.status === 404) throw new Error('not-deployed');
  const data = await res.json().catch(() => ({ error: 'ai-' + res.status }));
  if (!res.ok || data.error) throw new Error(data.error || 'ai-' + res.status);
  return data;
}

/* --- 음식 사진 → 칼로리 --- */
async function aiFoodCapture(meal) {
  const file = document.querySelector('#me-file');
  file.onchange = async e => {
    const f = e.target.files[0]; file.value = ''; if (!f) return;
    let photo = null;
    try { const blob = await compressImage(f); photo = await blobToDataURL(blob);
      toast('AI가 음식을 분석 중… 🍽️');
      const r = await aiCall({ mode: 'food', image: photo });
      openMealEdit(meal, null, { meal, name: r.name || '음식', kcal: r.kcal || 0, carb: r.carb || 0, protein: r.protein || 0, fat: r.fat || 0, photo });
      toast('AI 추정 완료! 값을 확인·수정하세요');
    } catch (err) {
      // 실패 → 사진만 넣고 수동 입력
      openMealEdit(meal, null, { meal, name: '', kcal: '', carb: '', protein: '', fat: '', photo });
      toast(aiErrMsg(err));
    }
  };
  file.click();
}

/* --- 운동 사진 → 자세 체크 --- */
function aiFormCheck(prefillExId) {
  const m = document.querySelector('#ai-form');
  const exs = allExercises().filter(e => e.type === 'wr');
  let exId = prefillExId || (exs[0] && exs[0].id) || '';
  let photo = null, busy = false, result = null;
  const draw = () => {
    m.querySelector('#af-body').innerHTML = `
      <label>운동 선택<select id="af-ex">${exs.map(e => `<option value="${e.id}" ${e.id === exId ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>
      <div class="af-photo">
        ${photo ? `<img src="${photo}" alt="">` : `<button id="af-pick" type="button" class="qd-photobtn">📷 자세 사진 올리기 <small>(촬영·앨범, 측면 권장)</small></button>`}
        <input id="af-file" type="file" accept="image/*" hidden>
      </div>
      ${photo ? `<button id="af-run" class="big-btn" ${busy ? 'disabled' : ''}>${busy ? 'AI 분석 중…' : '🤖 자세 분석하기'}</button>
        <button id="af-reset" class="text-btn">다른 사진</button>` : ''}
      ${result ? afResultHTML(result) : ''}
      ${!aiReady() ? '<p class="hint">AI 설정(Edge Function)이 필요해요. 설정 후 사용 가능합니다.</p>' : ''}`;
    m.querySelector('#af-ex').addEventListener('change', e => { exId = e.target.value; });
    m.querySelector('#af-pick')?.addEventListener('click', () => m.querySelector('#af-file').click());
    m.querySelector('#af-file')?.addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      const blob = await compressImage(f); photo = await blobToDataURL(blob); result = null; draw();
    });
    m.querySelector('#af-reset')?.addEventListener('click', () => { photo = null; result = null; draw(); });
    m.querySelector('#af-run')?.addEventListener('click', runAF);
  };
  const runAF = async () => {
    if (busy || !photo) return; busy = true; draw();
    try {
      const exName = (findExercise(exId) || {}).name || '';
      result = await aiCall({ mode: 'form', exercise: exName, image: photo });
    } catch (err) { toast(aiErrMsg(err)); }
    busy = false; draw();
  };
  draw(); openModal('#ai-form');
}
function afResultHTML(r) {
  const score = clamp(+r.score || 0, 0, 100);
  const col = score >= 80 ? 'var(--green)' : score >= 60 ? '#F6A94A' : 'var(--accent2)';
  const list = (title, arr, cls) => (arr && arr.length) ? `<div class="af-sec ${cls}"><h4>${title}</h4><ul>${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
  return `<div class="af-result">
    <div class="af-score"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" fill="none" stroke="var(--bg2)" stroke-width="7"/>
      <circle cx="40" cy="40" r="34" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round"
        stroke-dasharray="${2 * Math.PI * 34}" stroke-dashoffset="${2 * Math.PI * 34 * (1 - score / 100)}" transform="rotate(-90 40 40)"/></svg>
      <b>${score}</b></div>
    ${r.summary ? `<p class="af-summary">${esc(r.summary)}</p>` : ''}
    ${list('👍 잘하고 있어요', r.good, 'good')}
    ${list('🔧 개선하면 좋아요', r.improve, 'improve')}
    ${list('🎯 큐', r.cues, 'cues')}
    ${r.safety ? `<p class="af-safety">⚠️ ${esc(r.safety)}</p>` : ''}
    <p class="hint">AI 참고용 피드백이에요. 통증·부상 위험이 있으면 전문가에게 확인하세요.</p>`;
}
function aiErrMsg(err) {
  const c = String(err && err.message || err);
  if (c.includes('low-credit')) return 'AI 크레딧이 부족해요. 직접 입력해 주세요. (관리자: Anthropic 크레딧 충전 필요)';
  if (c.includes('not-deployed') || c.includes('no-endpoint')) return 'AI 기능이 아직 설정되지 않았어요. 직접 입력해 주세요.';
  if (c.includes('ai-4')) return 'AI 요청이 거부됐어요(키·권한 확인). 직접 입력해 주세요.';
  return 'AI 분석에 실패했어요. 직접 입력해 주세요.';
}

/* ========== 공유 카드 (canvas 이미지) ========== */
/* 공통: 다크 배경 카드 캔버스 생성 */
function makeShareCanvas(W, H) {
  const dpr = 2;
  const cv = document.createElement('canvas'); cv.width = W * dpr; cv.height = H * dpr;
  const x = cv.getContext('2d'); x.scale(dpr, dpr);
  const rr = (a, b, c, d, r) => { x.beginPath(); if (x.roundRect) x.roundRect(a, b, c, d, r); else x.rect(a, b, c, d); };
  const DISP = w => `${w}px "Do Hyeon", Pretendard, sans-serif`;
  rr(0, 0, W, H, 22); x.fillStyle = '#1E2330'; x.fill();
  x.lineWidth = 1; x.strokeStyle = 'rgba(255,255,255,0.08)'; rr(0.5, 0.5, W - 1, H - 1, 22); x.stroke();
  x.textBaseline = 'alphabetic';
  return { cv, x, rr, DISP, W, H };
}
function watermark(x, W, H) {
  x.textAlign = 'right'; x.fillStyle = '#5E6675'; x.font = '700 12px Pretendard, sans-serif';
  x.fillText('💪 ' + BRAND.name, W - 34, H - 20); x.textAlign = 'left';
}
function finishShareCard(cv, filename, title) {
  cv.toBlob(async blob => {
    if (!blob) { alert('이미지 생성에 실패했어요.'); return; }
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title }); return; } catch {}
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
    toast('이미지를 저장했어요!');
  }, 'image/png');
}

/* 이번 주(월~일) 식단 평균 칼로리 — 기록된 날 기준 */
function weekDietAvg() {
  const ws = weekStart(new Date());
  let sum = 0, days = 0;
  for (let i = 0; i < 7; i++) { const d = new Date(ws); d.setDate(d.getDate() + i); const t = dietTotals(todayStr(d)); if (t.kcal > 0) { sum += t.kcal; days++; } }
  return days ? Math.round(sum / days) : 0;
}

/* 2) 주간 종합 카드 */
function shareWeekCard() {
  const nick = state.profile.nick || '나';
  const goal = state.settings.weeklyGoal || 3;
  const avg = weekDietAvg();
  const { cv, x, rr, DISP, W, H } = makeShareCanvas(640, 452);

  x.fillStyle = '#FF7A59'; x.font = '700 14px Pretendard, sans-serif'; x.fillText('주간 리포트', 34, 54);
  x.fillStyle = '#fff'; x.font = DISP(34); x.fillText('이번 주 요약', 34, 94);
  x.fillStyle = '#9AA3B2'; x.font = '600 14px Pretendard, sans-serif'; x.fillText(`${nick} · 이번 주`, 34, 120);

  const cells = [
    ['운동', `${weekCount()}/${goal}회`, '🏋️'],
    ['볼륨', `${fmt(weekVolume())}${unit()}`, '💪'],
    ['연속', `${calcStreak()}일`, '🔥'],
    ['평균 칼로리', avg ? `${avg}` : '–', '🍱'],
  ];
  const gap = 12, cw = (W - 68 - gap) / 2, ch = 122, gy = 150;
  cells.forEach((c, i) => {
    const col = i % 2, row = (i / 2) | 0;
    const cx = 34 + col * (cw + gap), cy = gy + row * (ch + gap);
    rr(cx, cy, cw, ch, 16); x.fillStyle = '#2A303E'; x.fill();
    x.textAlign = 'center';
    x.fillStyle = '#9AA3B2'; x.font = '600 15px Pretendard, sans-serif'; x.fillText(`${c[2]} ${c[0]}`, cx + cw / 2, cy + 38);
    x.fillStyle = '#fff'; x.font = DISP(36); x.fillText(c[1], cx + cw / 2, cy + 88);
    x.textAlign = 'left';
  });

  watermark(x, W, H);
  finishShareCard(cv, `${BRAND.en || 'week'}-주간-${todayStr()}.png`, '이번 주 요약');
}

/* 3) 개인기록(PR) 카드 — exId 없으면 최고 1RM 종목 */
function sharePRCard(exId) {
  const list = allExercises().filter(e => e.type === 'wr')
    .map(e => ({ e, pr: exercisePR(e.id) })).filter(o => o.pr.best1RM > 0)
    .sort((a, b) => b.pr.best1RM - a.pr.best1RM);
  if (!list.length) { toast('아직 기록된 PR이 없어요'); return; }
  const item = exId ? list.find(o => o.e.id === exId) : list[0];
  if (!item) { toast('기록을 찾을 수 없어요'); return; }
  const { e, pr } = item, u = unit(), nick = state.profile.nick || '나';
  const { cv, x, rr, DISP, W, H } = makeShareCanvas(640, 404);

  x.fillStyle = '#FF7A59'; x.font = '700 14px Pretendard, sans-serif'; x.fillText('개인 기록 (PR) 🏆', 34, 54);
  x.fillStyle = '#fff'; x.font = DISP(38); x.fillText(e.name, 34, 102);
  x.fillStyle = '#9AA3B2'; x.font = '600 14px Pretendard, sans-serif'; x.fillText(`${nick} · ${todayStr()}`, 34, 130);

  // 1RM 대형 (숫자+단위 가운데 정렬)
  x.textAlign = 'center'; x.fillStyle = '#9AA3B2'; x.font = '700 15px Pretendard, sans-serif';
  x.fillText('추정 1RM', W / 2, 186); x.textAlign = 'left';
  const numStr = String(pr.best1RM);
  x.font = DISP(80); const nw = x.measureText(numStr).width;
  x.font = DISP(30); const uw = x.measureText(u).width;
  const startX = (W - (nw + 10 + uw)) / 2;
  x.fillStyle = '#5BE0B0'; x.font = DISP(80); x.fillText(numStr, startX, 262);
  x.fillStyle = '#9AA3B2'; x.font = DISP(30); x.fillText(u, startX + nw + 10, 262);

  // 서브 셀
  const cells = [['최고 무게', `${pr.bestW}${u}`], ['최고 반복', `${pr.bestReps}회`]];
  const gap = 12, cw = (W - 68 - gap) / 2, cy = 300, ch = 68;
  cells.forEach((c, i) => {
    const cx = 34 + i * (cw + gap);
    rr(cx, cy, cw, ch, 13); x.fillStyle = '#2A303E'; x.fill();
    x.textAlign = 'center';
    x.fillStyle = '#9AA3B2'; x.font = '600 12px Pretendard, sans-serif'; x.fillText(c[0], cx + cw / 2, cy + 26);
    x.fillStyle = '#fff'; x.font = DISP(25); x.fillText(c[1], cx + cw / 2, cy + 55);
    x.textAlign = 'left';
  });

  watermark(x, W, H);
  finishShareCard(cv, `${BRAND.en || 'pr'}-PR-${e.id}.png`, '개인 기록');
}

/* ========== 게이미피케이션: 업적 · 스트릭 ========== */
/* 최장 연속일 (역대) */
function longestStreak() {
  const dates = [...new Set((state.sessions || []).map(s => s.date))].sort();
  if (!dates.length) return 0;
  let best = 1, cur = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]); prev.setDate(prev.getDate() + 1);
    if (todayStr(prev) === dates[i]) cur++; else cur = 1;
    if (cur > best) best = cur;
  }
  return best;
}
/* 업적 판정용 통계 */
function badgeStats() {
  let maxW = 0;
  allExercises().forEach(e => { if (e.type === 'wr') { const p = exercisePR(e.id); if (p.bestW > maxW) maxW = p.bestW; } });
  const anyPR = allExercises().some(e => e.type === 'wr' && exercisePR(e.id).best1RM > 0);
  const dietDays = Object.keys(state.diet || {}).filter(k => (state.diet[k] || []).length).length;
  return {
    workouts: (state.sessions || []).length, streak: calcStreak(), bestStreak: longestStreak(),
    maxW, anyPR, vol: lifetimeVolume(), dietDays,
    joined: !!(state.challenge && state.challenge.code),
    goalHit: weekCount() >= (state.settings.weeklyGoal || 3),
  };
}
const BADGES = [
  { id: 'first', emoji: '🎯', name: '첫 걸음', desc: '첫 운동을 기록했어요', test: s => s.workouts >= 1, prog: s => [Math.min(s.workouts, 1), 1] },
  { id: 'w10', emoji: '🔟', name: '10회 달성', desc: '운동을 10회 기록', test: s => s.workouts >= 10, prog: s => [Math.min(s.workouts, 10), 10] },
  { id: 'w50', emoji: '🏋️', name: '헬스 마니아', desc: '운동을 50회 기록', test: s => s.workouts >= 50, prog: s => [Math.min(s.workouts, 50), 50] },
  { id: 'w100', emoji: '💯', name: '백전노장', desc: '운동을 100회 기록', test: s => s.workouts >= 100, prog: s => [Math.min(s.workouts, 100), 100] },
  { id: 's3', emoji: '🔥', name: '삼일의 벽', desc: '3일 연속 운동', test: s => s.bestStreak >= 3, prog: s => [Math.min(s.bestStreak, 3), 3] },
  { id: 's7', emoji: '🔥', name: '일주일 개근', desc: '7일 연속 운동', test: s => s.bestStreak >= 7, prog: s => [Math.min(s.bestStreak, 7), 7] },
  { id: 's14', emoji: '⚡', name: '2주 전사', desc: '14일 연속 운동', test: s => s.bestStreak >= 14, prog: s => [Math.min(s.bestStreak, 14), 14] },
  { id: 's30', emoji: '👑', name: '한 달 철인', desc: '30일 연속 운동', test: s => s.bestStreak >= 30, prog: s => [Math.min(s.bestStreak, 30), 30] },
  { id: 'pr1', emoji: '🥇', name: '첫 기록', desc: '첫 개인기록(PR) 달성', test: s => s.anyPR },
  { id: 'club100', emoji: '🏆', name: '100kg 클럽', desc: '한 종목 최고무게 100kg+', test: s => s.maxW >= 100, prog: s => [Math.min(Math.round(s.maxW), 100), 100] },
  { id: 'vol10', emoji: '📦', name: '10톤 클럽', desc: '누적 볼륨 10,000kg', test: s => s.vol >= 10000, prog: s => [Math.min(Math.round(s.vol), 10000), 10000] },
  { id: 'vol50', emoji: '🚂', name: '50톤 클럽', desc: '누적 볼륨 50,000kg', test: s => s.vol >= 50000, prog: s => [Math.min(Math.round(s.vol), 50000), 50000] },
  { id: 'diet1', emoji: '🍱', name: '식단 시작', desc: '식단을 처음 기록', test: s => s.dietDays >= 1 },
  { id: 'diet7', emoji: '🥗', name: '식단 일주일', desc: '7일 식단 기록', test: s => s.dietDays >= 7, prog: s => [Math.min(s.dietDays, 7), 7] },
  { id: 'goal', emoji: '✅', name: '목표 달성', desc: '이번 주 목표 달성', test: s => s.goalHit },
  { id: 'join', emoji: '🤝', name: '함께해요', desc: '그룹 챌린지 참여', test: s => s.joined },
];
function badgesSection() {
  const s = badgeStats();
  const list = BADGES.map(b => ({ ...b, earned: b.test(s) }));
  const n = list.filter(b => b.earned).length;
  return `<div class="sec-title-row"><h3 class="sec-title" style="margin:0">업적 🏅 <small style="color:var(--muted)">${n}/${list.length}</small></h3></div>
    <div class="badge-grid">${list.map(b => {
      const pr = b.prog ? b.prog(s) : null;
      return `<button class="badge ${b.earned ? 'on' : ''}" data-badge="${b.id}">
        <span class="badge-ic">${b.emoji}</span>
        <b>${b.name}</b>
        <small>${b.earned ? '달성 ✓' : (pr ? `${pr[0]}/${pr[1]}` : '미달성')}</small>
      </button>`;
    }).join('')}</div>`;
}
function streakCard() {
  const cur = calcStreak(), best = longestStreak();
  const M = [3, 7, 14, 30];
  const next = M.find(m => m > cur) || null;
  const prevM = M.filter(m => m <= cur).pop() || 0;
  const pct = next ? Math.round((cur - prevM) / (next - prevM) * 100) : 100;
  return `<div class="streak-card">
    <div class="streak-flame ${cur > 0 ? 'lit' : ''}">🔥</div>
    <div class="streak-body">
      <b>${cur}일 연속 운동${cur === 0 ? ' · 오늘 시작해요!' : ''}</b>
      <small>역대 최고 ${best}일</small>
      <div class="streak-track"><div class="streak-fill" style="width:${pct}%"></div></div>
      <span class="streak-next">${next ? `다음 뱃지까지 <b>${next - cur}일</b> 🎯` : '최고 등급 달성! 👑'}</span>
    </div></div>`;
}
function bindBadges(el) {
  el.querySelectorAll('[data-badge]').forEach(b => b.addEventListener('click', () => {
    const bd = BADGES.find(x => x.id === b.dataset.badge); if (!bd) return;
    const earned = bd.test(badgeStats());
    toast(`${bd.emoji} ${bd.name} — ${bd.desc}${earned ? ' ✅' : ' (미달성)'}`);
  }));
}
/* 신규 업적 획득 시 축하 (렌더 시 호출) */
function checkBadgeUnlocks() {
  const s = badgeStats();
  const now = BADGES.filter(b => b.test(s)).map(b => b.id);
  const prev = state.earnedBadges || [];
  const fresh = now.filter(id => !prev.includes(id));
  if (fresh.length || now.length !== prev.length) { state.earnedBadges = now; saveState(); }
  if (fresh.length && prev.length !== undefined) {
    const b = BADGES.find(x => x.id === fresh[fresh.length - 1]);
    if (b && typeof toast === 'function') setTimeout(() => toast(`🎉 새 업적 달성! ${b.emoji} ${b.name}`), 600);
  }
}

/* ========== AI 코치 심화 (텍스트 모드) ========== */
function aiCoachModal() { return document.querySelector('#ai-coach'); }
function aiCoachLoading(m) { m.querySelector('#aic-body').innerHTML = '<div class="aic-loading"><div class="aic-spin"></div><p>AI가 분석 중이에요…</p></div>'; }
function aicList(title, arr) { return (arr && arr.length) ? `<div class="aic-sec"><h4>${title}</h4><ul>${arr.map(x => `<li>${esc(String(x))}</li>`).join('')}</ul></div>` : ''; }

async function runAICoach(title, payload, renderFn) {
  const m = aiCoachModal();
  m.querySelector('.modal-head h3').textContent = title;
  aiCoachLoading(m); openModal('#ai-coach');
  try { const r = await aiCall(payload); m.querySelector('#aic-body').innerHTML = renderFn(r); }
  catch (e) { m.querySelector('#aic-body').innerHTML = `<p class="hint" style="text-align:center;padding:20px 0">${aiErrMsg(e)}</p>`; }
}

/* 1) AI 주간 리포트 */
function aiWeeklyReport() {
  const data = {
    운동횟수: weekCount(), 목표: state.settings.weeklyGoal || 3,
    주간볼륨: Math.round(weekVolume()), 단위: unit(),
    연속일: calcStreak(), 최고연속: longestStreak(),
    평균칼로리: weekDietAvg(), 식단기록일수: Object.keys(state.diet || {}).filter(k => (state.diet[k] || []).length).length,
  };
  runAICoach('🤖 AI 주간 리포트', { mode: 'report', data }, renderReport);
}
function renderReport(r) {
  const g = (r.grade || '-').toString().slice(0, 2);
  return `<div class="aic-grade-wrap"><div class="aic-grade">${esc(g)}</div><b>이번 주 종합</b></div>
    <p class="aic-summary">${esc(r.summary || '')}</p>
    ${aicList('💪 운동', r.workout)}${aicList('🍱 식단', r.diet)}${aicList('🎯 다음 주 실천', r.nextWeek)}
    <p class="hint">AI 참고용 조언이에요.</p>`;
}

/* 2) AI 식단 피드백 */
function aiDietFeedback() {
  const ds = dietDayStr(), items = dietFor(ds);
  if (!items.length) { toast('먼저 식단을 하나 이상 기록해 주세요'); return; }
  const data = {
    날짜: ds, 목표: state.dietGoal, 합계: dietTotals(ds),
    음식: items.map(x => ({ 끼니: x.meal, 이름: x.name, kcal: x.kcal, 탄: x.carb, 단: x.protein, 지: x.fat })),
  };
  runAICoach('🤖 AI 식단 피드백', { mode: 'dietfeed', data }, renderDietFeed);
}
function renderDietFeed(r) {
  const score = clamp(+r.score || 0, 0, 100);
  const col = score >= 80 ? 'var(--mint)' : score >= 60 ? '#F6A94A' : 'var(--accent2)';
  return `<div class="af-score"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" fill="none" stroke="var(--bg2)" stroke-width="7"/>
    <circle cx="40" cy="40" r="34" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round"
      stroke-dasharray="${2 * Math.PI * 34}" stroke-dashoffset="${2 * Math.PI * 34 * (1 - score / 100)}" transform="rotate(-90 40 40)"/></svg><b>${score}</b></div>
    <p class="aic-summary">${esc(r.summary || '')}</p>
    ${aicList('👍 잘한 점', r.good)}${aicList('🔧 개선점', r.improve)}
    ${r.tip ? `<p class="aic-tip">💡 ${esc(r.tip)}</p>` : ''}
    <p class="hint">AI 참고용 조언이에요.</p>`;
}

/* 3) AI 루틴 추천 */
function aiRoutineRecommend() {
  const m = aiCoachModal();
  m.querySelector('.modal-head h3').textContent = '🤖 AI 루틴 추천';
  m.querySelector('#aic-body').innerHTML = `
    <label>목표<select id="rt-goal"><option>근비대(벌크)</option><option>근력 향상</option><option>다이어트(컷)</option><option>체력 유지</option></select></label>
    <label>주당 운동 일수<select id="rt-days">${[2, 3, 4, 5, 6].map(n => `<option value="${n}" ${n === 4 ? 'selected' : ''}>주 ${n}일</option>`).join('')}</select></label>
    <label>수준<select id="rt-level"><option>초급</option><option selected>중급</option><option>고급</option></select></label>
    <button id="rt-go" class="big-btn">✨ 루틴 만들기</button>
    <p class="hint">목표에 맞는 주간 분할 루틴을 AI가 짜줘요.</p>`;
  openModal('#ai-coach');
  m.querySelector('#rt-go').addEventListener('click', () => {
    const data = { 목표: m.querySelector('#rt-goal').value, 주당일수: +m.querySelector('#rt-days').value, 수준: m.querySelector('#rt-level').value };
    aiCoachLoading(m);
    aiCall({ mode: 'routine', data }).then(r => { m.querySelector('#aic-body').innerHTML = renderRoutine(r); })
      .catch(e => { m.querySelector('#aic-body').innerHTML = `<p class="hint" style="text-align:center;padding:20px 0">${aiErrMsg(e)}</p>`; });
  });
}
function renderRoutine(r) {
  const days = (r.split || []).map(d => `<div class="rt-day">
    <div class="rt-day-h"><b>${esc(d.day || '')}</b><span>${esc(d.focus || '')}</span></div>
    ${(d.exercises || []).map(e => `<div class="rt-ex"><span>${esc(e.name || '')}</span><b>${e.sets || ''}세트 × ${esc(String(e.reps || ''))}</b></div>`).join('')}
  </div>`).join('');
  return `<h3 class="aic-rt-name">${esc(r.name || '추천 루틴')}</h3>${days}
    ${r.note ? `<p class="aic-tip">💡 ${esc(r.note)}</p>` : ''}
    <p class="hint">참고용이에요. 몸 상태·경험에 맞게 조절하세요.</p>`;
}

/* ========== 건강: BMI · 혈당 ========== */
function bmiInfo(bmi) {
  if (bmi < 18.5) return { cat: '저체중', color: '#6BA8FF' };
  if (bmi < 23) return { cat: '정상', color: '#5BE0B0' };
  if (bmi < 25) return { cat: '과체중', color: '#F6A94A' };
  if (bmi < 30) return { cat: '비만', color: '#FF7A59' };
  return { cat: '고도비만', color: '#FF5470' };
}
function bmiCard(latest) {
  const h = parseFloat(state.profile.height) || 0;
  const w = latest && latest.weight ? +latest.weight : 0;
  if (!h) {
    return `<div class="bmi-setup">
      <div><b>BMI 계산하기</b><small>키를 넣으면 최근 체중으로 자동 계산돼요</small></div>
      <div class="bmi-hin"><input id="bmi-h" type="number" inputmode="decimal" placeholder="키(cm)"><button id="bmi-save" class="pill-btn">저장</button></div>
    </div>`;
  }
  if (!w) {
    return `<div class="bmi-setup"><div><b>BMI</b><small>＋인바디에서 체중을 넣으면 계산돼요 · 키 ${h}cm</small></div><button id="bmi-edit" class="pill-btn ghost">키 수정</button></div>`;
  }
  const bmi = w / Math.pow(h / 100, 2);
  const info = bmiInfo(bmi);
  const pct = clamp((bmi - 15) / (35 - 15), 0, 1) * 100;
  return `<div class="bmi-card">
    <div class="bmi-top">
      <div class="bmi-main"><span class="bmi-label">BMI</span><b class="bmi-val" style="color:${info.color}">${bmi.toFixed(1)}</b><span class="bmi-cat" style="background:${info.color}22;color:${info.color}">${info.cat}</span></div>
      <button id="bmi-edit" class="pill-btn ghost">키 ${h}cm</button>
    </div>
    <div class="bmi-bar"><span class="bmi-marker" style="left:${pct}%"></span></div>
    <div class="bmi-scale"><span>18.5</span><span>23</span><span>25</span><span>30</span></div>
  </div>`;
}
function bindBmi(el) {
  el.querySelector('#bmi-save')?.addEventListener('click', () => {
    const v = parseFloat(el.querySelector('#bmi-h').value);
    if (v >= 100 && v <= 250) { state.profile.height = v; saveState(); renderBody(); }
    else toast('키를 cm 단위로 입력해주세요 (예: 172)');
  });
  el.querySelector('#bmi-edit')?.addEventListener('click', () => {
    const cur = state.profile.height || '';
    const v = prompt('키(cm)를 입력하세요', cur);
    if (v === null) return;
    const n = parseFloat(v);
    if (n >= 100 && n <= 250) { state.profile.height = n; saveState(); renderBody(); }
    else if (v !== '') toast('키를 cm 단위로 입력해주세요');
  });
}

const GLU_TAGS = [{ id: 'fasting', label: '공복' }, { id: 'after', label: '식후 2시간' }, { id: 'bed', label: '취침 전' }, { id: 'random', label: '수시' }];
function gluTagLabel(id) { return (GLU_TAGS.find(t => t.id === id) || {}).label || ''; }
function glucoseStatus(v, tag) {
  if (tag === 'fasting') {
    if (v < 100) return { label: '정상', color: '#5BE0B0' };
    if (v < 126) return { label: '공복혈당장애', color: '#F6A94A' };
    return { label: '당뇨 의심', color: '#FF5470' };
  }
  if (v < 140) return { label: '정상', color: '#5BE0B0' };
  if (v < 200) return { label: '주의', color: '#F6A94A' };
  return { label: '높음', color: '#FF5470' };
}
function glucoseSection() {
  const list = [...(state.glucose || [])].sort((a, b) => (a.dt || '').localeCompare(b.dt || ''));
  const head = `<div class="sec-title-row"><h3 class="sec-title" style="margin:0">혈당 🩸</h3><button id="glu-add" class="pill-btn">＋ 혈당</button></div>`;
  const latest = list[list.length - 1];
  if (!latest) return head + `<p class="hint"><b>＋ 혈당</b>으로 측정값(mg/dL)을 기록하면, 공복·식후 기준으로 정상·주의·높음을 표시해줘요.</p>`;
  const st = glucoseStatus(+latest.value, latest.tag);
  const rows = [...list].reverse().slice(0, 7).map(g => {
    const s = glucoseStatus(+g.value, g.tag);
    return `<div class="glu-row"><div class="glu-rl"><b>${g.value}<small>mg/dL</small></b><span>${gluTagLabel(g.tag)} · ${(g.dt || '').replace('T', ' ').slice(5, 16)}</span></div>
      <span class="glu-badge" style="color:${s.color};border-color:${s.color}55">${s.label}</span>
      <button class="glu-del" data-glu-del="${g.id}" aria-label="삭제">✕</button></div>`;
  }).join('');
  return head + `
    <div class="glu-latest">
      <div class="glu-big" style="color:${st.color}">${latest.value}<small>mg/dL</small></div>
      <div class="glu-meta"><span class="glu-badge" style="color:${st.color};border-color:${st.color}55">${st.label}</span><small>${gluTagLabel(latest.tag)} · 최근 측정</small></div>
    </div>
    <div class="glu-list">${rows}</div>
    <p class="hint">참고용이에요. 진단·치료는 반드시 의료진과 상의하세요.</p>`;
}
function bindGlucose(el) {
  el.querySelector('#glu-add')?.addEventListener('click', () => openGlucoseEntry());
  el.querySelectorAll('[data-glu-del]').forEach(b => b.addEventListener('click', () => {
    state.glucose = (state.glucose || []).filter(x => x.id !== b.dataset.gluDel); saveState(); renderBody();
  }));
}
function openGlucoseEntry() {
  const m = document.querySelector('#glucose-entry');
  const now = new Date();
  const dt = `${todayStr(now)}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  m.querySelector('#glu-body').innerHTML = `
    <label>혈당 (mg/dL)<input id="glu-val" type="number" inputmode="numeric" placeholder="예: 95"></label>
    <label>측정 시점<select id="glu-tag">${GLU_TAGS.map(t => `<option value="${t.id}">${t.label}</option>`).join('')}</select></label>
    <label>날짜·시간<input id="glu-dt" type="datetime-local" value="${dt}"></label>
    <label>메모(선택)<input id="glu-note" maxlength="40" placeholder="컨디션·식사 등"></label>
    <p class="hint" style="margin:2px 0 4px">공복 정상 &lt;100, 식후 2시간 정상 &lt;140 mg/dL</p>
    <button id="glu-save" class="big-btn">저장</button>`;
  m.querySelector('#glu-save').addEventListener('click', () => {
    const v = parseInt(m.querySelector('#glu-val').value);
    if (!v) { alert('혈당 값을 입력해주세요'); return; }
    if (!state.glucose) state.glucose = [];
    state.glucose.push({ id: uid(), value: v, tag: m.querySelector('#glu-tag').value, dt: m.querySelector('#glu-dt').value || dt, note: m.querySelector('#glu-note').value.trim() });
    saveState(); closeModal('#glucose-entry'); renderBody(); toast('혈당을 기록했어요 🩸');
  });
  openModal('#glucose-entry');
}
