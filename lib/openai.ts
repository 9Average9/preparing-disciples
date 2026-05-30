// IMPORTANT: Only import this module in server-side code and API routes.
// Never import it in client components — it exposes the API key.
import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY ?? "placeholder",
    });
  }
  return _client;
}
