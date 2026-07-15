// 정훈이와 찬양하라 — AI 코치 Edge Function
// 음식 사진 → 칼로리/영양 추정, 운동 사진 → 자세 피드백 (Claude 비전)
// 배포:  supabase functions deploy coach-ai --no-verify-jwt
// 시크릿: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// (같은 공유 프로젝트에 올리면 정훈이와 찬양하라 앱에서 바로 호출됩니다)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MODEL = "claude-sonnet-5"; // 비전 지원 · 비용 효율
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// data URL → { media_type, data(base64) }
function parseImage(dataUrl: string) {
  const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/s.exec(dataUrl || "");
  if (!m) throw new Error("bad-image");
  return { media_type: m[1], data: m[2] };
}

// 이미지 모드
const PROMPTS: Record<string, string> = {
  food:
    "너는 영양 분석가야. 사진 속 '한 인분(보이는 양)'의 음식을 추정해. " +
    "반드시 아래 JSON만 출력(설명·코드펜스 금지): " +
    '{"name":"음식명(한국어)","kcal":정수,"carb":탄수화물g,"protein":단백질g,"fat":지방g,"note":"한줄 코멘트"}. ' +
    "여러 음식이면 합산하고 name에 대표+개수. 불확실해도 최선의 추정치를 숫자로.",
  form:
    "너는 웨이트 트레이닝 코치야. 사진 속 '{EX}' 자세를 평가해. " +
    "반드시 아래 JSON만 출력(설명·코드펜스 금지): " +
    '{"exercise":"운동명","score":0-100 정수,"summary":"한줄 총평(한국어)","good":["잘한 점", ...],' +
    '"improve":["개선점(구체적으로)", ...],"cues":["실행 큐 2~3개"],"safety":"부상 위험 경고 또는 빈문자"}. ' +
    "모든 텍스트는 한국어. 사진만으로 판단이 어려우면 summary에 촬영 팁을 넣어.",
};

// 텍스트 모드 (data JSON을 뒤에 붙임)
const TEXT_PROMPTS: Record<string, string> = {
  report:
    "너는 따뜻하지만 솔직한 개인 피트니스 코치야. 아래 JSON은 회원의 이번 주 운동·식단 데이터. 종합 평가해. " +
    "반드시 아래 JSON만 출력(설명·코드펜스 금지): " +
    '{"grade":"A~F 중 하나","summary":"2~3문장 총평","workout":["운동 관련 코멘트 1~2개"],' +
    '"diet":["식단 코멘트 1~2개"],"nextWeek":["다음 주 구체적 실천 제안 2~3개"]}. ' +
    "모든 텍스트 한국어, 구체적이고 실행가능하게. 데이터가 적으면 격려 위주로. 데이터: ",
  dietfeed:
    "너는 영양 코치야. 아래 JSON은 회원의 하루 식단(목표 대비). 평가해. " +
    "반드시 아래 JSON만 출력(설명·코드펜스 금지): " +
    '{"score":0-100 정수,"summary":"한줄 총평","good":["잘한 점 1~2개"],' +
    '"improve":["개선점 1~2개"],"tip":"내일을 위한 팁 한 줄"}. ' +
    "모든 텍스트 한국어. 단백질/칼로리 균형을 중점적으로. 데이터: ",
  routine:
    "너는 웨이트 트레이닝 프로그램 코치야. 아래 조건에 맞는 주간 분할 루틴을 짜. " +
    "반드시 아래 JSON만 출력(설명·코드펜스 금지): " +
    '{"name":"루틴 이름","split":[{"day":"Day 1","focus":"부위","exercises":[{"name":"운동명(한국어)","sets":정수,"reps":"8-12"}]}],"note":"주의·팁 한 줄"}. ' +
    "요청한 주당 일수만큼 day를 만들고, 각 day에 운동 4~6개. 한국어. 조건: ",
};
const TEXT_MODES = ["report", "dietfeed", "routine"];

function extractJSON(text: string) {
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  if (s < 0 || e < 0) throw new Error("no-json");
  return JSON.parse(text.slice(s, e + 1));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    // 시크릿에 개행/공백/비-ASCII가 섞이면 헤더 구성이 실패하므로 인쇄가능 ASCII만 남김
    const key = (Deno.env.get("ANTHROPIC_API_KEY") || "").replace(/[^\x21-\x7E]/g, "");
    if (!key) return json({ error: "no-api-key" }, 500);
    if (!key.startsWith("sk-ant-")) return json({ error: "bad-api-key-format" }, 500);
    const { mode, image, exercise, data } = await req.json();
    const isText = TEXT_MODES.includes(mode);
    if (!PROMPTS[mode] && !isText) return json({ error: "bad-mode" }, 400);

    let content;
    if (isText) {
      content = [{ type: "text", text: TEXT_PROMPTS[mode] + JSON.stringify(data || {}) }];
    } else {
      const img = parseImage(image);
      const prompt = PROMPTS[mode].replace("{EX}", exercise || "이 운동");
      content = [
        { type: "image", source: { type: "base64", media_type: img.media_type, data: img.data } },
        { type: "text", text: prompt },
      ];
    }

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: mode === "routine" ? 1600 : 900,
        messages: [{ role: "user", content }],
      }),
    });
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 300);
      const lowCredit = detail.includes("credit balance is too low");
      return json({ error: lowCredit ? "low-credit" : "anthropic-" + r.status }, 502);
    }
    const respData = await r.json();
    const text = (respData.content || []).map((c: { text?: string }) => c.text || "").join("");
    return json(extractJSON(text));
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 400);
  }
});
