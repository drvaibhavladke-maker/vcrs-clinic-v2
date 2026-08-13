import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

// Sends a review-request SMS to patients whose visit was marked "Completed" exactly
// REVIEW_DELAY_DAYS ago, and who haven't had one sent yet (review_requested_at is null).

const REVIEW_DELAY_DAYS = 3;

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

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - REVIEW_DELAY_DAYS);
  const targetDateISO = targetDate.toISOString().slice(0, 10);

  const { data: appts, error } = await supabase
    .from("appointments")
    .select("id, appointment_date, patients(first_name, last_name, mobile)")
    .eq("appointment_date", targetDateISO)
    .eq("status", "Completed")
    .is("review_requested_at", null);

  if (error) return res.status(500).json({ error: error.message });

  let sent = 0;
  for (const appt of appts || []) {
    const patientName = [appt.patients?.first_name, appt.patients?.last_name].filter(Boolean).join(" ");
    const patientPhone = appt.patients?.mobile;

    if (!patientPhone) continue;

    const message = `Hi ${patientName}, thank you for visiting Complete Care! If you have a moment, we'd really appreciate a quick review: ${process.env.GOOGLE_REVIEW_LINK} - VSL Integrative Health: From Discovery to Complete Care`;

    try {
      await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_SMS_FROM,
        to: formatPhone(patientPhone),
      });
      await supabase.from("appointments").update({ review_requested_at: new Date().toISOString() }).eq("id", appt.id);
      sent++;
    } catch (e) {
      console.error("Failed to send review request for", appt.id, e.message);
    }
  }

  return res.status(200).json({ checked: appts?.length || 0, sent });
}

function formatPhone(raw) {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}