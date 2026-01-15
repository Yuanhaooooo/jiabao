
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateLuxuryGreeting = async (name: string): Promise<{ message: string; author: string }> => {
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

    const jsonStr = response.text?.trim() || '{"message": "十七岁的星辰，已在你的数字基因中觉醒，愿你征服永恒的维度。", "author": "以太协议"}';
    const result = JSON.parse(jsonStr);
    return result;
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      message: "十七岁的生命波形已达到巅峰共振，愿你在无限的可能中重塑未来。",
      author: "寰宇核心"
    };
  }
};
