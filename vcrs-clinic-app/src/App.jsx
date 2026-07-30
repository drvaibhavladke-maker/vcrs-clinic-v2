import { useState, useEffect, useMemo, useCallback } from "react";
import {
  LayoutDashboard, Users, CalendarDays, Receipt, Pill, Plus, X, Search,
  Edit2, Trash2, Phone, Mail, MapPin, ChevronLeft, Clock, CheckCircle2,
  XCircle, AlertTriangle, Droplet, Stethoscope, Settings2,
  ShieldCheck, Wallet, FlaskConical, Image as ImageIcon, Microscope,
  TestTube, Beaker, BookOpen, ScrollText, Lock, AlertCircle, Loader2,
} from "lucide-react";
import { supabase, supabaseConfigured } from "./supabaseClient";

/* ---------------------------------------------------------------
   Design tokens — same clinic-ledger look as the prototype.
------------------------------------------------------------------ */
const COLORS = {
  ink: "#16302B", inkSoft: "#4A615C", surface: "#FBFAF6", card: "#FFFFFF",
  line: "#DCE3DD", teal: "#1F5F52", tealDeep: "#123B33", amber: "#B8793A",
  amberSoft: "#F3E3CE", rose: "#B14A3C", roseSoft: "#F4DFD9", sage: "#E7EFE7",
  violet: "#6A5A9C", violetSoft: "#E9E5F3",
};
const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');";

const CURRENT_USER = "Admin"; // replace with logged-in user once auth is added
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const initials = (name = "") => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
const AVATAR_HUES = ["#1F5F52", "#B8793A", "#6A5A9C", "#B14A3C", "#2E6E8C", "#7A8C2E"];
const hueFor = (id) => AVATAR_HUES[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_HUES.length];

/* ---------------------------------------------------------------
   Module schema — label/db pairs mirror VCRS_Database.xlsx headings.
   FK fields store the target row's uuid `id` (real referential
   integrity, matching the Supabase schema).
------------------------------------------------------------------ */
const MODULES = [
  {
    key: "patients", label: "Patients", table: "patients", icon: Users, category: "Clinical",
    displayIdField: "patient_id", audit: true,
    fields: [
      { name: "UHID", db: "uhid", type: "text" },
      { name: "First Name", db: "first_name", type: "text", required: true },
      { name: "Middle Name", db: "middle_name", type: "text" },
      { name: "Last Name", db: "last_name", type: "text" },
      { name: "Gender", db: "gender", type: "select", options: ["Female", "Male", "Other"] },
      { name: "Date Of Birth", db: "date_of_birth", type: "date" },
      { name: "Age", db: "age", type: "number" },
      { name: "Blood Group", db: "blood_group", type: "text" },
      { name: "Mobile", db: "mobile", type: "text" },
      { name: "Email", db: "email", type: "email" },
      { name: "Address", db: "address", type: "text" },
      { name: "City", db: "city", type: "text" },
      { name: "State", db: "state", type: "text" },
      { name: "Pin Code", db: "pin_code", type: "text" },
      { name: "Occupation", db: "occupation", type: "text" },
      { name: "Status", db: "status", type: "select", options: ["Active", "Inactive"] },
    ],
  },
  {
    key: "appointments", label: "Appointments", table: "appointments", icon: CalendarDays, category: "Clinical",
    displayIdField: "appointment_id", audit: true,
    fields: [
      { name: "Patient ID", db: "patient_id", type: "fk", module: "patients", required: true },
      { name: "Appointment Date", db: "appointment_date", type: "date", required: true },
      { name: "Appointment Time", db: "appointment_time", type: "time", required: true },
      { name: "Doctor", db: "doctor", type: "text" },
      { name: "Department", db: "department", type: "text" },
      { name: "Status", db: "status", type: "select", options: ["Scheduled", "Completed", "Cancelled"] },
      { name: "Remarks", db: "remarks", type: "textarea" },
    ],
    listColumns: ["Patient ID", "Appointment Date", "Appointment Time", "Doctor", "Status"],
  },
  {
    key: "consultations", label: "Consultations", table: "consultations", icon: Stethoscope, category: "Clinical",
    displayIdField: "consultation_id", audit: true,
    fields: [
      { name: "Patient ID", db: "patient_id", type: "fk", module: "patients", required: true },
      { name: "Doctor", db: "doctor", type: "text" },
      { name: "Chief Complaint", db: "chief_complaint", type: "textarea" },
      { name: "Diagnosis", db: "diagnosis", type: "textarea" },
      { name: "Treatment Plan", db: "treatment_plan", type: "textarea" },
      { name: "Notes", db: "notes", type: "textarea" },
      { name: "Status", db: "status", type: "select", options: ["Open", "Completed"] },
    ],
    listColumns: ["Patient ID", "Doctor", "Diagnosis", "Status"],
  },
  {
    key: "prescriptions", label: "Prescriptions", table: "prescriptions", icon: Pill, category: "Clinical",
    displayIdField: "prescription_id", audit: true,
    fields: [
      { name: "Patient ID", db: "patient_id", type: "fk", module: "patients", required: true },
      { name: "Doctor", db: "doctor", type: "text" },
      { name: "Medicine", db: "medicine", type: "text", required: true },
      { name: "Dosage", db: "dosage", type: "text" },
      { name: "Frequency", db: "frequency", type: "text" },
      { name: "Duration", db: "duration", type: "text" },
      { name: "Instructions", db: "instructions", type: "textarea" },
      { name: "Status", db: "status", type: "select", options: ["Active", "Completed", "Cancelled"] },
    ],
    listColumns: ["Patient ID", "Medicine", "Dosage", "Frequency", "Status"],
  },
  {
    key: "laboratory", label: "Laboratory", table: "laboratory", icon: FlaskConical, category: "Clinical",
    displayIdField: "lab_id", audit: true,
    fields: [
      { name: "Patient ID", db: "patient_id", type: "fk", module: "patients", required: true },
      { name: "Test Name", db: "test_name", type: "text", required: true },
      { name: "Sample Type", db: "sample_type", type: "text" },
      { name: "Result", db: "result", type: "text" },
      { name: "Normal Range", db: "normal_range", type: "text" },
      { name: "Status", db: "status", type: "select", options: ["Pending", "Completed"] },
    ],
    listColumns: ["Patient ID", "Test Name", "Result", "Status"],
  },
  {
    key: "clinicalphotos", label: "Clinical Photos", table: "clinical_photos", icon: ImageIcon, category: "Clinical",
    displayIdField: "photo_id", audit: true,
    fields: [
      { name: "Patient ID", db: "patient_id", type: "fk", module: "patients", required: true },
      { name: "Title", db: "title", type: "text" },
      { name: "Image URL", db: "image_url", type: "file" },
      { name: "Description", db: "description", type: "textarea" },
      { name: "Status", db: "status", type: "select", options: ["Active", "Archived"] },
    ],
    listColumns: ["Patient ID", "Title", "Status"],
  },
  {
    key: "samples", label: "Samples", table: "samples", icon: TestTube, category: "Clinical",
    displayIdField: "sample_id", audit: true,
    fields: [
      { name: "Patient ID", db: "patient_id", type: "fk", module: "patients", required: true },
      { name: "Sample Type", db: "sample_type", type: "text" },
      { name: "Collection Date", db: "collection_date", type: "date" },
      { name: "Storage Location", db: "storage_location", type: "text" },
      { name: "Status", db: "status", type: "select", options: ["Stored", "Used", "Discarded"] },
    ],
    listColumns: ["Patient ID", "Sample Type", "Collection Date", "Status"],
  },
  {
    key: "billing", label: "Billing", table: "billing", icon: Receipt, category: "Billing",
    displayIdField: "bill_id", audit: true,
    fields: [
      { name: "Patient ID", db: "patient_id", type: "fk", module: "patients", required: true },
      { name: "Description", db: "description", type: "text" },
      { name: "Amount", db: "amount", type: "number" },
      { name: "Discount", db: "discount", type: "number" },
      { name: "Tax", db: "tax", type: "number" },
      { name: "Net Amount", db: "net_amount", type: "number", computed: true },
      { name: "Status", db: "status", type: "select", options: ["Paid", "Unpaid", "Partially Paid"] },
    ],
    listColumns: ["Patient ID", "Description", "Net Amount", "Status"],
  },
  {
    key: "payments", label: "Payments", table: "payments", icon: Wallet, category: "Billing",
    displayIdField: "payment_id", audit: true,
    fields: [
      { name: "Bill ID", db: "bill_id", type: "fk", module: "billing", required: true },
      { name: "Patient ID", db: "patient_id", type: "fk", module: "patients", required: true },
      { name: "Amount", db: "amount", type: "number" },
      { name: "Payment Mode", db: "payment_mode", type: "select", options: ["Cash", "Card", "UPI", "Bank Transfer", "Insurance"] },
      { name: "Reference No", db: "reference_no", type: "text" },
      { name: "Status", db: "status", type: "select", options: ["Success", "Pending", "Failed"] },
    ],
    listColumns: ["Patient ID", "Bill ID", "Amount", "Payment Mode", "Status"],
  },
  {
    key: "researchprojects", label: "Research Projects", table: "research_projects", icon: Microscope, category: "Research",
    displayIdField: "project_id", audit: true,
    fields: [
      { name: "Title", db: "title", type: "text", required: true },
      { name: "Principal Investigator", db: "principal_investigator", type: "text" },
      { name: "Department", db: "department", type: "text" },
      { name: "Funding Agency", db: "funding_agency", type: "text" },
      { name: "Status", db: "status", type: "select", options: ["Ongoing", "Completed", "On Hold"] },
      { name: "Start Date", db: "start_date", type: "date" },
      { name: "End Date", db: "end_date", type: "date" },
    ],
    listColumns: ["Title", "Principal Investigator", "Department", "Status"],
  },
  {
    key: "experiments", label: "Experiments", table: "experiments", icon: Beaker, category: "Research",
    displayIdField: "experiment_id", audit: true,
    fields: [
      { name: "Project ID", db: "project_id", type: "fk", module: "researchprojects", required: true },
      { name: "Title", db: "title", type: "text", required: true },
      { name: "Objective", db: "objective", type: "textarea" },
      { name: "Method", db: "method", type: "textarea" },
      { name: "Status", db: "status", type: "select", options: ["Planned", "In Progress", "Completed"] },
    ],
    listColumns: ["Project ID", "Title", "Status"],
  },
  {
    key: "publications", label: "Publications", table: "publications", icon: BookOpen, category: "Research",
    displayIdField: "publication_id", audit: true,
    fields: [
      { name: "Title", db: "title", type: "text", required: true },
      { name: "Journal", db: "journal", type: "text" },
      { name: "Authors", db: "authors", type: "text" },
      { name: "Year", db: "year", type: "number" },
      { name: "DOI", db: "doi", type: "text" },
      { name: "Status", db: "status", type: "select", options: ["Draft", "Submitted", "Published"] },
    ],
    listColumns: ["Title", "Journal", "Year", "Status"],
  },
  {
    key: "users", label: "Users", table: "users", icon: ShieldCheck, category: "Admin",
    displayIdField: "user_id", audit: true,
    fields: [
      { name: "Username", db: "username", type: "text", required: true },
      { name: "Password", db: "password", type: "password" },
      { name: "Full Name", db: "full_name", type: "text", required: true },
      { name: "Role", db: "role", type: "select", options: ["Admin", "Doctor", "Nurse", "Receptionist", "Lab Technician", "Researcher"] },
      { name: "Email", db: "email", type: "email" },
      { name: "Mobile", db: "mobile", type: "text" },
      { name: "Status", db: "status", type: "select", options: ["Active", "Inactive"] },
    ],
    listColumns: ["Full Name", "Role", "Email", "Status"],
  },
  {
    key: "settings", label: "Settings", table: "settings", icon: Settings2, category: "Admin",
    displayIdField: null, audit: false,
    fields: [
      { name: "Key", db: "key", type: "text", required: true },
      { name: "Value", db: "value", type: "text" },
      { name: "Description", db: "description", type: "textarea" },
    ],
    listColumns: ["Key", "Value", "Description"],
  },
  {
    key: "auditlog", label: "Audit Log", table: "audit_log", icon: ScrollText, category: "Admin",
    displayIdField: null, audit: false, readOnly: true,
    fields: [
      { name: "Module", db: "module", type: "text" },
      { name: "Action", db: "action", type: "text" },
      { name: "User", db: "user", type: "text" },
      { name: "Description", db: "description", type: "text" },
      { name: "Timestamp", db: "timestamp", type: "text" },
    ],
    listColumns: ["Timestamp", "Module", "Action", "User", "Description"],
  },
];
const MODULES_BY_KEY = Object.fromEntries(MODULES.map((m) => [m.key, m]));
const CATEGORY_ORDER = ["Clinical", "Billing", "Research", "Admin"];

function recordLabel(module, rec) {
  if (!rec) return "—";
  if (module.key === "patients") return [rec.first_name, rec.middle_name, rec.last_name].filter(Boolean).join(" ") || rec.patient_id;
  if (module.key === "billing") return `${rec.description || "Bill"} · ${fmtMoney(rec.net_amount ?? rec.amount)}`;
  if (module.key === "researchprojects") return rec.title || rec.project_id;
  if (module.key === "users") return rec.full_name || rec.username;
  const firstText = module.fields.find((f) => f.type === "text");
  return (firstText && rec[firstText.db]) || (module.displayIdField && rec[module.displayIdField]) || "Record";
}

/* ---------------------------------------------------------------
   Supabase data helpers
------------------------------------------------------------------ */
async function fetchAll(table) {
  const { data, error } = await supabase.from(table).select("*");
  if (error) throw error;
  return data || [];
}
async function insertRow(table, payload) {
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  return data;
}
async function updateRow(table, id, payload) {
  const { data, error } = await supabase.from(table).update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
async function deleteRow(table, id) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}
       async function uploadPhoto(file) {
  const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
  const { error } = await supabase.storage.from("clinical-photos").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("clinical-photos").getPublicUrl(path);
  return data.publicUrl;
}

/* ---------------------------------------------------------------
   UI atoms
------------------------------------------------------------------ */
const STATUS_TONE = {
  Active: "neutral", Completed: "neutral", Paid: "neutral", Success: "neutral",
  Scheduled: "amber", Pending: "amber", Unpaid: "amber", Open: "amber",
  Ongoing: "amber", "In Progress": "amber", Planned: "amber", Stored: "neutral",
  Draft: "amber", Submitted: "amber", Published: "neutral", "Partially Paid": "amber",
  Cancelled: "rose", Inactive: "rose", Failed: "rose", Discarded: "rose",
  Archived: "rose", "On Hold": "rose",
};
function Badge({ tone = "neutral", children }) {
  const tones = {
    neutral: { bg: COLORS.sage, fg: COLORS.teal }, amber: { bg: COLORS.amberSoft, fg: COLORS.amber },
    rose: { bg: COLORS.roseSoft, fg: COLORS.rose }, violet: { bg: COLORS.violetSoft, fg: COLORS.violet },
  };
  const t = tones[tone] || tones.neutral;
  return <span style={{ background: t.bg, color: t.fg }} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap">{children}</span>;
}
function StatusBadge({ status }) {
  if (!status) return <span className="text-xs" style={{ color: COLORS.inkSoft }}>—</span>;
  const tone = STATUS_TONE[status] || "neutral";
  const Icon = tone === "neutral" ? CheckCircle2 : tone === "rose" ? XCircle : Clock;
  return <Badge tone={tone}><Icon size={11} /> {status}</Badge>;
}
function IconBtn({ onClick, title, children, danger }) {
  return (
    <button onClick={onClick} title={title} className="p-1.5 rounded-md transition-colors" style={{ color: danger ? COLORS.rose : COLORS.inkSoft }}
      onMouseEnter={(e) => (e.currentTarget.style.background = danger ? COLORS.roseSoft : COLORS.sage)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
      {children}
    </button>
  );
}
function PrimaryButton({ onClick, children, type = "button", full, disabled }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 ${full ? "w-full" : ""}`}
      style={{ background: COLORS.teal, fontFamily: "Inter, sans-serif" }}>
      {children}
    </button>
  );
}
function Field({ label, children, required }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold mb-1" style={{ color: COLORS.inkSoft }}>{label} {required && <span style={{ color: COLORS.rose }}>*</span>}</span>
      {children}
    </label>
  );
}
const inputStyle = { border: `1px solid ${COLORS.line}`, background: COLORS.surface, color: COLORS.ink, fontFamily: "Inter, sans-serif" };
const inputClass = "w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 transition-shadow";
function TextInput(props) { return <input {...props} className={inputClass} style={{ ...inputStyle, ...(props.style || {}) }} onFocus={(e) => (e.target.style.boxShadow = `0 0 0 2px ${COLORS.teal}55`)} onBlur={(e) => (e.target.style.boxShadow = "none")} />; }
function TextArea(props) { return <textarea {...props} className={inputClass + " resize-none"} style={{ ...inputStyle, ...(props.style || {}) }} onFocus={(e) => (e.target.style.boxShadow = `0 0 0 2px ${COLORS.teal}55`)} onBlur={(e) => (e.target.style.boxShadow = "none")} />; }
function Select(props) { return <select {...props} className={inputClass} style={{ ...inputStyle, ...(props.style || {}) }} />; }
function Modal({ title, subtitle, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(22,48,43,0.45)" }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col`} style={{ background: COLORS.card }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
          <div>
            <h3 style={{ fontFamily: "Fraunces, serif", color: COLORS.ink }} className="text-lg font-semibold">{title}</h3>
            {subtitle && <p className="text-xs mt-0.5" style={{ color: COLORS.inkSoft }}>{subtitle}</p>}
          </div>
          <IconBtn onClick={onClose} title="Close"><X size={18} /></IconBtn>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
function EmptyState({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: COLORS.sage }}><Icon size={24} style={{ color: COLORS.teal }} /></div>
      <p style={{ fontFamily: "Fraunces, serif", color: COLORS.ink }} className="text-base font-semibold mb-1">{title}</p>
      <p className="text-sm mb-5" style={{ color: COLORS.inkSoft }}>{subtitle}</p>
      {action}
    </div>
  );
}
function ConfirmDialog({ message, onConfirm, onCancel, busy }) {
  return (
    <Modal title="Please confirm" onClose={onCancel}>
      <p className="text-sm mb-5" style={{ color: COLORS.inkSoft }}>{message}</p>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${COLORS.line}`, color: COLORS.ink }}>Cancel</button>
        <button onClick={onConfirm} disabled={busy} className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: COLORS.rose }}>
          {busy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </Modal>
  );
}
function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="mb-4 px-4 py-3 rounded-lg flex items-start gap-2 text-sm" style={{ background: COLORS.roseSoft, color: COLORS.rose }}>
      <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} className="font-semibold">✕</button>
    </div>
  );
}

/* ---------------------------------------------------------------
   Generic record form
------------------------------------------------------------------ */
function GenericForm({ module, initial, data, defaultValues, lockedFields, fkFilter, onSave, saving }) {
  const buildInitial = () => {
    const f = {};
    module.fields.forEach((field) => {
      f[field.name] = initial ? initial[field.db] ?? "" : defaultValues?.[field.name] ?? "";
    });
    return f;
  };
  const [form, setForm] = useState(buildInitial);
  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const required = module.fields.filter((f) => f.required);
    for (const f of required) if (!String(form[f.name] ?? "").trim()) return;
    const payload = {};
    module.fields.forEach((f) => {
      if (f.computed) return; // DB-generated column, never sent
      payload[f.db] = form[f.name] === "" ? null : form[f.name];
    });
    onSave(payload);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {module.fields.map((field) => {
        const locked = lockedFields?.includes(field.name);
        if (field.type === "fk") {
          const targetModule = MODULES_BY_KEY[field.module];
          let options = data[field.module] || [];
          if (fkFilter?.[field.name]) options = fkFilter[field.name](options);
          return (
            <Field key={field.name} label={field.name} required={field.required}>
              <Select value={form[field.name]} onChange={set(field.name)} required={field.required} disabled={locked}>
                <option value="">Select {field.name.replace(" ID", "")}...</option>
                {options.map((r) => <option key={r.id} value={r.id}>{recordLabel(targetModule, r)}</option>)}
              </Select>
              {options.length === 0 && <p className="text-xs mt-1" style={{ color: COLORS.amber }}>No {targetModule.label.toLowerCase()} available yet — add one first.</p>}
            </Field>
          );
        }
        if (field.type === "select") {
          return (
            <Field key={field.name} label={field.name} required={field.required}>
              <Select value={form[field.name]} onChange={set(field.name)} required={field.required} disabled={locked}>
                <option value="">Select...</option>
                {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </Select>
            </Field>
          );
        }
        if (field.type === "textarea") {
          return <Field key={field.name} label={field.name} required={field.required}><TextArea rows={2} value={form[field.name]} onChange={set(field.name)} required={field.required} disabled={locked} /></Field>;
        }
        if (field.computed) {
          const amt = parseFloat(form["Amount"]) || 0, disc = parseFloat(form["Discount"]) || 0, tax = parseFloat(form["Tax"]) || 0;
          return (
            <Field key={field.name} label={field.name}>
              <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: COLORS.sage }}>
                <span className="text-xs" style={{ color: COLORS.inkSoft }}>Auto-calculated by the database</span>
                <span style={{ fontFamily: "IBM Plex Mono, monospace", color: COLORS.ink }} className="text-sm font-semibold">{fmtMoney(amt - disc + tax)}</span>
              </div>
            </Field>
          );
        }
      if (field.type === "file") {
          return (
            <Field key={field.name} label={field.name}>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const url = await uploadPhoto(file);
                    setForm((f) => ({ ...f, [field.name]: url }));
                  } catch (err) {
                    alert("Upload failed: " + err.message);
                  }
                }}
                className="w-full text-sm"
              />
              {form[field.name] && (
                <img src={form[field.name]} alt="Preview" className="mt-2 rounded-lg max-h-40 object-cover" />
              )}
            </Field>
          );
        }
        if (field.type === "password") {
          return <Field key={field.name} label={field.name}><TextInput type="password" value={form[field.name]} onChange={set(field.name)} autoComplete="new-password" /></Field>;
        }
        return <Field key={field.name} label={field.name} required={field.required}><TextInput type={field.type} value={form[field.name]} onChange={set(field.name)} required={field.required} disabled={locked} /></Field>;
      })}
      <PrimaryButton type="submit" full disabled={saving}>
        {saving ? <Loader2 size={16} className="animate-spin" /> : null}
        {saving ? "Saving…" : initial ? "Save changes" : `Add ${module.label.replace(/s$/, "")}`}
      </PrimaryButton>
    </form>
  );
}

/* ---------------------------------------------------------------
   Generic module table view
------------------------------------------------------------------ */
function displayValue(module, fieldLabel, rec, data) {
  const fieldDef = module.fields.find((f) => f.name === fieldLabel);
  const raw = fieldDef ? rec[fieldDef.db] : rec[fieldLabel];
  if (raw === undefined || raw === "" || raw === null) return "—";
  if (fieldDef?.type === "fk") {
    const targetModule = MODULES_BY_KEY[fieldDef.module];
    const targetRec = (data[fieldDef.module] || []).find((r) => r.id === raw);
    return targetRec ? recordLabel(targetModule, targetRec) : "—";
  }
  if (fieldDef?.db === "net_amount" || fieldDef?.db === "amount") return fmtMoney(raw);
  if (fieldDef?.type === "date") return fmtDate(raw);
  return String(raw);
}

function GenericModuleView({ module, records, data, onAdd, onEdit, onDelete, onOpenFk, noDeps }) {
  const [search, setSearch] = useState("");
  const cols = module.listColumns || module.fields.slice(0, 4).map((f) => f.name);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => cols.some((c) => String(displayValue(module, c, r, data)).toLowerCase().includes(q)));
  }, [records, search, cols, module, data]);
  const Icon = module.icon;

  return (
    <div>
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: "Fraunces, serif", color: COLORS.ink }} className="text-2xl font-semibold">{module.label}</h1>
          <p style={{ color: COLORS.inkSoft }} className="text-sm mt-1">{records.length} record{records.length === 1 ? "" : "s"} on file</p>
        </div>
        {!module.readOnly && <PrimaryButton onClick={onAdd}><Plus size={16} /> Add {module.label.replace(/s$/, "")}</PrimaryButton>}
      </header>
      {!module.readOnly && (
        <div className="relative mb-5 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.inkSoft }} />
          <TextInput placeholder={`Search ${module.label.toLowerCase()}...`} value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: "32px" }} />
        </div>
      )}
      {noDeps ? (
        <EmptyState icon={Icon} title="Add a patient first" subtitle="This module links to a patient's chart." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Icon} title={records.length === 0 ? `No ${module.label.toLowerCase()} yet` : "No matches"}
          subtitle={records.length === 0 ? "Add your first record to get started." : "Try a different search term."}
          action={!module.readOnly && records.length === 0 ? <PrimaryButton onClick={onAdd}><Plus size={16} /> Add {module.label.replace(/s$/, "")}</PrimaryButton> : null} />
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }}>
          <div className="grid px-5 py-2.5 text-xs font-semibold" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr) 72px`, background: COLORS.surface, color: COLORS.inkSoft, borderBottom: `1px solid ${COLORS.line}` }}>
            {cols.map((c) => <span key={c} className="truncate">{c}</span>)}<span></span>
          </div>
          {filtered.map((r) => (
            <div key={r.id} className="grid items-center px-5 py-3 text-sm" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr) 72px`, borderBottom: `1px solid ${COLORS.line}` }}>
              {cols.map((c) => {
                const val = displayValue(module, c, r, data);
                const fieldDef = module.fields.find((f) => f.name === c);
                const isStatus = c === "Status";
                const isFk = fieldDef?.type === "fk";
                return (
                  <span key={c} className="truncate pr-2" style={{ color: COLORS.ink, fontFamily: fieldDef?.db === "net_amount" || fieldDef?.db === "amount" ? "IBM Plex Mono, monospace" : undefined }}>
                    {isStatus ? <StatusBadge status={r.status} /> : isFk && onOpenFk ? (
                      <button onClick={() => onOpenFk(fieldDef, r[fieldDef.db])} className="hover:underline text-left truncate" style={{ color: COLORS.teal }}>{val}</button>
                    ) : val}
                  </span>
                );
              })}
              <span className="flex items-center gap-0.5 justify-end">
                {!module.readOnly && (<><IconBtn onClick={() => onEdit(r)} title="Edit"><Edit2 size={14} /></IconBtn><IconBtn onClick={() => onDelete(r)} title="Delete" danger><Trash2 size={14} /></IconBtn></>)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   Patient chart
------------------------------------------------------------------ */
const CHART_MODULES = ["appointments", "consultations", "prescriptions", "laboratory", "billing", "payments", "clinicalphotos", "samples"];

function ChartSection({ title, icon: Icon, onAdd, empty, children, count }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="rounded-xl mb-5 overflow-hidden" style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }}>
      <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
        <h2 className="text-sm font-semibold inline-flex items-center gap-2" style={{ fontFamily: "Fraunces, serif", color: COLORS.ink }}>
          <Icon size={15} style={{ color: COLORS.teal }} /> {title} {count > 0 && <span className="text-xs font-normal" style={{ color: COLORS.inkSoft }}>({count})</span>}
        </h2>
        <button onClick={onAdd} className="text-xs font-semibold inline-flex items-center gap-1" style={{ color: COLORS.teal }}><Plus size={13} /> Add</button>
      </div>
      <div className="px-5">{hasChildren ? children : <p className="text-sm py-6 text-center" style={{ color: COLORS.inkSoft }}>{empty}</p>}</div>
    </div>
  );
}

function PatientDetail({ patient, data, onBack, onEditPatient, openAdd, openEdit, openDelete }) {
  return (
    <div>
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-medium mb-4" style={{ color: COLORS.teal }}><ChevronLeft size={16} /> All patients</button>
      <div className="rounded-xl p-5 mb-6 flex items-start justify-between" style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }}>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-semibold flex-shrink-0" style={{ background: hueFor(patient.id), fontFamily: "Fraunces, serif" }}>
            {initials(recordLabel(MODULES_BY_KEY.patients, patient))}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 style={{ fontFamily: "Fraunces, serif", color: COLORS.ink }} className="text-xl font-semibold">{recordLabel(MODULES_BY_KEY.patients, patient)}</h1>
              <span style={{ fontFamily: "IBM Plex Mono, monospace", color: COLORS.inkSoft }} className="text-xs">{patient.patient_id}</span>
            </div>
            <p style={{ color: COLORS.inkSoft }} className="text-sm mt-0.5">{[patient.age && `${patient.age} yrs`, patient.gender, patient.uhid && `UHID ${patient.uhid}`].filter(Boolean).join(" · ")}</p>
            <div className="flex flex-wrap gap-3 mt-2 text-xs" style={{ color: COLORS.inkSoft }}>
              {patient.mobile && <span className="inline-flex items-center gap-1"><Phone size={12} /> {patient.mobile}</span>}
              {patient.email && <span className="inline-flex items-center gap-1"><Mail size={12} /> {patient.email}</span>}
              {patient.city && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {[patient.city, patient.state].filter(Boolean).join(", ")}</span>}
              {patient.blood_group && <span className="inline-flex items-center gap-1"><Droplet size={12} /> {patient.blood_group}</span>}
            </div>
            <div className="mt-2"><StatusBadge status={patient.status} /></div>
          </div>
        </div>
        <IconBtn onClick={onEditPatient} title="Edit patient"><Edit2 size={16} /></IconBtn>
      </div>
      {CHART_MODULES.map((key) => {
        const module = MODULES_BY_KEY[key];
        const records = (data[key] || []).filter((r) => r.patient_id === patient.id);
        const sorted = [...records].sort((a, b) => (b.created_on || "").localeCompare(a.created_on || ""));
        return (
          <ChartSection key={key} title={module.label} icon={module.icon} onAdd={() => openAdd(key, patient)} count={sorted.length} empty={`No ${module.label.toLowerCase()} recorded.`}>
            {sorted.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2.5" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                <span style={{ fontFamily: "IBM Plex Mono, monospace", color: COLORS.inkSoft }} className="text-xs w-20 flex-shrink-0">{module.displayIdField && r[module.displayIdField]}</span>
                <span className="text-sm flex-1 truncate" style={{ color: COLORS.ink }}>
                  {(module.listColumns || []).filter((c) => c !== "Patient ID" && c !== "Status").slice(0, 2).map((c) => displayValue(module, c, r, data)).filter((v) => v !== "—").join(" · ") || recordLabel(module, r)}
                </span>
                <StatusBadge status={r.status} />
                <IconBtn onClick={() => openEdit(key, r)} title="Edit"><Edit2 size={14} /></IconBtn>
                <IconBtn onClick={() => openDelete(key, r)} title="Delete" danger><Trash2 size={14} /></IconBtn>
              </div>
            ))}
          </ChartSection>
        );
      })}
    </div>
  );
}

function PatientsList({ patients, search, setSearch, onAdd, onOpen, onEdit, onDelete }) {
  return (
    <div>
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: "Fraunces, serif", color: COLORS.ink }} className="text-2xl font-semibold">Patients</h1>
          <p style={{ color: COLORS.inkSoft }} className="text-sm mt-1">Every chart on file — search by name, ID, UHID, or phone.</p>
        </div>
        <PrimaryButton onClick={onAdd}><Plus size={16} /> New patient</PrimaryButton>
      </header>
      <div className="relative mb-5 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.inkSoft }} />
        <TextInput placeholder="Search patients..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: "32px" }} />
      </div>
      {patients.length === 0 ? (
        <EmptyState icon={Users} title="No patients yet" subtitle="Add your first patient to start building their chart." action={<PrimaryButton onClick={onAdd}><Plus size={16} /> New patient</PrimaryButton>} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {patients.map((p) => (
            <div key={p.id} className="rounded-xl p-4 flex items-center gap-3 cursor-pointer transition-shadow" style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }}
              onClick={() => onOpen(p)} onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 2px 10px rgba(22,48,43,0.07)")} onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0" style={{ background: hueFor(p.id), fontFamily: "Fraunces, serif" }}>{initials(recordLabel(MODULES_BY_KEY.patients, p))}</div>
              <div className="min-w-0 flex-1">
                <p style={{ color: COLORS.ink }} className="text-sm font-semibold truncate">{recordLabel(MODULES_BY_KEY.patients, p)}</p>
                <p style={{ color: COLORS.inkSoft }} className="text-xs truncate">{[p.patient_id, p.age && `${p.age} yrs`, p.mobile].filter(Boolean).join(" · ")}</p>
              </div>
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <IconBtn onClick={() => onEdit(p)} title="Edit"><Edit2 size={15} /></IconBtn>
                <IconBtn onClick={() => onDelete(p)} title="Delete" danger><Trash2 size={15} /></IconBtn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   Dashboard
------------------------------------------------------------------ */
function Dashboard({ data, goToPatient, setView }) {
  const patients = data.patients || [];
  const todaysAppts = (data.appointments || []).filter((a) => a.appointment_date === todayISO() && a.status !== "Cancelled").sort((a, b) => (a.appointment_time || "").localeCompare(b.appointment_time || ""));
  const unpaid = (data.billing || []).filter((b) => b.status !== "Paid").reduce((s, b) => s + (parseFloat(b.net_amount) || 0), 0);
  const activeProjects = (data.researchprojects || []).filter((p) => p.status === "Ongoing").length;
  const pendingLabs = (data.laboratory || []).filter((l) => l.status === "Pending").length;
  const patientById = (id) => patients.find((p) => p.id === id);
  const stats = [
    { label: "Patients on file", value: patients.length, icon: Users },
    { label: "Today's appointments", value: todaysAppts.length, icon: CalendarDays },
    { label: "Outstanding balance", value: fmtMoney(unpaid), icon: Receipt, mono: true },
    { label: "Pending lab results", value: pendingLabs, icon: FlaskConical },
    { label: "Active research projects", value: activeProjects, icon: Microscope },
  ];
  return (
    <div>
      <header className="mb-6">
        <h1 style={{ fontFamily: "Fraunces, serif", color: COLORS.ink }} className="text-2xl font-semibold">VCRS Clinic Suite</h1>
        <p style={{ color: COLORS.inkSoft }} className="text-sm mt-1">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
      </header>
      <div className="grid grid-cols-5 gap-3 mb-8">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl p-4" style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }}>
              <div className="flex items-center justify-between mb-3"><span className="text-xs font-medium" style={{ color: COLORS.inkSoft }}>{s.label}</span><Icon size={15} style={{ color: COLORS.teal }} /></div>
              <p style={{ fontFamily: s.mono ? "IBM Plex Mono, monospace" : "Fraunces, serif", color: COLORS.ink }} className="text-xl font-semibold">{s.value}</p>
            </div>
          );
        })}
      </div>
      <div className="rounded-xl overflow-hidden" style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
          <h2 style={{ fontFamily: "Fraunces, serif", color: COLORS.ink }} className="font-semibold text-sm">Today's queue</h2>
          <button onClick={() => setView("appointments")} className="text-xs font-semibold" style={{ color: COLORS.teal }}>View all</button>
        </div>
        {todaysAppts.length === 0 ? <p className="text-sm px-5 py-8 text-center" style={{ color: COLORS.inkSoft }}>Nothing on the books for today.</p> : (
          <ul>
            {todaysAppts.map((a) => {
              const p = patientById(a.patient_id);
              return (
                <li key={a.id} onClick={() => p && goToPatient(p)} className="px-5 py-3 flex items-center gap-3 cursor-pointer transition-colors" style={{ borderBottom: `1px solid ${COLORS.line}` }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.surface)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <span style={{ fontFamily: "IBM Plex Mono, monospace", color: COLORS.teal }} className="text-xs font-medium w-14">{a.appointment_time}</span>
                  <span className="text-sm flex-1 truncate" style={{ color: COLORS.ink }}>{p ? recordLabel(MODULES_BY_KEY.patients, p) : "Unknown patient"}</span>
                  <span className="text-xs truncate" style={{ color: COLORS.inkSoft, maxWidth: "160px" }}>{a.doctor}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Setup screen shown if env vars are missing
------------------------------------------------------------------ */
function SetupNeeded() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: COLORS.surface, fontFamily: "Inter, sans-serif" }}>
      <style>{FONT_IMPORT}</style>
      <div className="max-w-md rounded-2xl p-6" style={{ background: COLORS.card, border: `1px solid ${COLORS.line}` }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: COLORS.amberSoft }}><AlertCircle size={22} style={{ color: COLORS.amber }} /></div>
        <h1 style={{ fontFamily: "Fraunces, serif", color: COLORS.ink }} className="text-lg font-semibold mb-2">Connect your database</h1>
        <p className="text-sm mb-3" style={{ color: COLORS.inkSoft }}>This app needs two environment variables to connect to Supabase:</p>
        <ul className="text-xs font-mono mb-3 space-y-1" style={{ color: COLORS.ink }}>
          <li>VITE_SUPABASE_URL</li>
          <li>VITE_SUPABASE_ANON_KEY</li>
        </ul>
        <p className="text-sm" style={{ color: COLORS.inkSoft }}>Find both in your Supabase project → <strong>Settings → API</strong>. Add them in Vercel under Project → Settings → Environment Variables, then redeploy.</p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Main App
------------------------------------------------------------------ */
export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [data, setData] = useState({});
  const [view, setView] = useState("dashboard");
  const [activePatient, setActivePatient] = useState(null);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const reloadAll = useCallback(async () => {
    try {
      const entries = await Promise.all(MODULES.map(async (m) => [m.key, await fetchAll(m.table)]));
      setData(Object.fromEntries(entries));
      setLoadError("");
    } catch (e) {
      setLoadError(e.message || "Could not load data from Supabase.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { if (supabaseConfigured) reloadAll(); }, [reloadAll]);

  if (!supabaseConfigured) return <SetupNeeded />;

  const logAudit = useCallback(async (moduleLabel, action, description) => {
    try {
      const entry = await insertRow("audit_log", { module: moduleLabel, action, user: CURRENT_USER, description });
      setData((d) => ({ ...d, auditlog: [entry, ...(d.auditlog || [])] }));
    } catch (e) {
      // audit logging failure shouldn't block the main action
      console.error("audit log failed", e);
    }
  }, []);

  const saveRecord = useCallback(async (moduleKey, payload) => {
    const module = MODULES_BY_KEY[moduleKey];
    setSaving(true);
    setActionError("");
    try {
      const isEdit = !!modal?.initial;
      let record;
      if (isEdit) {
        const updatePayload = { ...payload };
        if (module.audit) { updatePayload.updated_on = todayISO(); updatePayload.updated_by = CURRENT_USER; }
        record = await updateRow(module.table, modal.initial.id, updatePayload);
      } else {
        const insertPayload = { ...payload };
        if (module.audit) { insertPayload.created_by = CURRENT_USER; insertPayload.updated_by = CURRENT_USER; }
        record = await insertRow(module.table, insertPayload);
      }
      setData((d) => {
        const list = d[moduleKey] || [];
        const newList = isEdit ? list.map((r) => (r.id === record.id ? record : r)) : [record, ...list];
        return { ...d, [moduleKey]: newList };
      });
      if (moduleKey === "patients" && activePatient?.id === record.id) setActivePatient(record);
      logAudit(module.label, isEdit ? "Updated" : "Created", recordLabel(module, record));
      setModal(null);
    } catch (e) {
      setActionError(e.message || "Something went wrong while saving.");
    } finally {
      setSaving(false);
    }
  }, [modal, activePatient, logAudit]);

  const deleteRecord = useCallback(async (moduleKey, record) => {
    const module = MODULES_BY_KEY[moduleKey];
    setDeleting(true);
    setActionError("");
    try {
      await deleteRow(module.table, record.id);
      setData((d) => {
        let next = { ...d, [moduleKey]: (d[moduleKey] || []).filter((r) => r.id !== record.id) };
        if (moduleKey === "patients") {
          CHART_MODULES.forEach((k) => { next[k] = (next[k] || []).filter((r) => r.patient_id !== record.id); });
        }
        return next;
      });
      logAudit(module.label, "Deleted", recordLabel(module, record));
      if (moduleKey === "patients" && activePatient?.id === record.id) setActivePatient(null);
      setConfirmDelete(null);
    } catch (e) {
      setActionError(e.message || "Could not delete this record — it may still be referenced elsewhere.");
    } finally {
      setDeleting(false);
    }
  }, [activePatient, logAudit]);

  const patients = data.patients || [];
  const filteredPatients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => recordLabel(MODULES_BY_KEY.patients, p).toLowerCase().includes(q) || p.patient_id?.toLowerCase().includes(q) || p.uhid?.toLowerCase().includes(q) || p.mobile?.includes(q));
  }, [patients, search]);

  const goToPatient = (p) => { setActivePatient(p); setView("patients"); };
  const openAdd = (moduleKey, patient) => {
    const module = MODULES_BY_KEY[moduleKey];
    const defaultValues = {}; const lockedFields = [];
    if (patient && module.fields.some((f) => f.name === "Patient ID")) { defaultValues["Patient ID"] = patient.id; lockedFields.push("Patient ID"); }
    setModal({ moduleKey, defaultValues, lockedFields });
  };
  const openEdit = (moduleKey, record) => setModal({ moduleKey, initial: record });
  const openDelete = (moduleKey, record) => {
    const module = MODULES_BY_KEY[moduleKey];
    const cascadeNote = moduleKey === "patients" ? " This also removes every linked appointment, consultation, prescription, lab result, bill, payment, photo, and sample." : "";
    setConfirmDelete({ message: `Delete this ${module.label.replace(/s$/, "").toLowerCase()} record?${cascadeNote}`, onConfirm: () => deleteRecord(moduleKey, record) });
  };
  const openFkTarget = (fieldDef, value) => {
    if (fieldDef.module === "patients") { const p = patients.find((pt) => pt.id === value); if (p) goToPatient(p); }
    else setView(fieldDef.module);
  };

  const NAV_GROUPS = CATEGORY_ORDER.map((cat) => ({ category: cat, items: MODULES.filter((m) => m.category === cat) }));

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: COLORS.surface }}>
        <style>{FONT_IMPORT}</style>
        <p style={{ color: COLORS.inkSoft, fontFamily: "Inter, sans-serif" }} className="text-sm inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading from Supabase…</p>
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.surface, fontFamily: "Inter, sans-serif", minHeight: "100vh" }} className="w-full flex">
      <style>{FONT_IMPORT}</style>
      <aside style={{ background: COLORS.tealDeep, width: "236px", flexShrink: 0 }} className="flex flex-col py-5 overflow-y-auto">
        <div className="px-5 mb-5 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: COLORS.teal }}><Stethoscope size={16} color="#fff" /></div>
          <div><p style={{ fontFamily: "Fraunces, serif", color: "#fff" }} className="text-sm font-semibold leading-tight">VCRS Suite</p><p style={{ color: "#9DBDB4" }} className="text-[11px]">Clinic &amp; research desk</p></div>
        </div>
        <nav className="flex-1 px-2 space-y-4">
          <button onClick={() => { setView("dashboard"); setActivePatient(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors" style={{ background: view === "dashboard" ? COLORS.teal : "transparent", color: view === "dashboard" ? "#fff" : "#B7D1C9" }}>
            <LayoutDashboard size={16} /> Dashboard
          </button>
          {NAV_GROUPS.map((g) => (
            <div key={g.category}>
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#5E8579" }}>{g.category}</p>
              <div className="space-y-1">
                {g.items.map((m) => {
                  const Icon = m.icon; const active = view === m.key;
                  return (
                    <button key={m.key} onClick={() => { setView(m.key); if (m.key !== "patients") setActivePatient(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors" style={{ background: active ? COLORS.teal : "transparent", color: active ? "#fff" : "#B7D1C9" }}>
                      <Icon size={16} /> {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="px-5 pt-4 mt-2" style={{ borderTop: "1px solid #1E4A41" }}>
          <p style={{ color: "#6F958A" }} className="text-[11px] leading-relaxed inline-flex items-center gap-1"><Lock size={11} /> Live on Supabase</p>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-6 overflow-y-auto">
        <ErrorBanner message={loadError || actionError} onDismiss={() => { setLoadError(""); setActionError(""); }} />

        {view === "dashboard" && <Dashboard data={data} goToPatient={goToPatient} setView={setView} />}
        {view === "patients" && !activePatient && (
          <PatientsList patients={filteredPatients} search={search} setSearch={setSearch} onAdd={() => setModal({ moduleKey: "patients" })} onOpen={goToPatient} onEdit={(p) => setModal({ moduleKey: "patients", initial: p })} onDelete={(p) => openDelete("patients", p)} />
        )}
        {view === "patients" && activePatient && (
          <PatientDetail patient={activePatient} data={data} onBack={() => setActivePatient(null)} onEditPatient={() => setModal({ moduleKey: "patients", initial: activePatient })} openAdd={openAdd} openEdit={openEdit} openDelete={openDelete} />
        )}
        {MODULES.filter((m) => m.key !== "patients").map((m) => view === m.key && (
          <GenericModuleView key={m.key} module={m} records={data[m.key] || []} data={data} onAdd={() => setModal({ moduleKey: m.key })} onEdit={(r) => openEdit(m.key, r)} onDelete={(r) => openDelete(m.key, r)} onOpenFk={openFkTarget}
            noDeps={m.fields.some((f) => f.type === "fk" && f.module === "patients") && patients.length === 0} />
        ))}
      </main>

      {modal && (
        <Modal title={modal.initial ? `Edit ${MODULES_BY_KEY[modal.moduleKey].label.replace(/s$/, "")}` : `New ${MODULES_BY_KEY[modal.moduleKey].label.replace(/s$/, "")}`} onClose={() => setModal(null)} wide={["billing", "prescriptions", "consultations"].includes(modal.moduleKey)}>
          <GenericForm module={MODULES_BY_KEY[modal.moduleKey]} initial={modal.initial} data={data} defaultValues={modal.defaultValues} lockedFields={modal.lockedFields}
            fkFilter={modal.moduleKey === "payments" && modal.defaultValues?.["Patient ID"] ? { "Bill ID": (opts) => opts.filter((b) => b.patient_id === modal.defaultValues["Patient ID"]) } : undefined}
            onSave={(payload) => saveRecord(modal.moduleKey, payload)} saving={saving} />
        </Modal>
      )}
      {confirmDelete && <ConfirmDialog message={confirmDelete.message} onConfirm={confirmDelete.onConfirm} onCancel={() => setConfirmDelete(null)} busy={deleting} />}
    </div>
  );
}
