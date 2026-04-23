import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AppEvent } from "./event-store.js";

export interface GeminiInsight {
  summary: string;
  riskAssessment: string;
  topAlerts: string[];
  recommendation: string;
  generatedAt: string;
  model: string;
}

function buildPrompt(events: AppEvent[]): string {
  const transactions = events.filter((e) => e.type === "transaction");
  const fraudAlerts = events.filter((e) => e.type === "fraud_alert");
  const limitBreaches = events.filter((e) => e.type === "limit_breach");
  const pinEvents = events.filter((e) => e.type === "pin_verification");
  const beneficiaryEvents = events.filter((e) => e.type === "beneficiary");

  const totalAmount = transactions.reduce((sum, t) => {
    const amt = typeof t.details["amount"] === "number" ? t.details["amount"] : 0;
    return sum + amt;
  }, 0);

  const uniqueUsers = [...new Set(events.map((e) => e.userId))];

  const recentEvents = events.slice(0, 15).map((e) => ({
    type: e.type,
    userId: e.userId,
    timestamp: e.timestamp,
    details: e.details,
  }));

  return `You are a financial security AI analyst for VoicePay — a voice-first UPI payment system built for visually impaired users in India.

Analyze the following real-time transaction data and provide a concise security briefing.

## Session Statistics
- Total events: ${events.length}
- Active users: ${uniqueUsers.join(", ") || "none"}
- Successful transactions: ${transactions.length}
- Total amount transferred: ₹${totalAmount.toLocaleString("en-IN")}
- Fraud alerts triggered: ${fraudAlerts.length}
- Transaction limit breaches: ${limitBreaches.length}
- PIN verifications: ${pinEvents.length}
- Beneficiary changes: ${beneficiaryEvents.length}

## Recent Events (last 15)
${JSON.stringify(recentEvents, null, 2)}

## Your Task
Respond with a JSON object with exactly these fields:
{
  "summary": "2-3 sentence overview of session activity and security posture",
  "riskAssessment": "One of: LOW / MEDIUM / HIGH — followed by a single sentence explaining why",
  "topAlerts": ["up to 3 specific actionable alerts, empty array if none"],
  "recommendation": "1 sentence on what the operator should do next"
}

Be specific, use rupee amounts where relevant, mention user IDs. Keep each field concise.`;
}

export async function generateInsights(events: AppEvent[]): Promise<GeminiInsight> {
  const apiKey = process.env["GEMINI_API_KEY"];

  if (!apiKey) {
    return {
      summary: "Gemini API key not configured. Add GEMINI_API_KEY to your .env file.",
      riskAssessment: "UNKNOWN — no AI analysis available",
      topAlerts: [],
      recommendation: "Set GEMINI_API_KEY to enable AI-powered insights.",
      generatedAt: new Date().toISOString(),
      model: "none",
    };
  }

  if (events.length === 0) {
    return {
      summary: "No activity recorded yet. Start a voice session to see AI insights.",
      riskAssessment: "LOW — no transactions to analyze",
      topAlerts: [],
      recommendation: "Make a test call to generate transaction data.",
      generatedAt: new Date().toISOString(),
      model: "gemini-2.5-flash",
    };
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // Try models in order, falling back on rate-limit or not-found errors
  const models = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
  ];
  let lastError: Error | null = null;

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const prompt = buildPrompt(events);
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error(`Gemini returned non-JSON response: ${text.slice(0, 200)}`);
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        summary: string;
        riskAssessment: string;
        topAlerts: string[];
        recommendation: string;
      };

      return {
        summary: parsed.summary,
        riskAssessment: parsed.riskAssessment,
        topAlerts: Array.isArray(parsed.topAlerts) ? parsed.topAlerts : [],
        recommendation: parsed.recommendation,
        generatedAt: new Date().toISOString(),
        model: modelName,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isRetryable =
        lastError.message.includes("429") ||
        lastError.message.includes("quota") ||
        lastError.message.includes("404") ||
        lastError.message.includes("not found");
      if (!isRetryable) throw lastError;
      // rate limited on this model — try next
    }
  }

  throw lastError ?? new Error("All Gemini models exhausted");
}
