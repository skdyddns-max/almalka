# 정훈이와 찬양하라 (폴더/내부키는 여전히 `almalka`)

운동방 전용 **운동 인증 + 식단 + AI 코치** PWA. 북핏(운동+독서)에서 독서를 걷어내고 운동만 남긴 뒤(→ 알려줄까말까 → 정훈이와 찬양하라로 개명) 식단·1RM·디로딩·AI 기능을 얹었다. 앱 이름은 `js/config.js`의 `BRAND.name`만 바꾸면 전역 반영(폴더·LS_KEY·repo id는 `almalka` 유지).

## 기능
- 6탭: 오늘(세션 기록)·**식단**·루틴·통계·챌린지·설정 (기록/캘린더는 통계의 "📅 기록" 버튼으로 진입)
- **챌린지 탭**: 요일 칸 탭 → 운동 시간·사진 인증 → 리더보드·출석부. 순위 = 운동일 + 사진(+1점). 공유테이블 `repbloom_challenge`, 버킷 `repbloom-photos`
- **운동 상세 기록**: 오늘 탭에서 세트·무게·횟수, 통계에 성장 그래프·PR
- **식단(신규)**: 끼니별 음식 기록(kcal·탄단지·사진), 하루 목표 대비 링·매크로바, 날짜 네비. `js/features.js`
- **1RM 계산기(신규)**: Epley·Brzycki·Lombardi 평균 + %1RM 목표무게 표. 홈·통계에서 진입
- **피로도·디로딩(신규)**: 연속 훈련주·볼륨추세·주관적 피로도(1~5) 종합 → 🟢/🟡/🔴 디로딩 신호. 통계 탭 상단
- **AI 코치(신규, 배포 필요)**: ①음식 사진→칼로리 추정 ②운동 사진→자세 점수·피드백. Supabase Edge Function `coach-ai`(Claude 비전) 프록시. **미배포 시 자동으로 수동 입력 폴백**. 설정법 `docs/AI-SETUP.md`, 함수 `supabase/functions/coach-ai/index.ts`

## 스택
- 바닐라 JS + HTML + CSS (빌드 없음), PWA(오프라인)
- 저장: localStorage (기본) → Supabase REST 동기화(선택). 백엔드는 **키토냉장고·핏메이트 공유 프로젝트** 재사용 → schema 이미 존재, DDL 불필요
- 배포 예정: GitHub Pages (`skdyddns-max.github.io/almalka`)

## 실행
```bash
bash run.sh          # http://localhost:8051
```

## 구조
- `js/config.js` — Supabase 키 + 브랜드명(`BRAND = {name:'정훈이와 찬양하라', en:'jhcy', emoji:'💪'}`). **이름 바꾸려면 여기만 수정**
- `js/data.js` — 운동 DB, state(+`diet`,`dietGoal`,`fatigue`), `myWeekSummary`
- `js/app.js` — 세션·휴식타이머·루틴·캘린더·통계·챌린지. render() 라우팅에 `diet` 추가, renderStats에 디로딩+1RM+기록버튼, renderHome에 AI/1RM 버튼
- `js/features.js` — **신규 기능 전부**: 식단(renderDiet·openMealEdit·openDietGoal)·1RM(calc1RM·open1RM)·디로딩(deloadAssess·deloadCard·logFatigue)·AI(aiCall·aiFoodCapture·aiFormCheck)
- `js/sync.js` — 기기 동기화 + 그룹 챌린지 push/pull
- `sw.js` — 서비스워커 SHELL에 features.js 포함. **배포 시 VERSION 증가 필수** (현재 `almalka-v2`)
- `supabase/functions/coach-ai/index.ts` — AI 비전 프록시(Deno). `docs/AI-SETUP.md` 참고

## 격리 (중요 — 같은 GitHub Pages origin에서 북핏/렙블룸과 충돌 방지)
- `LS_KEY='almalka.v1'`(data.js), `ACTIVE_KEY='almalka.active'`(app.js), `VERSION='almalka-v2'`(sw.js) — 모두 고유값.
- 챌린지 테이블·사진 버킷(`repbloom*`)은 공유하되 코드 유니크라 방끼리 안 섞임.

## AI 켜기 (자세·칼로리)
`docs/AI-SETUP.md`: `supabase secrets set ANTHROPIC_API_KEY=…` + `supabase functions deploy coach-ai --no-verify-jwt`. 미배포 시 `aiCall`이 실패→수동 입력 폴백. 모델 `claude-sonnet-5`.

## 알려진 상속 버그(북핏 원본엔 잔존, 여기선 수정됨)
`openQuickDay.doSave`가 draw() 후 입력값 읽어 인증시간 0저장 → draw 전 캡처로 수정. `shareCertImage` 요일그리드 `secs`(없음)→`exSecs`로 수정.

## 다음 후보
- 전용 아이콘·오픈채팅 배너·사용법 카드, GitHub repo `almalka`(또는 새 이름) 생성 후 Pages 배포
- AI Edge Function 배포+Anthropic 키(자세·칼로리 실작동), Supabase 키(그룹 실시간)
- 식단 사진 Storage 업로드(현재 dataURL 로컬 저장), 식단 챌린지 인증 연동
