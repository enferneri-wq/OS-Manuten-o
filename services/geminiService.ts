import { GoogleGenAI } from "@google/genai";

export const getMaintenanceAdvice = async (
  equipmentName: string,
  brand: string,
  model: string,
  issue: string
): Promise<string> => {
  // Inicialização correta conforme as diretrizes do SDK
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    // Uso do modelo Gemini 3 Pro para tarefas complexas de raciocínio técnico
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Como um engenheiro clínico especializado, forneça um guia rápido de diagnóstico técnico para o seguinte caso:
        Equipamento: ${equipmentName}
        Marca/Modelo: ${brand} ${model}
        Problema: ${issue}
        
        Sua resposta deve ser estritamente técnica, em português brasileiro e concisa (máximo 120 palavras).`,
      config: {
        temperature: 0.4, // Menor temperatura para respostas mais factuais e técnicas
        topP: 0.8,
      },
    });

    // Acesso correto à propriedade .text da resposta
    return response.text || "Não foi possível processar a recomendação técnica no momento.";
  } catch (error) {
    console.error("Erro na integração com Gemini API:", error);
    return "Falha ao conectar com o motor de IA para suporte técnico.";
  }
};