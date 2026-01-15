import { GoogleGenAI, Type } from "@google/genai";

/**
 * 统一、安全地读取 API Key
 * - Vite 标准方式：import.meta.env.VITE_GEMINI_API_KEY
 */
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

/**
 * 延迟初始化，避免没 key 直接把整个页面炸掉
 */
function getClient() {
  if (!API_KEY) {
    console.warn(
      "[Gemini] Missing VITE_GEMINI_API_KEY. Gemini features are disabled."
    );
    return null;
  }
  return new GoogleGenAI({ apiKey: API_KEY });
}

export const generateLuxuryGreeting = async (
  name: string
): Promise<{ message: string; author: string }> => {
  const ai = getClient();

  // ✅ 没 key 时优雅降级（不黑屏）
  if (!ai) {
    return {
      message:
        "十七岁的星辰正在生成之中，愿你在未来的维度里优雅觉醒。",
      author: "系统占位祝辞"
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `为 ${name} 生成一段极其奢华、具有赛博未来感且高雅的 17 岁生日祝辞。
强调“17岁”是生命中充满无限可能的维度。
语调应高冷且富有诗意。
字数控制在 40 字以内。使用中文返回 JSON 格式。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: { type: Type.STRING },
            author: { type: Type.STRING }
          },
          required: ["message", "author"],
          propertyOrdering: ["message", "author"]
        }
      }
    });

    const jsonStr =
      response.text?.trim() ||
      '{"message":"十七岁的星辰，已在你的数字基因中觉醒，愿你征服永恒的维度。","author":"以太协议"}';

    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      message:
        "十七岁的生命波形已达到巅峰共振，愿你在无限的可能中重塑未来。",
      author: "寰宇核心"
    };
  }
};
