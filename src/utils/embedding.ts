import { GoogleGenAI } from "@google/genai";

export const createEmbedding = async (content: string) => {
    const ai = new GoogleGenAI({
        apiKey: process.env.GOOGLE_GEMINI_API_KEY!,
    });

    const response = await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: content.trim().split("\n").map((line) => line.trim()),
        config: {
            outputDimensionality: 768,
        },
    });

    return response?.embeddings?.[0]?.values ?? [];
};