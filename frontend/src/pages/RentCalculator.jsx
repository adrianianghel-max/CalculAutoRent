import { RepairAudit } from "@/components/RepairAudit";
import { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import defaultHolidays from "@/lib/holidays.json";
import { motion } from "framer-motion";
import { toast } from "sonner";
import jsPDF from "jspdf";
import {
  FileText,
  Wrench,
  Car,
  Calendar,
  Calculator,
  Copy,
  Mail,
  Moon,
  Sun,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Plus,
  Trash2,
  Upload,
  FileDown,
  FileSpreadsheet,
  Search,
  User,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HolidayManager } from "@/components/HolidayManager";
import {
  EMPTY_FORM,
  DEFAULT_EMAIL_TO,
  saveForm,
  loadHolidays,
  saveHolidays,
} from "@/lib/rentDefaults";
import { calculeaza } from "@/lib/rcaCalc";
import { periodDays } from "@/lib/rentTable";
import { exportExcel } from "@/lib/exportExcel";
import { readPdfPages, terminateOcr } from "@/lib/pdfExtract";
import { automaticPdfChanges, PDF_FIELDS } from "@/lib/documentExtract";
import { loadLearningRules, saveLearningRules, learnSection, applyLearningRules, forgetSection } from "@/lib/pdfLearning";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const API = `${BACKEND_URL}/api`;

const TYPE_STYLES = {
  avizare: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
  reparatie: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  weekend: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700",
  culpa: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  liber: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-300 dark:border-fuchsia-900",
};

const CULPA_BADGE = {
  reconstatare: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
  comanda_piese: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  antifrauda: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
};

// Formateaza pe masura ce se tasteaza: cifre -> zz/ll/aaaa
const formatDateTyping = (v) => {
  const d = (v || "").replace(/\D/g, "").slice(0, 8);
  let out = d.slice(0, 2);
  if (d.length >= 3) out += "/" + d.slice(2, 4);
  if (d.length >= 5) out += "/" + d.slice(4, 8);
  return out;
};

const ddmmyyyyToDate = (s) => {
  const m = (s || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return undefined;
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  return isNaN(d.getTime()) ? undefined : d;
};

const dateToDdmmyyyy = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

// Camp de data: input text dd/mm/yyyy + buton calendar (popover) pentru selectie.
function DateField({ id, value, onChange, testid, label }) {
  const [open, setOpen] = useState(false);
  const selected = ddmmyyyyToDate(value);
  return (
    <div className="relative">
      <Input
        id={id}
        aria-label={label}
        value={value || ""}
        inputMode="numeric"
        placeholder="zz/ll/aaaa"
        maxLength={10}
        onChange={(e) => onChange(formatDateTyping(e.target.value))}
        data-testid={testid}
        className="pr-9"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={label ? `Calendar: ${label}` : "Deschide calendar"}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-primary"
            data-testid={`${testid}-calendar-trigger`}
          >
            <Calendar className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <CalendarPicker
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(d) => {
              if (d) {
                onChange(dateToDdmmyyyy(d));
                setOpen(false);
              }
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function Field({ label, id, children, hint, className }) {
  return (
    <div className={`space-y-1.5 ${className || ""}`}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

function Section({ icon: Icon, title, children, action, feedback, tone }) {
  const background = tone === "repair"
    ? "bg-green-50 dark:bg-green-950/30"
    : tone === "rent"
      ? "bg-green-100 dark:bg-green-900/40"
      : "bg-card";

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`rounded-xl border ${background} shadow-sm overflow-hidden`}
    >
      <div className="flex items-center justify-between gap-2.5 border-b bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <h3 className="font-display text-sm font-semibold tracking-tight">{title}</h3>
        </div>
        {action}
      </div>
      {feedback && <div className="border-b px-4 py-2 text-xs text-muted-foreground" role="status">{feedback}</div>}
      <div className="p-4">{children}</div>
    </motion.section>
  );
}

function RentRow({ label, fact, accepted, detail, testid }) {
  return (
    <tr className="border-b last:border-b-0" data-testid={testid}>
      <th scope="row" className="px-3 py-2 text-left text-sm font-medium">{label}</th>
      <td className="px-2 py-2 align-middle">{fact}</td>
      <td className="px-2 py-2 align-middle">{accepted}</td>
      <td className="px-2 py-2 align-middle text-sm">{detail}</td>
    </tr>
  );
}

function Kpi({ label, value, sub, accent, testid }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
      <p
        className={`font-mono-num mt-1 text-3xl font-extrabold tracking-tight ${accent || "text-foreground"}`}
        data-testid={testid}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

const toNum = (x) => {
  const v = parseFloat(String(x ?? "").replace(",", "."));
  return isNaN(v) ? 0 : v;
};
const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

function DiffRow({ label, unit, factValue, accValue, onFact, onAcc, readOnly, factTestid, accTestid }) {
  const cls = `col-span-6 h-9 sm:col-span-4 ${readOnly ? "bg-muted/60 font-semibold" : "border-primary/40"}`;
  return (
    <div className="grid grid-cols-12 items-center gap-2 border-b py-2 last:border-0">
      <span className="col-span-12 text-xs font-medium sm:col-span-4">
        {label}
        {unit && <span className="text-muted-foreground"> ({unit})</span>}
      </span>
      <Input className={cls} inputMode="decimal" value={factValue ?? ""} readOnly={readOnly} onChange={onFact ? (e) => onFact(e.target.value) : undefined} data-testid={factTestid} />
      <Input className={cls} inputMode="decimal" value={accValue ?? ""} readOnly={readOnly} onChange={onAcc ? (e) => onAcc(e.target.value) : undefined} data-testid={accTestid} />
    </div>
  );
}

function CuiField({ label, cuiKey, nameKey, addrKey, target, form, patch, lookupCui, cuiLoading }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-end gap-2">
        <Field label={label} id={cuiKey} className="flex-1">
          <Input id={cuiKey} value={form[cuiKey] ?? ""} onChange={(e) => patch({ [cuiKey]: e.target.value.toUpperCase() })} data-testid={`${cuiKey.replace(/_/g, "-")}-input`} />
        </Field>
        <Button type="button" variant="outline" className="h-9 gap-1.5" onClick={() => lookupCui(form[cuiKey], target)} disabled={Boolean(cuiLoading)} data-testid={`lookup-${target}-cui-button`}>
          <Search className="h-3.5 w-3.5" />
          {cuiLoading === target ? "..." : "ANAF"}
        </Button>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2">
        <Input value={form[nameKey] ?? ""} onChange={(e) => patch({ [nameKey]: e.target.value.toUpperCase() })} placeholder="Nume firma" data-testid={`${nameKey.replace(/_/g, "-")}-input`} />
        {addrKey && (
          <Input value={form[addrKey] ?? ""} onChange={(e) => patch({ [addrKey]: e.target.value.toUpperCase() })} placeholder="Adresa / localitate" data-testid={`${addrKey.replace(/_/g, "-")}-input`} />
        )}
      </div>
    </div>
  );
}

export default function RentCalculator() {
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, culpa_periods: [] }));
  const [holidays, setHolidays] = useState([]);
  const [result, setResult] = useState(null);
  const [letter, setLetter] = useState("");
  const [emailTo, setEmailTo] = useState(DEFAULT_EMAIL_TO);
  const [dark, setDark] = useState(false);
  const [cuiLoading, setCuiLoading] = useState("");
  const [parsing, setParsing] = useState(false);
  const [pdfProgress, setPdfProgress] = useState("");
  const [auditDocuments, setAuditDocuments] = useState([]);
  const pdfAbort = useRef(null);
  const pdfSession = useRef({ documents: [], baseline: {} });
  const formRef = useRef(form);
  formRef.current = form;
  const cuiRequest = useRef(null);
  const [learningRules, setLearningRules] = useState(() => loadLearningRules());
  const [learningFeedback, setLearningFeedback] = useState({});
  useEffect(() => () => { pdfAbort.current?.abort(); cuiRequest.current?.abort(); pdfSession.current = { documents: [], baseline: {} }; }, []);
  const [exporting, setExporting] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    const local = loadHolidays(null);
    if (local) {
      let updated = local;
      try {
        if (localStorage.getItem("rca_holidays_2027_v1") !== "done") {
          const dates = new Set(local.map(h => h.date));
          updated = [...local, ...defaultHolidays.filter(h => h.date.startsWith("2027-") && !dates.has(h.date))].sort((a, b) => a.date.localeCompare(b.date));
          saveHolidays(updated);
          localStorage.setItem("rca_holidays_2027_v1", "done");
        }
      } catch { /* browser storage unavailable */ }
      setHolidays(updated);
    } else if (!BACKEND_URL) {
      setHolidays(defaultHolidays);
    } else {
      axios
        .get(`${API}/holidays`)
        .then((r) => setHolidays(r.data))
        .catch(() => setHolidays(defaultHolidays));
    }
  }, []);

  useEffect(() => {
    if (holidays.length) saveHolidays(holidays);
  }, [holidays]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const patch = (changes) => {
    const next = { ...formRef.current, ...changes };
    formRef.current = next;
    setForm(next);
    saveForm(next);
  };

  const set = (key) => (e) => patch({ [key]: e.target.value });

  const enterNextField = (event) => {
    if (event.key !== "Enter" || event.defaultPrevented || event.nativeEvent.isComposing || event.ctrlKey || event.altKey || event.metaKey) return;
    const target = event.target;
    if (target.tagName !== "INPUT" || target.readOnly || ["button", "submit", "checkbox", "radio", "file"].includes(target.type)) return;
    if (target.closest('[role="dialog"], [role="listbox"]')) return;
    const fields = Array.from(event.currentTarget.querySelectorAll('input:not([type="hidden"]):not([type="file"]), select, button[role="combobox"], textarea')).filter(el => !el.disabled && !el.readOnly && el.tabIndex >= 0 && el.getClientRects().length > 0);
    const index = fields.indexOf(target);
    if (index < 0) return;
    event.preventDefault();
    fields[index + (event.shiftKey ? -1 : 1)]?.focus();
  };


  // ---------- perioade de culpa dinamice ----------
  const culpaTypeName = (type) =>
    type === "comanda_piese" ? "Comandă piese" : type === "antifrauda" ? "Antifraudă" : "Reconstatare";
  const culpaLabelPlain = (type) =>
    type === "comanda_piese" ? "comanda piese" : type === "antifrauda" ? "antifrauda" : "reconstatare";
  const culpaNumber = (list, idx) =>
    list.slice(0, idx + 1).filter((p) => p.type === list[idx].type).length;

  const addCulpa = (type) =>
    patch({
      culpa_periods: [
        ...(form.culpa_periods || []),
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, start: "", end: "" },
      ],
    });
  const updateCulpa = (id, key, value) =>
    patch({
      culpa_periods: (form.culpa_periods || []).map((p) => (p.id === id ? { ...p, [key]: value } : p)),
    });
  const removeCulpa = (id) =>
    patch({ culpa_periods: (form.culpa_periods || []).filter((p) => p.id !== id) });

  // ---------- calcul (100% in browser) ----------
  const calcula = () => {
    const culpa = (form.culpa_periods || [])
      .filter((p) => p.start && p.end)
      .map((p, idx, arr) => ({
        label: `${culpaLabelPlain(p.type)} ${arr.slice(0, idx + 1).filter((q) => q.type === p.type).length}`,
        start: p.start,
        end: p.end,
      }));
    const r = calculeaza({ ...form, culpa_periods: culpa, holidays });
    setResult(r);
    setLetter(r.letter_text);
    if (r.warning) toast.warning(r.warning);
    else toast.success(`Calcul finalizat: ${r.zile_rent} zile aprobate.`);
  };

  // ---------- Culege date din PDF (local, GDPR) ----------
  const onPickFiles = () => fileRef.current?.click();

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setParsing(true);
    pdfSession.current = { documents: [], baseline: {} };
    setAuditDocuments([]);
    setLearningFeedback({});
    const controller = new AbortController();
    pdfAbort.current = controller;
    const documents = [];
    try {
      for (const file of files) {
        if (controller.signal.aborted) break;
        try {
          const pages = await readPdfPages(file, {
            signal: controller.signal,
            onProgress: (message) => setPdfProgress(`${file.name} • ${message}`),
          });
          documents.push({ name: file.name, pages });
        } catch (error) {
          if (!controller.signal.aborted) toast.error(`Nu am putut citi ${file.name}. ${error.message || "Verifică PDF-ul."}`);
        }
      }
      if (!controller.signal.aborted) {
        const standard = automaticPdfChanges(documents);
        const learned = applyLearningRules(documents, loadLearningRules());
        const changes = { ...standard.changes, ...learned.changes };
        for (const field of learned.unresolved) delete changes[field];
        const unresolved = [...new Set([...standard.unresolved.filter(f => !(f in learned.changes)), ...learned.unresolved])];
        const next = { ...formRef.current, ...changes };
        formRef.current = next;
        pdfSession.current = { documents, baseline: { ...next } };
        setAuditDocuments(documents);
        if (Object.keys(changes).length) {
          setForm(next);
          setResult(null);
          setLetter("");
          toast.success(`${Object.keys(changes).length} câmpuri completate direct din PDF${Object.keys(learned.changes).length ? `, dintre care ${Object.keys(learned.changes).length} prin regulile învățate` : ""}.`);
        } else toast.info("Nu am găsit date certe de completat în documentele selectate.");
        if (unresolved.length) toast.warning(`Verifică manual: ${unresolved.map(k => PDF_FIELDS[k] || k).join(", ")}. Date neclare sau contradictorii.`, { duration: 10000 });
      }
    } finally {
      await terminateOcr().catch(() => {});
      pdfAbort.current = null;
      setParsing(false);
      setPdfProgress("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // Learned templates persist locally; source documents and manual examples stay in memory only.
  const learn = (section) => {
    if (!pdfSession.current.documents.length) return toast.info("Selectează întâi PDF-urile cu «Culege date PDF», apoi corectează câmpurile și apasă Învățare.");
    const outcome = learnSection(section, formRef.current, pdfSession.current.baseline, pdfSession.current.documents, learningRules);
    try {
      if (outcome.learned.length) {
        const saved = saveLearningRules(outcome.rules);
        setLearningRules(saved);
        for (const item of outcome.learned) pdfSession.current.baseline[item.field] = formRef.current[item.field];
      }
    } catch { return toast.error("Browserul nu permite salvarea regulilor. Nu am salvat învățarea; verifică setările de stocare."); }
    const lines = outcome.learned.map(item => `${PDF_FIELDS[item.field]}: regulă învățată din ${item.source}, pagina ${item.page}.`);
    lines.push(...outcome.skipped.map(item => `${PDF_FIELDS[item.field]}: ${item.reason}; nu am memorat o regulă.`));
    setLearningFeedback(previous => ({ ...previous, [section]: lines.length ? lines.join(" ") : "Nu există completări sau corecții noi în câmpurile care se extrag din documente. Valorile acceptate și calculate nu se învață." }));
    if (outcome.learned.length) toast.success(`${outcome.learned.length} reguli salvate în acest browser.`);
    else toast.info("Nu am putut învăța o regulă nouă. Vezi explicația din secțiune.");
  };
  const forgetLearning = (section) => {
    try {
      const saved = saveLearningRules(forgetSection(learningRules, section));
      setLearningRules(saved);
      setLearningFeedback(previous => ({ ...previous, [section]: "Regulile acestei secțiuni au fost șterse." }));
    } catch { toast.error("Nu am putut șterge regulile din browser."); }
  };
  const learningAction = (section) => {
    const count = learningRules.filter(rule => rule.section === section).length;
    return <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
      <Button type="button" variant="outline" size="sm" disabled={parsing} onClick={() => learn(section)} data-testid={`learn-${section}`} title="Învață din completările și corecțiile făcute după ultimul import PDF">Învățare{count > 0 ? ` (${count})` : ""}</Button>
      {count > 0 && <Button type="button" variant="ghost" size="sm" disabled={parsing} onClick={() => forgetLearning(section)} aria-label="Șterge regulile de învățare ale secțiunii" title="Șterge regulile acestei secțiuni" className="text-xs">Șterge reguli</Button>}
    </div>;
  };

  // ---------- Cautare CUI la ANAF ----------
  const lookupCui = async (cuiValue, target) => {
    if (cuiLoading) return;
    const cui = String(cuiValue || "").trim().replace(/^RO\s*/i, "");
    if (!/^[1-9]\d{1,9}$/.test(cui)) return toast.error("Introdu un CUI de 2–10 cifre, opțional precedat de RO.");
    const controller = new AbortController();
    cuiRequest.current = controller;
    setCuiLoading(target);
    try {
      const r = await axios.post(`${API}/cui-lookup`, { cui }, { timeout: 20000, signal: controller.signal });
      const cuiKey = target === "cesionar" ? "cui_cesionar" : `${target}_cui`;
      if (String(formRef.current[cuiKey] || "").trim().replace(/^RO\s*/i, "") !== cui) return toast.info("CUI-ul s-a schimbat în timpul căutării. Apasă din nou ANAF.");
      const { denumire, adresa, judet, localitate } = r.data;
      if (target === "cesionar") {
        patch({ nume_cesionar: denumire, adresa_cesionar: adresa || `${localitate}, ${judet}` });
      } else if (target === "rep") {
        patch({ rep_emitent: denumire, rep_localitate: localitate || judet });
      } else if (target === "rent") {
        patch({ rent_emitent: denumire, rent_localitate: localitate || judet });
      }
      toast.success(`ANAF: ${denumire}`);
    } catch (e) {
      if (controller.signal.aborted) return;
      const msg = e.response?.data?.detail || "Nu am putut contacta ANAF. Încearcă din nou; datele completate au rămas în formular.";
      toast.error(msg);
    } finally {
      cuiRequest.current = null;
      setCuiLoading("");
    }
  };

  // ---------- Export PDF ----------
  const exportPdf = () => {
    if (!letter) return toast.error("Genereaza mai intai calculul.");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    const width = doc.internal.pageSize.getWidth() - margin * 2;
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(letter, width);
    let y = margin;
    const lh = 12;
    lines.forEach((ln) => {
      if (y > pageH - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(ln, margin, y);
      y += lh;
    });
    doc.save(`Solicitare_${form.nr_dosar || "dosar"}.pdf`);
    toast.success("PDF descarcat.");
  };

  const exportXlsm = async () => {
    setExporting(true);
    try {
      await exportExcel(form, holidays);
      toast.success("Excel exportat (foaia „Fisa de completat”).");
    } catch (e) {
      toast.error(e.message || "Eroare la exportul Excel.");
    } finally {
      setExporting(false);
    }
  };

  const copyLetter = async () => {
    try {
      await navigator.clipboard.writeText(letter);
      toast.success("Textul solicitarii a fost copiat.");
    } catch (e) {
      toast.error("Nu s-a putut copia. Selecteaza manual textul.");
    }
  };

  const openMail = () => {
    const subject = `Solicitare despagubire, rog acord plata dosar dauna ${form.nr_dosar}`;
    const to = emailTo.replace(/;/g, ",");
    const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(letter)}`;
    window.location.href = href;
  };

  const resetForm = () => {
    pdfAbort.current?.abort();
    pdfAbort.current?.abort();
    cuiRequest.current?.abort();
    pdfSession.current = { documents: [], baseline: {} };
    setAuditDocuments([]);
    setLearningFeedback({});
    const empty = { ...EMPTY_FORM, culpa_periods: [] };
    formRef.current = empty;
    setForm(empty);
    saveForm(empty);
    setResult(null);
    setLetter("");
    toast.success("Formular golit.");
  };

  const clearForm = () => {
    pdfAbort.current?.abort();
    cuiRequest.current?.abort();
    pdfSession.current = { documents: [], baseline: {} };
    setAuditDocuments([]);
    setLearningFeedback({});
    const empty = { ...EMPTY_FORM, culpa_periods: [] };
    formRef.current = empty;
    setForm(empty);
    saveForm(empty);
    setResult(null);
    setLetter("");
    toast.success("Formular golit. Poți culege datele din PDF.");
  };

  const money = (x) =>
    (x ?? 0).toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const economie = useMemo(() => {
    if (!result) return null;
    const solicitat = (parseFloat(form.zile_facturate) || 0) * (parseFloat(form.pret_facturat) || 0);
    return solicitat - result.suma_rent;
  }, [result, form]);

  const setUpper = (key) => (e) => patch({ [key]: e.target.value.toUpperCase() });

  // valori calculate automat (diferente reparatie)
  const manoperaFact = round2(
    (toNum(form.ore_tinichigerie_facturat) + toNum(form.ore_vopsitorie_facturat)) * toNum(form.ora_manopera_facturata)
  );
  const manoperaAcc = round2(
    (toNum(form.ore_tinichigerie) + toNum(form.ore_vopsitorie)) * toNum(form.ora_manopera_acceptata)
  );
  const tvaP = toNum(form.tva_percent);
  const baseFact = toNum(form.piese_facturat) + toNum(form.materiale_facturat) + manoperaFact;
  const baseAcc = toNum(form.piese_acceptat) + toNum(form.materiale_vopsitorie_acceptat) + manoperaAcc;
  const valFact = round2(baseFact + (tvaP * baseFact) / 100);
  const valAcc = round2(baseAcc + (tvaP * baseAcc) / 100);

  useEffect(() => {
    const zf = toNum(form.zile_facturate);
    const pf = zf > 0 ? round2(toNum(form.valoare_desp_rent_facturata) / zf) : 0;
    const upd = {};
    if (String(manoperaFact) !== String(form.manopera_facturat)) upd.manopera_facturat = String(manoperaFact);
    if (String(manoperaAcc) !== String(form.manopera_acceptat)) upd.manopera_acceptat = String(manoperaAcc);
    if (String(valFact) !== String(form.valoare_desp_rep_facturata)) upd.valoare_desp_rep_facturata = String(valFact);
    if (String(pf) !== String(form.pret_facturat)) upd.pret_facturat = String(pf);
    if (Object.keys(upd).length) {
      const next = { ...form, ...upd };
      setForm(next);
      saveForm(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const rentSummary = useMemo(() => calculeaza({
    ...form,
    manopera_acceptat: String(manoperaAcc),
    pret_facturat: String(toNum(form.zile_facturate) > 0 ? round2(toNum(form.valoare_desp_rent_facturata) / toNum(form.zile_facturate)) : 0),
    culpa_periods: (form.culpa_periods || []).map((p) => ({ ...p, label: culpaTypeName(p.type) })),
    holidays,
  }), [form, holidays, manoperaAcc]);

  const tablePeriods = ["reconstatare", "comanda_piese", "antifrauda"].flatMap((type) => {
    const periods = (form.culpa_periods || []).filter((p) => p.type === type);
    return periods;
  });
  const editTablePeriod = (period, key, value) => {
    if (period.id) updateCulpa(period.id, key, value);
    else patch({ culpa_periods: [...(form.culpa_periods || []), { ...period, id: `${Date.now()}-${period.type}`, [key]: value }] });
  };
  const dayLabel = (start, end, inclusive = true) => {
    const days = periodDays(start, end, inclusive);
    return days === null ? "—" : `${days} ${days === 1 ? "zi" : "zile"}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <input ref={fileRef} type="file" accept="application/pdf" multiple className="hidden" onChange={onFiles} data-testid="pdf-file-input" />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <h1 className="font-display text-base font-bold tracking-tight sm:text-lg">Calcul Rent Auto RCA</h1>
              <p className="text-[11px] text-muted-foreground">Solicitare Acord Plata · Lipsa de folosinta</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={onPickFiles} disabled={parsing} className="gap-2" data-testid="culege-date-pdf-button">
              <Upload className="h-4 w-4" />
              {parsing ? "Se citește..." : "Culege Date PDF"}
            </Button>
            <HolidayManager holidays={holidays} setHolidays={setHolidays} defaults={defaultHolidays} />
            <Button variant="outline" size="icon" onClick={() => setDark((d) => !d)} data-testid="theme-toggle-button" aria-label="Comuta tema">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        <p className="mb-4 text-xs text-muted-foreground">Învățare: importă PDF-urile, corectează sau completează câmpurile, apoi apasă butonul secțiunii. Regulile se păstrează doar în acest browser; documentele și valorile personale nu sunt salvate ca exemple. Căutarea ANAF trimite doar CUI-ul firmei și data interogării.</p>
        {parsing && <div role="status" className="mb-4 rounded-lg border p-3 text-sm">{pdfProgress || "Citesc documentele local…"}<Button variant="outline" size="sm" className="ml-3" onClick={() => { pdfAbort.current?.abort(); setPdfProgress("Anulare după pagina curentă…"); }}>Anulează</Button></div>}
        <RepairAudit documents={auditDocuments} onPickFiles={onPickFiles} parsing={parsing} form={form} onApply={(changes) => { patch(changes); setResult(null); setLetter(""); }} />
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* LEFT: form */}
          <div className="w-full space-y-5 lg:w-[60%]" onKeyDown={enterNextField}>
            {/* Numar dosar banner */}
            <div className="flex flex-col gap-2 rounded-xl border bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <Label htmlFor="nr_dosar" className="font-display text-sm font-semibold">Număr dosar</Label>
              <Input id="nr_dosar" value={form.nr_dosar} onChange={setUpper("nr_dosar")} className="font-mono-num sm:max-w-xs" data-testid="nr-dosar-input" />
            </div>

            <Section icon={User} title="Date Păgubit" action={learningAction("pagubit")} feedback={learningFeedback.pagubit}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Marca / Model" id="marca_model">
                  <Input id="marca_model" value={form.marca_model} onChange={setUpper("marca_model")} data-testid="marca-model-input" />
                </Field>
                <Field label="Număr înmatriculare" id="numar_inmatriculare">
                  <Input id="numar_inmatriculare" value={form.numar_inmatriculare} onChange={setUpper("numar_inmatriculare")} data-testid="numar-inmatriculare-input" />
                </Field>
                <Field label="Nume păgubit" id="nume_pagubit">
                  <Input id="nume_pagubit" value={form.nume_pagubit} onChange={setUpper("nume_pagubit")} data-testid="nume-pagubit-input" />
                </Field>
                <Field label="Adresă păgubit" id="adresa_pagubit">
                  <Input id="adresa_pagubit" value={form.adresa_pagubit} onChange={setUpper("adresa_pagubit")} data-testid="adresa-pagubit-input" />
                </Field>
                <Field label="Dată eveniment" id="data_eveniment">
                  <DateField id="data_eveniment" value={form.data_eveniment} onChange={(v) => patch({ data_eveniment: v })} testid="data-eveniment-input" />
                </Field>
                <Field label="Dată depunere CD" id="data_depunere_cd">
                  <DateField id="data_depunere_cd" value={form.data_depunere_cd} onChange={(v) => patch({ data_depunere_cd: v })} testid="data-depunere-cd-input" />
                </Field>
                <Field label="Status deplasare (motivare)" id="status_deplasare" hint="Alege din listă" className="sm:col-span-2">
                  <Select value={form.status_deplasare} onValueChange={(v) => patch({ status_deplasare: v })}>
                    <SelectTrigger id="status_deplasare" data-testid="status-deplasare-select">
                      <SelectValue placeholder="Alege" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEDEPLASABIL" data-testid="status-nedeplasabil-option">NEDEPLASABIL</SelectItem>
                      <SelectItem value="DEPLASABIL" data-testid="status-deplasabil-option">DEPLASABIL</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Separator className="my-4" />
              <p className="mb-2 text-xs font-medium text-muted-foreground">Cesionar (în caz de cesiune creanță)</p>
              <CuiField label="CUI cesionar" cuiKey="cui_cesionar" nameKey="nume_cesionar" addrKey="adresa_cesionar" target="cesionar" form={form} patch={patch} lookupCui={lookupCui} cuiLoading={cuiLoading} />
            </Section>

            <Section icon={Receipt} title="Date Factură Reparație" action={learningAction("factura")} feedback={learningFeedback.factura} tone="repair">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Număr factură" id="rep_factura_nr">
                  <Input id="rep_factura_nr" value={form.rep_factura_nr} onChange={setUpper("rep_factura_nr")} data-testid="rep-factura-nr-input" />
                </Field>
                <Field label="Dată factură" id="rep_factura_data">
                  <DateField id="rep_factura_data" value={form.rep_factura_data} onChange={(v) => patch({ rep_factura_data: v })} testid="rep-factura-data-input" />
                </Field>
              </div>
              <div className="mt-4">
                <CuiField label="CUI emitent factură" cuiKey="rep_cui" nameKey="rep_emitent" addrKey="rep_localitate" target="rep" form={form} patch={patch} lookupCui={lookupCui} cuiLoading={cuiLoading} />
              </div>
            </Section>

            <Section icon={Wrench} title="Diferențe Despăgubire Reparație" action={learningAction("deviz")} feedback={learningFeedback.deviz} tone="repair">
              <div className="mb-2 hidden grid-cols-12 gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
                <span className="col-span-4">Element</span>
                <span className="col-span-4">Facturat</span>
                <span className="col-span-4">Acceptat</span>
              </div>
              <DiffRow label="Piese" unit="lei" factValue={form.piese_facturat} accValue={form.piese_acceptat} onFact={(v) => patch({ piese_facturat: v })} onAcc={(v) => patch({ piese_acceptat: v })} factTestid="piese-facturat-input" accTestid="piese-acceptat-input" />
              <DiffRow label="Materiale vopsitorie" unit="lei" factValue={form.materiale_facturat} accValue={form.materiale_vopsitorie_acceptat} onFact={(v) => patch({ materiale_facturat: v })} onAcc={(v) => patch({ materiale_vopsitorie_acceptat: v })} factTestid="materiale-facturat-input" accTestid="materiale-vopsitorie-acceptat-input" />
              <DiffRow label="Manoperă tinichigerie" unit="h" factValue={form.ore_tinichigerie_facturat} accValue={form.ore_tinichigerie} onFact={(v) => patch({ ore_tinichigerie_facturat: v })} onAcc={(v) => patch({ ore_tinichigerie: v })} factTestid="ore-tinichigerie-facturat-input" accTestid="ore-tinichigerie-input" />
              <DiffRow label="Manoperă vopsitorie" unit="h" factValue={form.ore_vopsitorie_facturat} accValue={form.ore_vopsitorie} onFact={(v) => patch({ ore_vopsitorie_facturat: v })} onAcc={(v) => patch({ ore_vopsitorie: v })} factTestid="ore-vopsitorie-facturat-input" accTestid="ore-vopsitorie-input" />
              <DiffRow label="Preț oră manoperă" unit="lei/h" factValue={form.ora_manopera_facturata} accValue={form.ora_manopera_acceptata} onFact={(v) => patch({ ora_manopera_facturata: v })} onAcc={(v) => patch({ ora_manopera_acceptata: v })} factTestid="ora-manopera-facturata-input" accTestid="ora-manopera-acceptata-input" />
              <DiffRow label="Manoperă (auto)" unit="lei" factValue={String(manoperaFact)} accValue={String(manoperaAcc)} readOnly factTestid="manopera-facturat-input" accTestid="manopera-acceptat-input" />
              <div className="my-3 flex items-center gap-3">
                <Field label="TVA (%)" id="tva_percent" className="w-32">
                  <Input id="tva_percent" inputMode="decimal" value={form.tva_percent} onChange={set("tva_percent")} data-testid="tva-percent-input" />
                </Field>
              </div>
              <DiffRow label="Valoare despăgubire (auto)" unit="lei" factValue={String(valFact)} accValue={String(valAcc)} readOnly factTestid="valoare-desp-rep-facturata-input" accTestid="valoare-desp-rep-acceptata-input" />
            </Section>

            <Section icon={Car} title="Date Factură Lipsă de Folosință (Rent)" action={learningAction("rent")} feedback={learningFeedback.rent} tone="rent">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Număr factură" id="rent_factura_nr">
                  <Input id="rent_factura_nr" value={form.rent_factura_nr} onChange={setUpper("rent_factura_nr")} data-testid="rent-factura-nr-input" />
                </Field>
                <Field label="Dată factură" id="rent_factura_data">
                  <DateField id="rent_factura_data" value={form.rent_factura_data} onChange={(v) => patch({ rent_factura_data: v })} testid="rent-factura-data-input" />
                </Field>
              </div>
              <div className="mt-4">
                <CuiField label="CUI emitent factură rent" cuiKey="rent_cui" nameKey="rent_emitent" addrKey="rent_localitate" target="rent" form={form} patch={patch} lookupCui={lookupCui} cuiLoading={cuiLoading} />
              </div>
              <Separator className="my-4" />
              <h4 className="mb-3 font-display text-sm font-semibold">Perioade & Cronologie</h4>
              <div className="overflow-x-auto rounded-lg border border-green-300 bg-white/30 dark:border-green-800 dark:bg-black/10">
                <table className="w-full min-w-[680px] table-fixed" data-testid="rent-periods-table">
                  <caption className="sr-only">Date rent și perioade: valori facturate și acceptate</caption>
                  <colgroup><col className="w-[30%]" /><col className="w-[25%]" /><col className="w-[25%]" /><col className="w-[20%]" /></colgroup>
                  <thead className="border-b border-green-300 bg-green-200/60 dark:border-green-800 dark:bg-green-800/40">
                    <tr>
                      <th scope="col" className="px-3 py-3 text-left text-sm"><span className="sr-only">Element</span></th>
                      <th scope="col" className="px-2 py-3 text-left text-sm font-semibold">VALOARE FACTURATĂ</th>
                      <th scope="col" className="px-2 py-3 text-left text-sm font-semibold">VALOARE ACCEPTATĂ</th>
                      <th scope="col" className="px-2 py-3 text-left text-sm"><span className="sr-only">Detalii</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    <RentRow label="VALOARE DESPĂGUBIRE" fact={<Input id="valoare_desp_rent_facturata" aria-label="Valoare despăgubire facturată (lei)" inputMode="decimal" value={form.valoare_desp_rent_facturata} onChange={set("valoare_desp_rent_facturata")} data-testid="valoare-desp-rent-facturata-input" />} accepted={<Input aria-label="Valoare despăgubire acceptată (lei)" value={money(rentSummary.suma_rent)} readOnly className="bg-white/40 font-semibold dark:bg-black/10" data-testid="valoare-desp-rent-acceptata-input" />} detail="lei" />
                    <RentRow label="ZILE DE ÎNCHIRIERE" fact={<Input id="zile_facturate" aria-label="Zile facturate" inputMode="decimal" value={form.zile_facturate} onChange={set("zile_facturate")} data-testid="zile-facturate-input" />} accepted={<Input aria-label="Zile acceptate" value={rentSummary.zile_rent.toFixed(2)} readOnly className="bg-white/40 font-semibold dark:bg-black/10" data-testid="zile-acceptate-input" />} detail={<span className="font-semibold text-primary" data-testid="rent-norma">{rentSummary.norma}</span>} />
                    <RentRow label="MARCA / NR AUTO ÎNCHIRIATĂ" fact={<Input id="auto_inchiriat_marca" aria-label="Marca / număr auto închiriat" value={form.auto_inchiriat_marca} onChange={setUpper("auto_inchiriat_marca")} data-testid="auto-inchiriat-marca-input" />} accepted={<Select value={form.auto_inchiriat_clasa} onValueChange={(v) => patch({ auto_inchiriat_clasa: v })}><SelectTrigger id="auto_inchiriat_clasa" aria-label="Clasa auto închiriat" data-testid="auto-inchiriat-clasa-input"><SelectValue placeholder="Alege" /></SelectTrigger><SelectContent>{["SIMILAR", "SUPERIOR", "INFERIOR", "DIFERIT"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>} detail={<div className="flex items-center gap-1"><Input id="pret_facturat" aria-label="Preț facturat pe zi" value={form.pret_facturat} readOnly className="px-2 bg-white/40 font-semibold dark:bg-black/10" data-testid="pret-facturat-input" /><span className="shrink-0 text-xs">lei/zi</span></div>} />
                    <RentRow label="MARCA / OFERTĂ RENT" fact={<Input id="auto_oferta_marca" aria-label="Marca ofertă rent" value={form.auto_oferta_marca} onChange={setUpper("auto_oferta_marca")} data-testid="auto-oferta-marca-input" />} detail={<div className="flex items-center gap-1"><Input id="pret_oferta" aria-label="Preț ofertă pe zi" inputMode="decimal" value={form.pret_oferta} onChange={set("pret_oferta")} className="px-2" data-testid="pret-oferta-input" /><span className="shrink-0 text-xs">lei/zi</span></div>} />
                    <RentRow label="DATA EMITERE RCA" fact={<DateField id="data_emitere_rca" label="Data emitere RCA" value={form.data_emitere_rca} onChange={(v) => patch({ data_emitere_rca: v })} testid="data-emitere-rca-input" />} detail={<Select value={form.tva_label} onValueChange={(v) => patch({ tva_label: v })}><SelectTrigger id="tva_label" aria-label="TVA etichetă" data-testid="tva-label-select"><SelectValue placeholder="Alege" /></SelectTrigger><SelectContent><SelectItem value="CU TVA" data-testid="tva-cu-option">CU TVA</SelectItem><SelectItem value="FĂRĂ TVA" data-testid="tva-fara-option">FĂRĂ TVA</SelectItem></SelectContent></Select>} />
                    <RentRow label="DATA AVIZARE" fact={<DateField id="data_avizare" label="Data avizare" value={form.data_avizare} onChange={(v) => patch({ data_avizare: v, data_constatare: v })} testid="data-avizare-input" />} />
                    <RentRow label="PERIOADA RENT" fact={<DateField id="rent_start" label="Perioada rent — început" value={form.rent_start} onChange={(v) => patch({ rent_start: v })} testid="rent-start-input" />} accepted={<DateField id="rent_end" label="Perioada rent — sfârșit" value={form.rent_end} onChange={(v) => patch({ rent_end: v })} testid="rent-end-input" />} detail={<span data-testid="rent-period-days">{dayLabel(form.rent_start, form.rent_end)}</span>} />
                    <RentRow label="PERIOADA REP" fact={<DateField id="rep_start" label="Perioada reparație — început" value={form.rep_start} onChange={(v) => patch({ rep_start: v })} testid="rep-start-input" />} accepted={<DateField id="rep_end" label="Perioada reparație — sfârșit" value={form.rep_end} onChange={(v) => patch({ rep_end: v })} testid="rep-end-input" />} detail={<span data-testid="rep-period-days">{dayLabel(form.rep_start, form.rep_end)}</span>} />
                    {tablePeriods.map((p, idx, arr) => {
                      const number = arr.slice(0, idx + 1).filter((q) => q.type === p.type).length;
                      const code = p.type === "reconstatare" ? "REC" : p.type === "comanda_piese" ? "CP" : "AF";
                      const formIndex = p.id ? form.culpa_periods.findIndex((q) => q.id === p.id) : `empty-${p.type}`;
                      const periodLabel = `${culpaTypeName(p.type)} ${number}`;
                      return <RentRow key={`${p.type}-${number}`} label={<span data-testid={`culpa-period-label-${formIndex}`}>PERIOADA {code}{number > 1 ? ` ${number}` : ""}</span>} testid={`culpa-period-row-${formIndex}`} fact={<DateField id={`culpa_start_${formIndex}`} label={`${periodLabel} — început`} value={p.start || ""} onChange={(v) => editTablePeriod(p, "start", v)} testid={`culpa-start-input-${formIndex}`} />} accepted={<DateField id={`culpa_end_${formIndex}`} label={`${periodLabel} — sfârșit`} value={p.end || ""} onChange={(v) => editTablePeriod(p, "end", v)} testid={`culpa-end-input-${formIndex}`} />} detail={<div className="flex items-center justify-between gap-1"><span>{dayLabel(p.start, p.end, true)}</span>{p.id && <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeCulpa(p.id)} data-testid={`remove-culpa-period-${formIndex}`} aria-label={`Șterge ${periodLabel}`}><Trash2 className="h-3.5 w-3.5" /></Button>}</div>} />;
                    })}
                    <RentRow label="DATA CONSTATĂRII" fact={<DateField id="data_constatare" label="Data constatării" value={form.data_constatare} onChange={(v) => patch({ data_constatare: v, data_avizare: v })} testid="data-constatare-input" />} />
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => addCulpa("reconstatare")} data-testid="add-reconstatare-button"><Plus className="h-3 w-3" /> Reconstatare</Button>
                <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => addCulpa("comanda_piese")} data-testid="add-comanda-piese-button"><Plus className="h-3 w-3" /> Comandă piese</Button>
                <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => addCulpa("antifrauda")} data-testid="add-antifrauda-button"><Plus className="h-3 w-3" /> Antifraudă</Button>
              </div>
            </Section>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={calcula} size="lg" className="gap-2 shadow-md transition-transform active:scale-[0.98]" data-testid="calculeaza-rent-button">
                <Calculator className="h-4 w-4" /> Calculează
              </Button>
              <Button onClick={exportXlsm} size="lg" variant="outline" disabled={exporting} className="gap-2" data-testid="export-excel-button">
                <FileSpreadsheet className="h-4 w-4" /> {exporting ? "Se exportă..." : "Export Excel (Fișă)"}
              </Button>
              <Button variant="ghost" onClick={resetForm} className="gap-2 text-muted-foreground" data-testid="reset-form-button">
                <RotateCcw className="h-3.5 w-3.5" /> Resetează formularul
              </Button>
              <Button variant="ghost" onClick={clearForm} className="gap-2 text-muted-foreground" data-testid="clear-form-button">
                <Trash2 className="h-3.5 w-3.5" /> Golește formular
              </Button>
            </div>
          </div>

          {/* RIGHT: results */}
          <div className="w-full lg:w-[40%]">
            <div className="sticky top-20 space-y-5">
              {!result ? (
                <div className="rounded-xl border border-dashed bg-card/50 p-10 text-center">
                  <Calculator className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="font-display text-sm font-semibold">Rezultatul apare aici</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Completează câmpurile și apasă <b>Calculează</b> pentru a genera solicitarea.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Kpi label="Zile aprobate" value={result.zile_rent} accent="text-primary" testid="total-zile-rent-result" />
                    <Kpi label="Suma de plata" value={`${money(result.suma_rent)}`} sub="lei" accent="text-primary" testid="total-suma-ron-result" />
                    <Kpi label="Valoare reparatie" value={money(result.valoare_reparatie)} sub="lei" testid="valoare-reparatie-result" />
                    <Kpi
                      label="Economie vs. solicitat"
                      value={money(economie)}
                      sub="lei"
                      accent={economie > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}
                      testid="economie-result"
                    />
                  </div>

                  <div className="rounded-xl border bg-card p-4 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-md bg-primary/10 px-2 py-1 font-medium text-primary">Norma: {result.norma}</span>
                      <span className="rounded-md bg-muted px-2 py-1 font-medium text-muted-foreground">
                        Zile din reparatie: {result.zile_reparatie} ({result.ore_total} h : 4)
                      </span>
                      {result.abuz_pret && (
                        <span className="flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                          <AlertTriangle className="h-3 w-3" /> Abuz inchiriere
                        </span>
                      )}
                    </div>
                  </div>

                  {result.warning && (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{result.warning}</span>
                    </div>
                  )}

                  <div className="rounded-xl border bg-card shadow-sm">
                    <div className="border-b px-4 py-3">
                      <h3 className="font-display text-sm font-semibold">Cronologie zile ({result.day_list.length})</h3>
                    </div>
                    <div className="max-h-80 overflow-y-auto p-3">
                      <div className="space-y-1.5" data-testid="cronologie-list">
                        {result.day_list.map((d, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 text-sm">
                            <span className="font-mono-num text-xs text-foreground/80">{d.date}</span>
                            <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize ${TYPE_STYLES[d.type] || "bg-muted text-muted-foreground border-border"}`}>
                              {d.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-card shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                      <h3 className="font-display text-sm font-semibold">Text solicitare (editabil)</h3>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={copyLetter} data-testid="copy-solicitare-letter-button">
                          <Copy className="h-3.5 w-3.5" /> Copiază
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={exportPdf} data-testid="export-pdf-button">
                          <FileDown className="h-3.5 w-3.5" /> Export PDF
                        </Button>
                        <Button size="sm" className="gap-1.5" onClick={openMail} data-testid="open-email-client-button">
                          <Mail className="h-3.5 w-3.5" /> Email
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-3 p-4">
                      <Field label="Destinatari email" id="email_to">
                        <Input id="email_to" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} data-testid="email-to-input" />
                      </Field>
                      <Textarea value={letter} onChange={(e) => setLetter(e.target.value)} rows={20} className="font-mono-num text-xs leading-relaxed" data-testid="letter-textarea" />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
