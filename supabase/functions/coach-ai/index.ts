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
    const { mode, image, exercise } = await req.json();
    if (!PROMPTS[mode]) return json({ error: "bad-mode" }, 400);
    const img = parseImage(image);
    const prompt = PROMPTS[mode].replace("{EX}", exercise || "이 운동");

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: img.media_type, data: img.data } },
            { type: "text", text: prompt },
          ],
        }],
      }),
    });
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 300);
      const lowCredit = detail.includes("credit balance is too low");
      return json({ error: lowCredit ? "low-credit" : "anthropic-" + r.status }, 502);
    }
    const data = await r.json();
    const text = (data.content || []).map((c: { text?: string }) => c.text || "").join("");
    return json(extractJSON(text));
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 400);
  }
});
