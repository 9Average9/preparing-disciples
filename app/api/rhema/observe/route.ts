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
    const { ref, genre, englishText, textMode, isHebrew, originalWords } = await req.json();
    if (!englishText) return NextResponse.json({ error: "No text provided" }, { status: 400 });

    const openai = getOpenAIClient();
    const genreInstruction = GENRE_INSTRUCTIONS[genre as string] || GENRE_INSTRUCTIONS.narrative;
    const textLabel = isHebrew ? "Hebrew (BHS)" : (textMode === "critical" ? "Greek critical text (NA28/UBS5)" : "Greek majority text (Byzantine)");
    const prefix = isHebrew ? "H" : "G";

    // Build original-language text string and annotated word list
    const words = Array.isArray(originalWords) ? (originalWords as Array<{ surface: string; strongs: number }>) : [];
    const originalText = words.map(w => w.surface).join(" ");
    const wordList = words
      .filter(w => w.strongs > 0)
      .map(w => `${w.surface} (${prefix}${w.strongs})`)
      .join("  ");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a careful biblical exegesis assistant helping a student observe Scripture before interpreting it. Stay strictly faithful to what the text actually says — do not add ideas not present in the passage.

Text: ${textLabel}
Genre guidance: ${genreInstruction}

${wordList ? `The passage's original language words in order (use these for all references):\n${wordList}\n\nWhen you reference a word, use the exact format: word (${prefix}NNNNN)\nExample: "The verb ἠγάπησεν (G25) is aorist active, indicating a completed act of love."\nOnly reference words from the list above. Never invent Strong's numbers.` : ""}

Theological guardrails (apply only when theology is unavoidable — always prefer textual observation first):
- Salvation is by faith alone in Christ alone, apart from works (Eph 2:8-9, John 3:16, 6:47)
- Believers can have full, present assurance of eternal life (1 John 5:13, John 10:28)
- Distinguish passages about salvation from passages about discipleship, rewards, or community life
- James and similar passages address living faith in community, not the ground of justification
- "Believe/faith" (πιστεύω/πίστις) means trust and reliance — do not require Lordship commitment

Rules:
- Observe the original language text primarily — the English is a translation aid only
- Reference specific words, tenses, moods, voice, case, number, structural patterns
- Stay faithful to the text — only observe what is actually there
- Do not summarize — observe
- Format: 4–6 bullet points, each starting with "•"`,
        },
        {
          role: "user",
          content: `Observe ${ref as string} (${textLabel}, genre: ${genre as string}):

${originalText ? `${textLabel}: ${originalText}\n` : ""}English: "${englishText as string}"`,
        },
      ],
      max_tokens: 700,
      temperature: 0.25,
    });

    const text = completion.choices[0]?.message?.content || "";
    return NextResponse.json({ text });
  } catch (err) {
    console.error("[rhema/observe]", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
