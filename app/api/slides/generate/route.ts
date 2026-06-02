import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";
import type { SermonOutline, SlideTheme, Slide, GrammarChange } from "@/types";

interface GenerateRequest {
  outline: SermonOutline;
  theme: SlideTheme;
  vibe?: string;
  tone?: string;
  congregation?: string;
  depth?: string;
  extraContext?: string;
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

const TONE_GUIDANCE: Record<string, string> = {
  hopeful: "Warm, tender language. Include illustration slides with stories of hope. End with an uplifting quote or scripture slide. Avoid heavy bullet lists — let the content breathe.",
  bold: "Direct, punchy bullet points (2–3 max per point slide). Add a powerful quote slide after key points. End with a strong call-to-action custom slide. Use active, commanding language.",
  teaching: "Use more scripture slides for each referenced verse. Add clear section-header custom slides between main points. Bullet points can be detailed (up to 4). Include an 'application' custom slide near the end.",
  celebratory: "Keep bullets short and punchy. Add joyful transition custom slides. Include a praise-focused quote slide. The final slide should feel like a declaration or celebration.",
  contemplative: "Fewer bullet points — let single lines carry weight. More scripture slides. Use illustration slides for quiet, reflective stories. Leave space for the congregation to sit with the message.",
};

const CONGREGATION_GUIDANCE: Record<string, string> = {
  mixed: "Accessible language for all ages. Balance depth with clarity. Use a mix of traditional and contemporary references.",
  youth: "Contemporary, energetic language. Short punchy bullets. Metaphors and illustrations that connect to everyday life. Keep it visual and dynamic.",
  mature: "Traditional depth. Scripture can carry more weight on its own. Detailed bullet points are appropriate. Reverent, dignified tone.",
  seekers: "Clear, jargon-free language. Explain theological terms briefly. Welcoming transitions. Include a 'what this means for you' type custom slide.",
  leadership: "In-depth application points. Challenge statements. Equipping language — 'how to' and 'why it matters'. Can include more complex theological depth.",
};

const DEPTH_SLIDE_COUNTS: Record<string, string> = {
  compact: "8–10 slides total. Only the most essential moments: title, key scriptures, main points (1 slide each), conclusion.",
  standard: "12–15 slides total. A balanced deck: title, scriptures, main points with 1–2 illustrations, transitions, conclusion.",
  full: "18–22 slides total. A rich, detailed presentation: title, scriptures for each verse, full point slides, illustrations, quote slides, section breaks, conclusion.",
};

const SYSTEM_PROMPT = `You are a creative sermon presentation designer. Your job is to turn a sermon outline into a visually compelling, unique slide deck — one that feels specifically designed for THIS message and THIS congregation.

CRITICAL: Never invent, rewrite, or paraphrase the preacher's content. Use only what is in the outline.

CREATIVITY MANDATE: Every sermon deserves a unique presentation. Break out of templates:
- Don't always use the same slide structure — vary which types appear and when
- Some "point" slides should have just a bold headline with NO bullets for maximum visual impact
- Use "quote" slides for powerful phrases, key scripture lines, or memorable statements
- Use "illustration" slides for any story, analogy, or real-life example — keep them vivid
- Add "custom" slides for section transitions, call-to-action moments, reflection pauses
- Vary bullet count: 1–4 per point slide, not always 3

SLIDE TYPE RULES:
"title"       — Opening slide. heading = sermon title. body = scripture reference.
"scripture"   — Bible verse display. verseRef = reference (e.g. "John 6:35"). verseText = the full verse text. heading/body = null.
"point"       — Main teaching point. heading = point title. body = bullet points one per line, no bullet chars (renderer adds them). 6–10 words each. 1–4 bullets. (For bold impact, body can be null — just a headline.)
"illustration"— Story or analogy. heading = short vivid title (3–5 words). body = one powerful sentence.
"quote"       — Key phrase or statement. body = the quote text. heading = attribution or null.
"custom"      — Transitions, section breaks, calls to action. heading = brief label. body = one short line or null.

SLIDE ORDER: title → [opening scripture] → main section slides → conclusion slide.
Within sections: point → optional illustration → optional quote.

IMAGE PROMPTS: For EVERY slide, write a vivid, specific 5–8 word imagePrompt that relates directly to that slide's content and the sermon's theme. Make it painterly and atmospheric. Examples:
  ✓ "shepherd searching rocky hillside misty dawn"
  ✓ "hands outstretched toward golden morning light"
  ✓ "ancient stone bridge over rushing river"
  ✗ "sunset nature landscape" (too generic)
  ✗ "church cross symbol" (avoid religious iconography)
Every slide must have a unique imagePrompt.

GRAMMAR: Flag only clear errors (subject-verb disagreement, spelling, missing punctuation). Never flag theological language, passive voice, or informal register.

THEME GENERATION: Using the vibe palette AND the sermon's specific topic, tone, and congregation, generate a custom color theme. Vary exact hex values within the vibe's direction so every sermon feels uniquely designed. High contrast between bg and text is required.

Return ONLY valid JSON — no markdown, no explanation:
{
  "theme": { "bg": "#hex", "text": "#hex", "accent": "#hex", "font": "serif|sans", "name": "Creative Theme Name" },
  "slides": [
    {
      "id": "1",
      "type": "title|scripture|point|illustration|quote|custom",
      "content": { "heading": "...", "body": "...", "verseRef": null, "verseText": null, "imagePrompt": "vivid specific 5-8 word scene" },
      "aiModified": false
    }
  ],
  "grammarChanges": [
    { "slideId": "1", "original": "exact text", "suggested": "corrected text", "reason": "brief explanation", "accepted": false }
  ]
}`;

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!process.env.OPENAI_API_KEY) {
    console.error("Slide generation error: OPENAI_API_KEY is not set");
    return NextResponse.json(
      { error: "OpenAI API key is not configured on the server." },
      { status: 500 }
    );
  }

  try {
    const body = (await req.json()) as GenerateRequest;
    const { outline, vibe, tone, congregation, depth, extraContext } = body;

    const mainPoints = outline.mainPoints ?? [];
    const vibeGuide = (vibe && VIBE_GUIDES[vibe]) || "Classic and timeless with warm, reverent tones.";
    const toneGuide = (tone && TONE_GUIDANCE[tone]) || "";
    const congregationGuide = (congregation && CONGREGATION_GUIDANCE[congregation]) || "";
    const depthGuide = (depth && DEPTH_SLIDE_COUNTS[depth]) || DEPTH_SLIDE_COUNTS["standard"];

    const userContent = `Sermon Outline:
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

Message Tone: ${tone || "not specified"}
${toneGuide ? `Tone Guidance: ${toneGuide}` : ""}

Congregation: ${congregation || "mixed"}
${congregationGuide ? `Congregation Guidance: ${congregationGuide}` : ""}

Slide Depth: ${depth || "standard"}
Slide Count Target: ${depthGuide}
${extraContext ? `\nSpecial Context from Preacher: ${extraContext}` : ""}

Please generate the theme, build the slides, and flag any grammar issues. Make this presentation feel custom-designed for this specific sermon.`;

    const completion = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      max_tokens: 6000,
      temperature: 0.6,
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

    if (message.includes("401") || message.includes("Incorrect API key") || message.includes("invalid_api_key")) {
      return NextResponse.json(
        { error: "OpenAI API key is invalid. Please check your environment variable." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate slides. Please try again." },
      { status: 500 }
    );
  }
}
