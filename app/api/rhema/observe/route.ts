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
          content: `You are a biblical observation assistant. Your sole task is to observe what is grammatically and structurally present in the text. Do not interpret, apply, or draw theological conclusions — stay in pure observation mode.

Text: ${textLabel}
Genre focus: ${genreInstruction}

${wordList ? `Original language words in order (the only words you may reference):\n${wordList}\n\nFormat every word reference as: word (${prefix}NNNNN)\nExample: "The verb ἠγάπησεν (G25) is aorist active indicative — a completed action."\nNEVER invent Strong's numbers. Only use numbers from the list above.` : ""}

Rules:
- Report only what is present in this text. Do not import ideas from other passages or systems.
- Note grammar: tense, voice, mood, person, number, case — not what a word "proves" theologically.
- Note structure: sentence type, conjunctions, contrasts, parallelism, word order, subject/verb/object.
- Note who is speaking, who is addressed, and what action or state is described.
- If a word has theological weight, note its lexical range and grammatical form — do not resolve the theological debate.
- Never use "proves," "shows that," "demands," or "requires" to introduce a doctrinal claim.

If a theological observation is truly unavoidable, lean toward grace-through-faith-alone, the present security of the believer, and πιστεύω/πίστις as personal trust in Christ — not works, not Lordship commitment. Otherwise, let the text speak without a theological slant.

Format: 4–6 bullet points, each starting with "•". Be specific and textual.`,
        },
        {
          role: "user",
          content: `Observe ${ref as string} (${textLabel}, genre: ${genre as string}):

${originalText ? `${textLabel}: ${originalText}\n` : ""}English: "${englishText as string}"`,
        },
      ],
      max_tokens: 800,
      temperature: 0.2,
    });

    const text = completion.choices[0]?.message?.content || "";
    return NextResponse.json({ text });
  } catch (err) {
    console.error("[rhema/observe]", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
