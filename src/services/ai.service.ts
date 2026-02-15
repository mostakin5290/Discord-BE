import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env.js";

const genAI = new GoogleGenerativeAI(env.GOOGLE_GEMINI_API_KEY);

export class AIService {
  // Basic Summary (Current)
  static async generateSummary(messages: string, count: number): Promise<string> {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `You are a helpful assistant summarizing Discord channel messages. 

Here are ${count} messages you missed:

${messages}

Provide a concise, friendly summary in 2-3 sentences covering:
- Main topics discussed
- Important decisions or announcements
- Any questions directed at the user

Keep it casual and conversational.`;

    console.log("\n🤖 [AI] Generating summary with Gemini 2.5 Flash...");
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  // Detailed Summary with Categories
  static async generateDetailedSummary(messages: string, count: number): Promise<any> {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `Analyze these ${count} Discord messages and provide a structured summary:

${messages}

Return a JSON response with:
{
  "overview": "Brief 1-2 sentence overview",
  "topics": ["topic1", "topic2", ...],
  "keyPoints": ["point1", "point2", ...],
  "questions": ["question1", ...],
  "sentiment": "positive/neutral/negative",
  "urgentItems": ["urgent1", ...]
}`;

    console.log("\n🤖 [AI] Generating detailed summary...");
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    try {
      // Try to parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.log("⚠️ Could not parse JSON, returning text");
    }
    
    return { overview: text };
  }

  // Quick Bullet Points
  static async generateBulletPoints(messages: string, count: number): Promise<string> {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `Summarize these ${count} Discord messages as bullet points:

${messages}

Provide 3-5 key bullet points of what happened. Be concise and clear.`;

    console.log("\n🤖 [AI] Generating bullet points...");
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  // Action Items Extraction
  static async extractActionItems(messages: string): Promise<string[]> {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `Extract action items and tasks from these messages:

${messages}

List only the action items, one per line. If none, return "No action items found."`;

    console.log("\n🤖 [AI] Extracting action items...");
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    return text.split('\n').filter(line => line.trim().length > 0);
  }

  // Sentiment Analysis
  static async analyzeSentiment(messages: string): Promise<{
    sentiment: string;
    confidence: string;
    explanation: string;
  }> {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = `Analyze the overall sentiment of these messages:

${messages}

Respond with:
Sentiment: [positive/neutral/negative]
Confidence: [high/medium/low]
Explanation: [brief explanation]`;

    console.log("\n🤖 [AI] Analyzing sentiment...");
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    const sentimentMatch = text.match(/Sentiment:\s*(\w+)/i);
    const confidenceMatch = text.match(/Confidence:\s*(\w+)/i);
    const explanationMatch = text.match(/Explanation:\s*(.+)/i);
    
    return {
      sentiment: sentimentMatch?.[1] || 'neutral',
      confidence: confidenceMatch?.[1] || 'medium',
      explanation: explanationMatch?.[1] || text,
    };
  }
}
