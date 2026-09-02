import { createClient } from "@supabase/supabase-js";

const ORCID_ID_RE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function extractDoi(work) {
  const ids = work?.["external-ids"]?.["external-id"] || [];
  const doiEntry = ids.find((id) => (id["external-id-type"] || "").toLowerCase() === "doi");
  return doiEntry?.["external-id-normalized"]?.value || doiEntry?.["external-id-value"] || "";
}

function extractAuthors(work) {
  const contributors = work?.contributors?.contributor || [];
  const names = contributors.map((c) => c?.["credit-name"]?.value).filter(Boolean);
  return names.join(", ");
}

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

  const { orcidId } = req.body || {};
  const cleanId = String(orcidId || "").trim();
  if (!ORCID_ID_RE.test(cleanId)) {
    return res.status(400).json({ error: "That doesn't look like a valid ORCID iD (expected format: 0000-0000-0000-0000)." });
  }

  try {
    const summaryRes = await fetch(`https://pub.orcid.org/v3.0/${cleanId}/works`, {
      headers: { Accept: "application/json" },
    });
    if (!summaryRes.ok) {
      if (summaryRes.status === 404) {
        return res.status(404).json({ error: "No ORCID record found for that iD." });
      }
      return res.status(502).json({ error: "ORCID could not be reached right now. Try again shortly." });
    }
    const summaryJson = await summaryRes.json();
    const groups = summaryJson.group || [];
    const putCodes = groups
      .map((g) => g["work-summary"]?.[0]?.["put-code"])
      .filter((code) => code !== undefined && code !== null);

    if (putCodes.length === 0) {
      return res.status(200).json({ publications: [] });
    }

    const batches = chunk(putCodes, 50);
    const works = [];
    for (const batch of batches) {
      const bulkRes = await fetch(`https://pub.orcid.org/v3.0/${cleanId}/works/${batch.join(",")}`, {
        headers: { Accept: "application/json" },
      });
      if (!bulkRes.ok) continue;
      const bulkJson = await bulkRes.json();
      const items = bulkJson.bulk || [];
      for (const item of items) {
        const work = item.work || item;
        if (work) works.push(work);
      }
    }

    const publications = works
      .map((work) => ({
        title: work?.title?.title?.value || "",
        journal: work?.["journal-title"]?.value || "",
        authors: extractAuthors(work),
        year: work?.["publication-date"]?.year?.value ? Number(work["publication-date"].year.value) : null,
        doi: extractDoi(work),
      }))
      .filter((p) => p.title);

    return res.status(200).json({ publications });
  } catch (e) {
    console.error("ORCID sync error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
