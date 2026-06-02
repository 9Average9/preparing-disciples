// IMPORTANT: Only import this module in server-side code and API routes.
// Never import it in client components — it exposes the API key.
import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  // Re-read the env var every time so a stale singleton never caches
  // "placeholder" from a cold start before the var was available.
  const apiKey = process.env.OPENAI_API_KEY;
  if (!_client || !apiKey) {
    _client = new OpenAI({ apiKey });
  }
  return _client;
}
