# AI 기능 켜기 (자세 체크 · 음식 칼로리)

앱의 두 AI 기능은 **Claude 비전 모델**을 씁니다. 키가 노출되지 않도록
Supabase Edge Function(`coach-ai`)이 프록시 역할을 합니다. 배포 전에는
자동으로 **직접 입력**으로 대체되므로 앱은 그대로 잘 돌아갑니다.

## 준비물
- Supabase 프로젝트 (이미 쓰는 공유 프로젝트 `wzlapxdnfhgapheuuqnl` 재사용 가능)
- Anthropic API 키 (https://console.anthropic.com → API Keys) — **사용량만큼 과금**
- Supabase CLI (`brew install supabase/tap/supabase`)

## 배포 (3줄)
```bash
cd ~/projects/almalka
supabase login                     # 최초 1회
supabase link --project-ref wzlapxdnfhgapheuuqnl
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxx
supabase functions deploy coach-ai --no-verify-jwt
```

`--no-verify-jwt` : 앱이 anon 키로 호출하므로 필요.

## 확인
배포 후 앱에서:
- **식단 탭 → 📷 사진으로 칼로리** : 음식 사진 → 이름·kcal·탄단지 자동 채움(수정 가능)
- **오늘 탭 → 🤖 AI 자세 체크** : 운동 선택 + 자세 사진 → 점수·잘한점·개선점·큐

호출 URL은 `js/features.js`의 `aiEndpoint()`가
`${SUPABASE_CONFIG.url}/functions/v1/coach-ai` 로 자동 구성합니다. 별도 설정 불필요.

## 비용 절감 팁
- 사진은 앱이 900px로 압축해 보냅니다(토큰 절약).
- 모델은 `supabase/functions/coach-ai/index.ts`의 `MODEL` 상수에서 변경 가능
  (기본 `claude-sonnet-5`. 더 저렴하게: `claude-haiku-4-5-20251001`).

## 동작 원리
- 클라이언트: `aiCall({mode:'food'|'form', image, exercise?})` → Edge Function
- Edge Function: 이미지+지시문을 Claude Messages API에 전달 → JSON만 파싱해 반환
- 실패(미배포·키오류·네트워크) 시 앱은 조용히 수동 입력 폼으로 폴백
