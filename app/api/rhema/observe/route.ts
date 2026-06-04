import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";

const GENRE_INSTRUCTIONS: Record<string, string> = {
  narrative:   "Identify narrative elements: setting, characters, conflict, resolution. Note what God does vs. what humans do. Look for cause-and-effect and theological turning points.",
  law:         "Note who the command is addressed to and its stated purpose. Identify the structure (apodictic vs. casuistic). Consider the social, ceremonial, or moral category.",
  history:     "Identify the narrative turning point. Note cause-and-effect patterns. Consider what the author highlights or omits, and why.",
  wisdom:      "Identify contrasts and parallelism. Note the practical principle and who benefits from following it. Look for grounding in creation or covenant.",
  poetry:      "Identify the type of parallelism (synonymous, antithetic, synthetic). Note the dominant imagery and emotional tone. Observe the poem's structure and movement.",
  prophecy:    "Identify the historical situation addressed. Note whether this is promise, warning, or instruction. Consider near/far fulfillment possibilities.",
  gospel:      "Note what Jesus said and did. Identify who is present and their response. Look for Old Testament echoes. Consider what is revealed about Jesus' identity or mission.",
  epistle:     "Identify indicatives (what is true about believers) vs. imperatives (what is commanded). Note the logical argument structure. Identify the audience and occasion.",
  apocalyptic: "Note the symbolic imagery and any Old Testament echoes. Identify the contrast being drawn. Focus on the main message of hope or warning, not isolated symbols.",
};

export async function POST(req: NextRequest) {
  try {
    const { ref, genre, englishText } = await req.json();
    if (!englishText) return NextResponse.json({ error: "No text provided" }, { status: 400 });

    const openai = getOpenAIClient();
    const genreInstruction = GENRE_INSTRUCTIONS[genre as string] || GENRE_INSTRUCTIONS.narrative;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a careful biblical exegesis assistant helping a student observe Scripture before interpreting it.

Your job: surface 4–6 specific, textual observations — grammatical, structural, literary — that a careful reader might miss on first reading.

Genre guidance: ${genreInstruction}

Theological guardrails (apply only when theology is unavoidable):
- Salvation is by faith alone in Christ alone, apart from works (Eph 2:8-9, John 3:16, 6:47)
- Believers can have full assurance of eternal life now (1 John 5:13, John 10:28)
- Distinguish salvation passages from discipleship/rewards passages
- James and similar "works" passages address evidence and community life, not the ground of justification before God
- Do not assume "believe" requires commitment to Lordship — the Greek pisteuo means trust/reliance

Rules:
- Prioritize textual and grammatical observations over theological conclusions
- Reference specific words or phrases in the text
- Do not summarize the passage — observe it
- Format as 4–6 bullet points, each starting with "•"`,
        },
        {
          role: "user",
          content: `Observe ${ref as string} (genre: ${genre as string}):\n\n"${englishText as string}"`,
        },
      ],
      max_tokens: 650,
      temperature: 0.3,
    });

    const text = completion.choices[0]?.message?.content || "";
    return NextResponse.json({ text });
  } catch (err) {
    console.error("[rhema/observe]", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
