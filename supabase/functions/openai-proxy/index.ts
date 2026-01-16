import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://yuanhaooooo.github.io/jiabao/", // 生产建议改成你的域名
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // CORS 预检
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 只允许 POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing GEMINI_API_KEY in Supabase Secrets" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 前端传入的 body（你可以只传 prompt，也可以传更完整参数）
    const body = await req.json();

    // 你可以在前端传：
    // { prompt: "hello", model: "gemini-flash-latest", temperature: 0.7 }
    const model = body.model ?? "gemini-flash-latest"; // 常用：flash 快、pro 更强
    const prompt = body.prompt ?? "";

    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "Missing prompt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 参数保护（防滥用）
    const temperature =
      typeof body.temperature === "number" ? body.temperature : 0.7;

    // ✅ Gemini REST API（Generative Language API）
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const geminiReq = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature,
        // 你也可以加 topP, topK, maxOutputTokens 等
        maxOutputTokens: Math.min(body.maxOutputTokens ?? 512, 2048),
      },
    };

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiReq),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: data }), {
        status: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 统一给前端一个更好用的返回结构
    const text =
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).join("") ??
      "";

    return new Response(
      JSON.stringify({
        raw: data,
        text,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
