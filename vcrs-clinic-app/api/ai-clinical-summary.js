import { createClient } from "@supabase/supabase-js";

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

  const { chiefComplaint, rawNotes } = req.body || {};
  if (!rawNotes || !String(rawNotes).trim()) {
    return res.status(400).json({ error: "rawNotes is required" });
  }

  const systemPrompt = `You are a clinical documentation assistant helping a physician turn their own brief visit notes into a structured consultation note.

Rules:
- Only organize, expand, and clean up what the physician actually wrote. Do NOT invent findings, diagnoses, medications, or details that are not stated or clearly implied.
- If the input doesn't give you enough to fill a section, write "See physician notes" for that section rather than fabricating content.
- Write in clear, professional clinical language.
- This output is a DRAFT for the physician to review and edit before it becomes part of the medical record — never state it as final.

Respond with ONLY a JSON object, no markdown fences, no extra text, in exactly this shape:
{"diagnosis": "...", "treatmentPlan": "...", "notes": "..."}`;

  const userPrompt = `Chief complaint: ${chiefComplaint || "(not provided)"}

Physician's rough notes from the visit:
${rawNotes}`;

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
        max_tokens: 800,
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
      diagnosis: parsed.diagnosis || "",
      treatmentPlan: parsed.treatmentPlan || "",
      notes: parsed.notes || "",
    });
  } catch (e) {
    console.error("AI clinical summary error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}