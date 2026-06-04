import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";

export async function POST(req: NextRequest) {
  try {
    const { query, passage, offset = 0 } = await req.json();
    if (!query?.trim()) return NextResponse.json({ error: "No query provided" }, { status: 400 });

    const openai = getOpenAIClient();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a biblical commentary research assistant with deep knowledge of published commentaries, their theological traditions, and where they are available online.

Return a JSON object: { "commentaries": [ ...10 items... ] }

Each item must have:
  author        - full name of the author(s)
  work          - exact title of the work
  year          - publication year as string (or "n.d." if unknown)
  tradition     - theological tradition in 1-3 words (e.g. "Free Grace", "Reformed", "Catholic", "Evangelical", "Lutheran")
  overview      - 2-3 sentences describing what THIS work says about the query topic, specific to its argument or contribution
  link          - a real, working URL (see guidance below)
  source        - where to find it (e.g. "faithalone.org", "BibleHub", "StudyLight", "planobiblechapel.org", "Google Books")

ORDERING: Results ${offset + 1}–${offset + 3} MUST be Free Grace or Free Grace-friendly commentaries if any exist for the topic. Good Free Grace sources: Zane Hodges, Bob Wilkin, Joseph Dillow, Charlie Bing, J. Paul Tanner, Thomas L. Constable (generally Free Grace-friendly), Fred Chay, Jody Dillow, Grace Evangelical Society authors. Results ${offset + 4}–${offset + 10} may be broader Reformed, Evangelical, Catholic, or other traditions — still related to the query.

LINK GUIDANCE (use real, working URLs — never invent a URL):
- BibleHub commentaries (passage-specific): https://biblehub.com/commentaries/{lowercase_book}/{chapter}-{verse}.htm
  Example: https://biblehub.com/commentaries/john/3-16.htm
- StudyLight: https://www.studylight.org/commentaries/eng/
- Constable's notes (PDF per book): https://www.planobiblechapel.org/tcon/notes/
- Grace Evangelical Society: https://faithalone.org/journal/
- GES search: https://faithalone.org/?s={encoded_topic}
- Google Books (for works not free online): https://books.google.com/books?q={encoded_title_author}
- Publisher site if the work has one
- For any work available free on StudyLight or BibleHub, prefer that URL

ACCURACY: Only return commentaries that genuinely exist. Do not fabricate titles or authors. Skip the first ${offset} results you would otherwise give (this is a "give more" request starting at result ${offset + 1}).`,
        },
        {
          role: "user",
          content: `Find commentaries related to: "${query}"${passage ? `\nCurrent passage for context: ${passage}` : ""}`,
        },
      ],
      max_tokens: 2500,
      temperature: 0.2,
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    const data = JSON.parse(raw);
    return NextResponse.json({ commentaries: data.commentaries || [] });
  } catch (err) {
    console.error("[rhema/commentary]", err);
    return NextResponse.json({ error: "Commentary search failed" }, { status: 500 });
  }
}
