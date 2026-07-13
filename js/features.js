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
      <button id="diet-goal" class="pill-btn ghost">🎯 목표</button></header>
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
    <input id="me-file" type="file" accept="image/*" capture="environment" hidden>
    ${groups}
    <p class="hint" style="margin-top:14px">📷 <b>사진으로 칼로리</b>는 AI가 음식 사진을 보고 칼로리·영양을 추정해요. ${aiReady() ? '' : '<b>AI 설정 전에는</b> 직접 추가로 기록하세요.'}</p>`;

  animateCounts(el); animateFills(el);
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
  const cur = existing || prefill || { meal: meal || 'breakfast', name: '', kcal: '', carb: '', protein: '', fat: '', photo: null };
  const m = document.querySelector('#meal-edit');
  m.querySelector('.modal-head h3').textContent = existing ? '음식 편집' : '음식 추가';
  m.querySelector('#me-body').innerHTML = `
    ${cur.photo ? `<div class="me-photo"><img src="${cur.photo}" alt=""></div>` : ''}
    <label>음식 이름<input id="me-name" value="${esc(cur.name || '')}" placeholder="예: 닭가슴살 100g" maxlength="40"></label>
    <div class="me-grid">
      <label>끼니<select id="me-meal">${MEALS.map(x => `<option value="${x.id}" ${cur.meal === x.id ? 'selected' : ''}>${x.ic} ${x.label}</option>`).join('')}</select></label>
      <label>칼로리(kcal)<input id="me-kcal" type="number" inputmode="numeric" value="${cur.kcal ?? ''}" placeholder="0"></label>
    </div>
    <div class="me-grid3">
      <label>탄수(g)<input id="me-carb" type="number" inputmode="decimal" value="${cur.carb ?? ''}" placeholder="0"></label>
      <label>단백(g)<input id="me-protein" type="number" inputmode="decimal" value="${cur.protein ?? ''}" placeholder="0"></label>
      <label>지방(g)<input id="me-fat" type="number" inputmode="decimal" value="${cur.fat ?? ''}" placeholder="0"></label>
    </div>
    <button id="me-save" class="big-btn">${existing ? '저장' : '추가'}</button>
    ${existing ? '<button id="me-remove" class="text-btn danger">삭제</button>' : ''}`;
  m.querySelector('#me-save').addEventListener('click', () => {
    const item = {
      id: existing ? existing.id : uid(),
      meal: m.querySelector('#me-meal').value,
      name: m.querySelector('#me-name').value.trim() || '음식',
      kcal: parseInt(m.querySelector('#me-kcal').value) || 0,
      carb: parseFloat(m.querySelector('#me-carb').value) || 0,
      protein: parseFloat(m.querySelector('#me-protein').value) || 0,
      fat: parseFloat(m.querySelector('#me-fat').value) || 0,
      photo: cur.photo || null,
    };
    if (!state.diet) state.diet = {};
    if (!state.diet[ds]) state.diet[ds] = [];
    if (existing) { const i = state.diet[ds].findIndex(x => x.id === existing.id); state.diet[ds][i] = item; }
    else state.diet[ds].push(item);
    saveState(); closeModal('#meal-edit'); renderDiet(); toast(existing ? '저장했어요' : '추가했어요 🍱');
  });
  m.querySelector('#me-remove')?.addEventListener('click', () => { delMeal(existing.id); closeModal('#meal-edit'); });
  openModal('#meal-edit');
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
  if (!res.ok) throw new Error('ai-' + res.status);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
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
        ${photo ? `<img src="${photo}" alt="">` : `<button id="af-pick" type="button" class="qd-photobtn">📷 자세 사진 올리기 <small>(측면 촬영 권장)</small></button>`}
        <input id="af-file" type="file" accept="image/*" capture="environment" hidden>
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
  if (c.includes('not-deployed') || c.includes('no-endpoint')) return 'AI 기능이 아직 설정되지 않았어요. 직접 입력해 주세요.';
  if (c.includes('ai-4')) return 'AI 요청이 거부됐어요(키·권한 확인). 직접 입력해 주세요.';
  return 'AI 분석에 실패했어요. 직접 입력해 주세요.';
}
