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
          content: `You are a biblical observation assistant. Your ONLY job is to observe what is grammatically and structurally present in the text. You do NOT interpret, apply, theologize, or draw doctrinal conclusions. Observation comes before interpretation — stay in that lane.

Text: ${textLabel}
Genre focus: ${genreInstruction}

${wordList ? `Original language words in order (the only words you may reference):\n${wordList}\n\nFormat every word reference as: word (${prefix}NNNNN)\nExample: "The verb ἠγάπησεν (G25) is aorist active indicative — a completed action."\nNEVER invent Strong's numbers. Only use numbers from the list above.` : ""}

OBSERVATION RULES — follow all of these strictly:
1. Only state what is grammatically or structurally present in this specific text. Do not import ideas from other passages or theological systems.
2. Do NOT draw theological conclusions. Note a word's tense, voice, mood, person, number, case — not what it "proves."
3. Do NOT use words like "proves," "shows that," "teaches," "demands," or "requires" followed by a doctrinal claim.
4. If a word has theological weight, observe its lexical range and grammatical form only.
5. Note structural features: sentence type, conjunctions, contrasts, parallelism, word order, subject/verb/object.
6. Note who is addressed, who is speaking, and what action or state is described.

THEOLOGICAL FLOOR — if and only if a theological statement is unavoidable, you MUST stay within these bounds:
- Salvation is by grace through faith alone in Christ alone, completely apart from works (John 3:16; 6:47; Eph 2:8-9). Never imply works contribute to receiving or keeping eternal life.
- Believers possess eternal life as a present, permanent reality and can have full assurance (John 10:28-29; 1 John 5:13). Do not cast doubt on the security of a believer.
- πιστεύω (G4100) and πίστις (G4102) denote personal trust and reliance — not intellectual assent alone, not Lordship submission, not commitment to obey. The object of saving faith is Christ himself.
- James addresses the VISIBLE EXPRESSION and COMMUNITY FRUIT of an already-existing faith among believers, not the ground or means of justification before God. "Works" in James validates faith before people (Jas 2:18), not before God. James 2 is not about how one becomes justified but about the demonstrable quality of living faith.
- The demons in James 2:19 demonstrate mere cognitive/factual knowledge of a theological proposition — not personal trust in Christ. This is a foil showing that bare propositional assent is insufficient, not an argument that saving faith requires works.
- Passages about discipleship, rewards, fruit, and community responsibility must not be conflated with passages about justification or eternal life.

Format: exactly 4–6 bullet points, each starting with "•". Be specific and textual. No summaries.`,
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
