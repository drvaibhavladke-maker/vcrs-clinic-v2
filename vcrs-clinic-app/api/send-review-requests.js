import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

export default async function handler(req, res) {
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!process.env.GOOGLE_REVIEW_LINK) {
    return res.status(500).json({ error: "GOOGLE_REVIEW_LINK env var is not set" });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  const { data: candidates, error } = await supabase.rpc("get_review_candidates");
  if (error) return res.status(500).json({ error: error.message });

  let sent = 0;
  for (const candidate of candidates || []) {
    // ADJUST ME: rename these to match get_review_candidates()'s real column names.
    const appointmentId = candidate.appointment_id;
    const patientName = [candidate.first_name, candidate.last_name].filter(Boolean).join(" ");
    const patientPhone = candidate.mobile;

    if (!patientPhone) continue;

    const message = `Hi ${patientName}, thank you for visiting Complete Care! If you have a moment, we'd really appreciate a quick review: ${process.env.GOOGLE_REVIEW_LINK} - VSL Integrative Health: From Discovery to Complete Care`;

    try {
      await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_SMS_FROM,
        to: formatPhone(patientPhone),
      });
      await supabase.from("appointments").update({ review_requested_at: new Date().toISOString() }).eq("id", appointmentId);
      sent++;
    } catch (e) {
      console.error("Failed to send review request for", appointmentId, e.message);
    }
  }

  return res.status(200).json({ checked: candidates?.length || 0, sent });
}

function formatPhone(raw) {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}