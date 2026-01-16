import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

/**
 * 构建 CORS 头（关键修复点）
 * - Access-Control-Allow-Origin 只能是 origin，不能带路径
 * - 动态回显，防止 CORS 预检失败
 */
function buildCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";

  const allowlist = new Set([
    "https://yuanhaooooo.github.io", // ✅ GitHub Pages（不带 /jiabao）
    "http://localhost:5173",
    "http://localhost:3000",
  ]);

  const allowOrigin = allowlist.has(origin) ? origin : "";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  // ===== CORS 预检请求 =====
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 拦截非法来源（重要但安全）
  if (!corsHeaders["Access-Control-Allow-Origin"]) {
    return new Response(
      JSON.stringify({ error: "CORS blocked" }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
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

    const body = await req.json();
    const rawModel = body.model ?? "gemini-flash-latest";
    const model = String(rawModel).replace(/^models\//, "");
    const prompt = body.prompt ?? "";

    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "Missing prompt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const temperature =
      typeof body.temperature === "number" ? body.temperature : 0.7;

    const maxOutputTokens = Math.min(body.maxOutputTokens ?? 512, 2048);

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const geminiReq = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature,
        maxOutputTokens,
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

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p?.text)
        .join("") ?? "";

    return new Response(
      JSON.stringify({ text, raw: data }),
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
