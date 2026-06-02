import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";
import type { SermonOutline, SlideTheme, Slide, GrammarChange } from "@/types";

interface GenerateRequest {
  outline: SermonOutline;
  theme: SlideTheme;
  vibe?: string;
}

interface AiTheme {
  bg: string;
  text: string;
  accent: string;
  font: string;
  name: string;
}

interface GenerateResponse {
  slides: Slide[];
  grammarChanges: GrammarChange[];
  theme?: AiTheme;
}

const VIBE_GUIDES: Record<string, string> = {
  "sacred-classic": "Rich walnut background. Gold accent. Warm cream text. Serif fonts. Traditional and ornate.",
  "bold-powerful": "Near-black background. Bold crimson accent. Pure white text. Sans-serif. Strong and authoritative.",
  "warm-inviting": "Warm ivory background. Amber accent. Deep brown text. Friendly and approachable.",
  "hope-renewal": "Soft sage-white background. Forest green accent. Deep green text. Fresh and life-giving.",
  "midnight-glory": "Deep midnight navy background. Soft indigo accent. Light blue-white text. Atmospheric and contemplative.",
  "sunrise-praise": "Warm white background. Vibrant orange accent. Dark espresso text. Energetic and celebratory.",
  "regal-anointed": "Deep purple-black background. Royal purple accent. Soft lavender-white text. Majestic and anointed.",
  "simple-truth": "Clean white background. Sky-blue accent. Near-black text. Minimal and clear. Sans-serif.",
};

const SYSTEM_PROMPT = `You are a presentation designer for sermons. Your job is to map a sermon outline into a beautiful, structured slide deck.

CRITICAL: Never invent, rewrite, or paraphrase the preacher's content. Use only what is in the outline.

SLIDE TYPE RULES — each type has a specific purpose and content format:

"title"   — The opening slide. heading = sermon title. body = scripture reference (short, e.g. "John 6:35–51").
"scripture" — A Bible verse display. Use verseRef (e.g. "John 6:35") and verseText (the actual verse text if provided; otherwise leave null). heading and body should be null.
"point"   — A main teaching point. heading = the point title (can include a number, e.g. "1. Jesus is the Bread"). body = bullet points, one per line, no bullet characters (the renderer adds them). Keep each bullet to 6–10 words. Max 4 bullets.
"illustration" — A story or illustration. heading = short title (3–5 words). body = one concise sentence summarizing the illustration.
"quote"   — A standalone quote or key phrase. body = the quote text. heading = attribution (speaker or scripture ref), or null if none.
"custom"  — Transition slides, section headers, or anything else. heading = the label. body = one short supporting sentence or null.

SLIDE ORDER: title → scripture (if ref given) → one or more slides per main point → conclusion slide.
For points with sub-points: create one "point" slide per main point. If a point has an illustration, add an "illustration" slide after it.

GRAMMAR: Flag only clear errors (subject-verb disagreement, spelling, missing punctuation). Never flag theological language, passive voice, or informal register.

THEME GENERATION: Using the provided vibe style guide as your palette direction AND the sermon's specific topic and tone, generate a custom color theme. Make the theme feel intentionally designed for this particular sermon — vary exact hues and saturation within the vibe's direction so no two sermons look identical. High contrast between bg and text is required.

Return ONLY a valid JSON object with this exact shape — no markdown, no explanation:
{
  "theme": { "bg": "#hex", "text": "#hex", "accent": "#hex", "font": "serif", "name": "Creative Theme Name" },
  "slides": [
    {
      "id": "1",
      "type": "title",
      "content": { "heading": "...", "body": "...", "verseRef": null, "verseText": null, "imagePrompt": "..." },
      "aiModified": false
    }
  ],
  "grammarChanges": [
    { "slideId": "1", "original": "exact text", "suggested": "corrected text", "reason": "brief explanation", "accepted": false }
  ]
}

imagePrompt should be 3–5 descriptive words for a background image (e.g. "golden wheat field sunset"). Always provide one.`;

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Validate API key is configured before doing anything else
  if (!process.env.OPENAI_API_KEY) {
    console.error("Slide generation error: OPENAI_API_KEY is not set");
    return NextResponse.json(
      { error: "OpenAI API key is not configured on the server." },
      { status: 500 }
    );
  }

  try {
    const body = (await req.json()) as GenerateRequest;
    const { outline, vibe } = body;

    // Null-safe access — Firestore data may be missing sub-fields on older sermons
    const mainPoints = outline.mainPoints ?? [];
    const vibeGuide = (vibe && VIBE_GUIDES[vibe]) || "Classic and timeless with warm, reverent tones.";
    const userContent = `
Sermon Outline:
- Scripture Reference: ${outline.scriptureRef || "Not specified"}
- Theme: ${outline.theme || "Not specified"}
- Introduction: ${outline.introduction || "Empty"}
- Main Points:
${mainPoints
  .map(
    (p, i) => `  ${i + 1}. ${p.title ?? "Untitled"}
     Sub-points: ${(p.subPoints ?? []).join(", ") || "None"}
     Verses: ${(p.verses ?? []).map((v) => `${v.book} ${v.chapter}:${v.verse}`).join(", ") || "None"}
     Illustration: ${p.illustration || "None"}`
  )
  .join("\n")}
- Conclusion: ${outline.conclusion || "Empty"}

Selected Vibe: ${vibe || "sacred-classic"}
Vibe Style Guide: ${vibeGuide}

Please generate the theme, build the slides array, and flag any grammar issues.
`;

    const completion = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096,
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";

    let data: GenerateResponse;
    try {
      data = JSON.parse(raw) as GenerateResponse;
    } catch {
      console.error("Slide generation error: could not parse OpenAI response", raw.slice(0, 200));
      return NextResponse.json(
        { error: "AI returned an unreadable response. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      slides: data.slides ?? [],
      grammarChanges: data.grammarChanges ?? [],
      theme: data.theme ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Slide generation error:", message);

    // Surface auth errors clearly so they're diagnosable in Vercel logs
    if (message.includes("401") || message.includes("Incorrect API key") || message.includes("invalid_api_key")) {
      return NextResponse.json(
        { error: "OpenAI API key is invalid. Please check your Vercel environment variable." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate slides. Please try again." },
      { status: 500 }
    );
  }
}
