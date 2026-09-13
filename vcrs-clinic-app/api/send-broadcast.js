import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

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

  const { patientIds, message, filterType, filterLabel } = req.body || {};
  if (!Array.isArray(patientIds) || patientIds.length === 0) {
    return res.status(400).json({ error: "No recipients selected" });
  }
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: "Message is required" });
  }
  if (!process.env.TWILIO_TEMPLATE_BROADCAST_SID) {
    return res.status(400).json({ error: "Broadcast template isn't configured yet. Add TWILIO_TEMPLATE_BROADCAST_SID in Vercel and redeploy." });
  }

  const { data: patients, error: patientsError } = await supabase
    .from("patients")
    .select("id, first_name, last_name, mobile")
    .in("id", patientIds);
  if (patientsError) return res.status(500).json({ error: patientsError.message });

  const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const trimmedMessage = String(message).trim();

  const results = [];
  for (const p of patients || []) {
    const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || "there";
    if (!p.mobile) {
      results.push({ patient_id: p.id, name, phone: null, status: "failed", error: "No phone number on file" });
      continue;
    }
    const phone = formatPhone(p.mobile);
    try {
      await twilioClient.messages.create({
        contentSid: process.env.TWILIO_TEMPLATE_BROADCAST_SID,
        contentVariables: JSON.stringify({ "1": name, "2": trimmedMessage }),
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
        to: `whatsapp:${phone}`,
      });
      results.push({ patient_id: p.id, name, phone, status: "sent" });
    } catch (e) {
      console.error("Broadcast send failed for patient", p.id, e.message);
      results.push({ patient_id: p.id, name, phone, status: "failed", error: e.message });
    }
  }

  const sentCount = results.filter((r) => r.status === "sent").length;
  const failedCount = results.length - sentCount;

  const { data: broadcastRow, error: insertError } = await supabase
    .from("broadcasts")
    .insert({
      created_by: userData.user.email || "Admin",
      filter_type: filterType || null,
      filter_label: filterLabel || null,
      message: trimmedMessage,
      recipient_count: results.length,
      sent_count: sentCount,
      failed_count: failedCount,
      results,
    })
    .select()
    .single();
  if (insertError) console.error("Failed to log broadcast:", insertError.message);

  return res.status(200).json({
    recipientCount: results.length,
    sentCount,
    failedCount,
    results,
    broadcast: broadcastRow || null,
  });
}

function formatPhone(raw) {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}
