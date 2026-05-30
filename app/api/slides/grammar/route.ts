import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";
import type { GrammarChange } from "@/types";

interface GrammarRequest {
  text: string;
  slideId?: string;
}

type GrammarResult = Omit<GrammarChange, "slideId" | "accepted">;

const SYSTEM_PROMPT = `You are a grammar and punctuation checker for sermon presentation slides.

Rules:
- Check ONLY grammar and punctuation. Never change meaning or theological content.
- Do not flag stylistic choices, passive voice, or informal register — these are intentional.
- Do not flag scripture quotations — these must remain verbatim.
- Only flag clear errors: subject-verb disagreement, missing punctuation, obvious spelling errors, run-on sentences.
- If the text is correct, return an empty array.

Return a JSON object with this shape:
{
  "changes": [
    {
      "original": "exact substring with the error",
      "suggested": "corrected version of that substring only",
      "reason": "one sentence explanation"
    }
  ]
}`;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as GrammarRequest;
    const { text, slideId } = body;

    if (!text?.trim()) {
      return NextResponse.json({ changes: [] });
    }

    const completion = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Check this slide text for grammar issues:\n\n${text}` },
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
      temperature: 0.1,
    });

    const raw = completion.choices[0].message.content ?? '{"changes":[]}';
    const data = JSON.parse(raw) as { changes: GrammarResult[] };

    const changes: GrammarChange[] = data.changes.map((c) => ({
      ...c,
      slideId: slideId ?? "",
      accepted: false,
    }));

    return NextResponse.json({ changes });
  } catch (error) {
    console.error("Grammar check error:", error);
    return NextResponse.json(
      { error: "Failed to check grammar" },
      { status: 500 }
    );
  }
}
