import { createClient } from "@supabase/supabase-js";
import twilio from "twilio";

export default async function handler(req, res) {
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = tomorrow.toISOString().slice(0, 10);

  const { data: appts, error } = await supabase
    .from("appointments")
    .select("*, patients(first_name, last_name, mobile)")
    .eq("appointment_date", tomorrowISO)
    .eq("status", "Scheduled")
    .eq("reminder_sent", false);

  if (error) return res.status(500).json({ error: error.message });

  const { data: settingsRows } = await supabase.from("settings").select("*").eq("key", "doctor_phone");
  const doctorPhone = settingsRows?.[0]?.value;

  let sent = 0;
  for (const appt of appts || []) {
    const patientName = [appt.patients?.first_name, appt.patients?.last_name].filter(Boolean).join(" ");
    const patientPhone = appt.patients?.mobile;
    const message = `Reminder: ${patientName} has an appointment tomorrow (${appt.appointment_date}) at ${appt.appointment_time} with ${appt.doctor || "the doctor"}.`;

    try {
      if (patientPhone) {
        await twilioClient.messages.create({ body: message, from: process.env.TWILIO_SMS_FROM, to: formatPhone(patientPhone) });
      }
      if (doctorPhone) {
        await twilioClient.messages.create({ body: message, from: process.env.TWILIO_SMS_FROM, to: formatPhone(doctorPhone) });
      }
      await supabase.from("appointments").update({ reminder_sent: true }).eq("id", appt.id);
      sent++;
    } catch (e) {
      console.error("Failed to send for appointment", appt.id, e.message);
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
