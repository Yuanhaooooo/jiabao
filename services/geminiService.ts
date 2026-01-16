import type { GreetingData } from "../types";

const SUPABASE_FN_URL =
  "https://xrnegvlpjpdokastipsx.supabase.co/functions/v1/openai-proxy";

/**
 * 通过 Supabase Edge Function 调用 Gemini（安全：前端不持有 API Key）
 */
export async function generateLuxuryGreeting(
  name: string
): Promise<GreetingData> {
  // 你可以按需微调这段 prompt，但建议先别动，先稳定跑通
  const prompt = `
请为「${name}」生成一段“平和、克制、科技感、偏高级”的生日祝福。
要求：
- 主体中文，可夹带一句很短的英文（可选）
- 风格：宁静、未来感、带一点仪式感，不要浮夸
- 长度：80～160 个中文字符
- 不要提到“AI/模型/API/系统提示”等字眼
输出：只输出祝福正文，不要标题、不要解释
`.trim();

  const resp = await fetch(SUPABASE_FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // 这里的 model 名可以传 "gemini-flash-latest" 或 "models/gemini-flash-latest"
    // 我们在服务端建议做了兼容（去掉 models/ 前缀）
    body: JSON.stringify({
      model: "gemini-flash-latest",
      prompt,
      maxOutputTokens: 300,
      temperature: 0.8,
    }),
  });

  const data = await resp.json();

  if (!resp.ok) {
    // 让你能在浏览器控制台看到 Supabase/Gemini 的真实报错
    console.error("[geminiService] Supabase function error:", data);
    throw new Error("Failed to generate greeting");
  }

  return {
    message: String(data.text ?? ""),
    author: "Gemini via Supabase",
  };
}
