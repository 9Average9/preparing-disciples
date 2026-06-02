import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";
import type { SermonOutline, SlideTheme, Slide, GrammarChange } from "@/types";

interface GenerateRequest {
  outline: SermonOutline;
  theme: SlideTheme;
}

interface GenerateResponse {
  slides: Slide[];
  grammarChanges: GrammarChange[];
}

const SYSTEM_PROMPT = `You are a presentation layout assistant for a sermon.

Your job is NOT to write the sermon — the preacher's words are sacred and you must preserve them exactly.

Your ONLY jobs are:
1) Map the sermon outline to logical slide breaks. Each main point becomes one or more slides. The introduction becomes a title slide. The conclusion becomes a closing slide. Scripture references become scripture slides.
2) Suggest appropriate image description prompts for slide backgrounds (2-5 words, descriptive, e.g. "wheat field golden sunset").
3) Flag any grammar issues with the EXACT original text and a suggested fix with a clear explanation. NEVER rewrite theological content — only flag clear grammatical or punctuation errors.

Return a JSON object with this exact shape:
{
  "slides": [
    {
      "id": "<uuid>",
      "type": "title" | "scripture" | "point" | "illustration" | "quote" | "custom",
      "content": {
        "heading": "string or null",
        "body": "string or null",
        "verseRef": "string or null",
        "verseText": "string or null",
        "imagePrompt": "string or null"
      },
      "aiModified": false
    }
  ],
  "grammarChanges": [
    {
      "slideId": "<uuid of the slide>",
      "original": "exact text with issue",
      "suggested": "corrected text",
      "reason": "brief explanation",
      "accepted": false
    }
  ]
}

Keep slide content concise — slides are not transcripts. Pull only the key point titles and scripture refs. Never invent content not present in the outline.`;

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
    const { outline } = body;

    // Null-safe access — Firestore data may be missing sub-fields on older sermons
    const mainPoints = outline.mainPoints ?? [];
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

Please build the slides array and flag any grammar issues.
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
