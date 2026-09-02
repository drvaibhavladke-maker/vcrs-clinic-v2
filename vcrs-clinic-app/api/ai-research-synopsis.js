import { createClient } from "@supabase/supabase-js";
import mammoth from "mammoth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return res.status(401).json({ error: "Missing session token" });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  const { fileUrl } = req.body || {};
  if (!fileUrl || !String(fileUrl).trim()) {
    return res.status(400).json({ error: "fileUrl is required" });
  }

  let documentText = "";
  try {
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) {
      return res.status(400).json({ error: "Could not download the uploaded document" });
    }
    const arrayBuffer = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const { value } = await mammoth.extractRawText({ buffer });
    documentText = value || "";
  } catch (e) {
    console.error("Synopsis download/extract error:", e.message);
    return res.status(400).json({ error: "Could not read the uploaded document. Make sure it is a .docx file." });
  }

  if (!documentText.trim()) {
    return res.status(400).json({ error: "Could not extract any text from the document." });
  }

  const systemPrompt = `You are a research documentation assistant helping a doctor populate a research project tracker from an uploaded synopsis / dissertation proposal document.

Rules:
- Only extract and organize what is actually present in the document text below. Do NOT invent, guess, or add content that is not stated.
- If a section is not present or unclear in the document, return an empty string "" for that field rather than fabricating content.
- Keep each field's content close to the source wording, lightly cleaned up for readability (fix obvious spacing artifacts, keep numbering where useful).
- Budget information is rarely present in a synopsis document — only fill "budgetManagement" if the document actually contains budget/cost figures; otherwise return "".
- This output is a DRAFT for the doctor to review and edit before it is saved — never state it as final.

Respond with ONLY a JSON object, no markdown fences, no extra text, in exactly this shape:
{"title": "", "principalInvestigator": "", "guide": "", "coGuides": "", "courseSpecialization": "", "dateOfAdmission": "", "needForStudy": "", "researchGapQuestion": "", "reviewOfLiterature": "", "aimOfStudy": "", "objectives": "", "studySite": "", "methodology": "", "durationOfStudy": "", "dataAnalysisMethod": "", "ethicalClearance": "", "referencesList": "", "budgetManagement": ""}`;

  const userPrompt = `Document text extracted from the uploaded synopsis:\n\n${documentText.slice(0, 60000)}`;

  try {
    const model = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-20241022";
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("Anthropic API error:", aiRes.status, errText);
      return res.status(502).json({ error: "AI provider request failed" });
    }

    const aiJson = await aiRes.json();
    const rawText = aiJson?.content?.[0]?.text || "";

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    }

    if (!parsed) {
      return res.status(502).json({ error: "Could not parse AI response" });
    }

    return res.status(200).json({
      title: parsed.title || "",
      principalInvestigator: parsed.principalInvestigator || "",
      guide: parsed.guide || "",
      coGuides: parsed.coGuides || "",
      courseSpecialization: parsed.courseSpecialization || "",
      dateOfAdmission: parsed.dateOfAdmission || "",
      needForStudy: parsed.needForStudy || "",
      researchGapQuestion: parsed.researchGapQuestion || "",
      reviewOfLiterature: parsed.reviewOfLiterature || "",
      aimOfStudy: parsed.aimOfStudy || "",
      objectives: parsed.objectives || "",
      studySite: parsed.studySite || "",
      methodology: parsed.methodology || "",
      durationOfStudy: parsed.durationOfStudy || "",
      dataAnalysisMethod: parsed.dataAnalysisMethod || "",
      ethicalClearance: parsed.ethicalClearance || "",
      referencesList: parsed.referencesList || "",
      budgetManagement: parsed.budgetManagement || "",
    });
  } catch (e) {
    console.error("AI research synopsis error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
