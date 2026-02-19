
import { GoogleGenAI } from "@google/genai";

export const getMaintenanceAdvice = async (
  equipmentName: string,
  brand: string,
  model: string,
  issue: string
): Promise<string> => {
  // Fix: Use the required named parameter and direct process.env.API_KEY access for initialization
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    // Fix: Selected 'gemini-3-pro-preview' for advanced reasoning/STEM diagnostic tasks
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Como um engenheiro clínico sênior, sugira passos técnicos de diagnóstico para o seguinte equipamento médico:
        Equipamento: ${equipmentName}
        Marca: ${brand}
        Modelo: ${model}
        Problema Relatado: ${issue}
        
        Responda em português brasileiro de forma técnica e resumida (máximo 150 palavras).`,
      config: {
        temperature: 0.7,
        topP: 0.9,
      },
    });
    // Fix: Accessing the generated text via the .text property as per the latest SDK requirements
    return response.text || "Não foi possível gerar sugestões automáticas no momento.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Erro ao conectar com a IA para sugestões técnicas.";
  }
};