import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import axios from "axios";
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
  DEFAULT_FORM,
  EMPTY_FORM,
  DEFAULT_EMAIL_TO,
  getDefaultHolidays,
  loadForm,
  saveForm,
  loadHolidays,
  saveHolidays,
} from "@/lib/rentDefaults";
import { calculeaza } from "@/lib/rcaCalc";
import { exportExcel } from "@/lib/exportExcel";
import {
  readPdfText,
  readHighlights,
  extractNc,
  extractPolita,
  classifyHighlights,
  terminateOcr,
} from "@/lib/pdfExtract";

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

const extractYearsFromForm = (form) =>
  Object.values(form || {})
    .filter((v) => typeof v === "string")
    .map((value) => {
      const iso = value.match(/^(\d{4})-\d{2}-\d{2}$/);
      if (iso) return Number(iso[1]);
      const ro = value.match(/^\d{2}\/\d{2}\/(\d{4})$/);
      if (ro) return Number(ro[1]);
      return null;
    })
    .filter((y) => Number.isInteger(y));

const formatHostForUrl = (host) => (host.includes(":") && !host.startsWith("[") ? `[${host}]` : host);

const resolveApiBaseUrl = () => {
  const backendBaseUrl = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
  if (backendBaseUrl) return backendBaseUrl;

  const browserHost = typeof window !== "undefined" ? window.location.hostname : "";
  const isLoopbackIpv4 = /^127(?:\.\d{1,3}){3}$/.test(browserHost);
  const isLocalHost =
    browserHost === "localhost" ||
    browserHost.endsWith(".localhost") ||
    isLoopbackIpv4 ||
    browserHost === "0.0.0.0" ||
    browserHost === "::1" ||
    browserHost === "0:0:0:0:0:0:0:1";
  if (!isLocalHost) return "";
  return `http://${formatHostForUrl(browserHost || "localhost")}:8000`;
};

const serializeHolidayList = (list) => JSON.stringify(list || []);

// Camp de data: input text dd/mm/yyyy + buton calendar (popover) pentru selectie.
function DateField({ id, value, onChange, testid }) {
  const [open, setOpen] = useState(false);
  const selected = ddmmyyyyToDate(value);
  return (
    <div className="relative">
      <Input
        id={id}
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
            aria-label="Deschide calendar"
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

function Section({ icon: Icon, title, children, action }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-xl border bg-card shadow-sm overflow-hidden"
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
      <div className="p-4">{children}</div>
    </motion.section>
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

export default function RentCalculator() {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const apiUrl = apiBaseUrl ? `${apiBaseUrl}/api` : null;

  const [form, setForm] = useState(loadForm);
  const [holidays, setHolidays] = useState([]);
  const [result, setResult] = useState(null);
  const [letter, setLetter] = useState("");
  const [emailTo, setEmailTo] = useState(DEFAULT_EMAIL_TO);
  const [dark, setDark] = useState(false);
  const [cuiLoading, setCuiLoading] = useState("");
  const [parsing, setParsing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileRef = useRef(null);
  const missingApiWarnedRef = useRef(false);
  const usingGeneratedHolidaysRef = useRef(false);
  const lastGeneratedHolidaysRef = useRef("[]");
  const formRef = useRef(form);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  const ensureApiConfigured = useCallback(() => {
    if (apiUrl) return true;
    if (!missingApiWarnedRef.current) {
      toast.error("API indisponibil: nu a putut fi determinat URL-ul backend.");
      missingApiWarnedRef.current = true;
    }
    return false;
  }, [apiUrl]);

  useEffect(() => {
    const resolveFallbackHolidays = () => getDefaultHolidays(extractYearsFromForm(formRef.current));
    const setGeneratedHolidays = (list) => {
      const serialized = serializeHolidayList(list);
      lastGeneratedHolidaysRef.current = serialized;
      setHolidays(list);
    };

    const local = loadHolidays(null);
    if (Array.isArray(local) && local.length > 0) {
      usingGeneratedHolidaysRef.current = false;
      setHolidays(local);
    } else {
      if (!ensureApiConfigured()) {
        usingGeneratedHolidaysRef.current = true;
        setGeneratedHolidays(resolveFallbackHolidays());
        return;
      }
      axios
        .get(`${apiUrl}/holidays`)
        .then((r) => {
          usingGeneratedHolidaysRef.current = false;
          setHolidays(r.data);
        })
        .catch(() => {
          usingGeneratedHolidaysRef.current = true;
          setGeneratedHolidays(resolveFallbackHolidays());
        });
    }
  }, [apiUrl, ensureApiConfigured]);

  useEffect(() => {
    if (!usingGeneratedHolidaysRef.current) return;
    const currentSerialized = serializeHolidayList(holidays);
    if (currentSerialized !== lastGeneratedHolidaysRef.current) {
      usingGeneratedHolidaysRef.current = false;
      return;
    }
    const regenerated = getDefaultHolidays(extractYearsFromForm(form));
    const regeneratedSerialized = serializeHolidayList(regenerated);
    if (regeneratedSerialized === currentSerialized) return;
    lastGeneratedHolidaysRef.current = regeneratedSerialized;
    setHolidays(regenerated);
  }, [form, holidays]);

  useEffect(() => {
    if (holidays.length) saveHolidays(holidays);
  }, [holidays]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const patch = (changes) => {
    const next = { ...form, ...changes };
    setForm(next);
    saveForm(next);
  };

  const set = (key) => (e) => patch({ [key]: e.target.value });

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
    const changes = {};
    const cuis = [];
    const numbers = [];
    const dates = [];
    let pagubitAddr = "";
    const filled = [];
    try {
      for (const file of files) {
        const name = file.name.toLowerCase();
        let text = "";
        try {
          text = await readPdfText(file);
        } catch (err) {
          toast.error(`Nu am putut citi ${file.name}`);
          continue;
        }
        const looksPolita = name.includes("polita") || /date given/i.test(text);
        const looksNc = name.includes("nc") || /dosar\s+daune/i.test(text);

        if (looksNc) {
          const nc = extractNc(text);
          if (nc.nr_dosar) { changes.nr_dosar = nc.nr_dosar; filled.push("nr dosar"); }
          if (nc.numar_inmatriculare) { changes.numar_inmatriculare = nc.numar_inmatriculare; filled.push("nr inmatriculare"); }
          if (nc.marca_model) { changes.marca_model = nc.marca_model; filled.push("marca/model"); }
          if (nc.nume_pagubit) { changes.nume_pagubit = nc.nume_pagubit; filled.push("nume pagubit"); }
          if (nc.data_eveniment) { changes.data_eveniment = nc.data_eveniment; filled.push("data eveniment"); }
          if (nc.data_avizare) { changes.data_avizare = nc.data_avizare; filled.push("data avizare/notificare"); }
        }
        if (looksPolita) {
          const pol = extractPolita(text);
          if (pol.data_emitere_rca) { changes.data_emitere_rca = pol.data_emitere_rca; filled.push("data emitere RCA"); }
        }
        // marcaje galbene -> CUI-uri, numere/date factura, adresa pagubit
        try {
          const hl = await readHighlights(file, { ocr: true });
          const cls = classifyHighlights(hl);
          cls.cuis.forEach((x) => cuis.push(x));
          cls.numbers.forEach((x) => numbers.push(x));
          cls.dates.forEach((x) => dates.push(x));
          if (!pagubitAddr && cls.addresses.length) pagubitAddr = cls.addresses[0];
        } catch (err) {
          /* fara highlight-uri sau PDF scanat fara strat de text */
        }
      }

      if (pagubitAddr) { changes.adresa_pagubit = pagubitAddr; filled.push("adresa pagubit"); }
      // CUI-uri in ordinea de citire: blocul reparatie primul, apoi rent (cesionar = reparator implicit)
      if (cuis[0]) { changes.cui_cesionar = cuis[0]; changes.rep_cui = cuis[0]; filled.push("CUI reparatie/cesionar"); }
      if (cuis[1]) { changes.rent_cui = cuis[1]; filled.push("CUI rent"); }
      // Facturi: nr+data reparatie (primul bloc), nr+data rent (al doilea bloc)
      if (numbers[0]) { changes.rep_factura_nr = numbers[0]; filled.push("nr factura reparatie"); }
      if (dates[0]) { changes.rep_factura_data = dates[0]; filled.push("data factura reparatie"); }
      if (numbers[1]) { changes.rent_factura_nr = numbers[1]; filled.push("nr factura rent"); }
      if (dates[1]) { changes.rent_factura_data = dates[1]; filled.push("data factura rent"); }

      if (Object.keys(changes).length) {
        patch(changes);
        toast.success(`Date culese din PDF: ${filled.join(", ")}.`);
      } else {
        toast.info("Nu am gasit campuri recunoscute in fisierele incarcate.");
      }
    } finally {
      terminateOcr().catch(() => {});
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ---------- Cautare CUI la ANAF ----------
  const lookupCui = async (cuiValue, target) => {
    const cui = String(cuiValue || "").trim();
    if (!cui) return toast.error("Introduceti un CUI.");
    if (!ensureApiConfigured()) return;
    setCuiLoading(target);
    try {
      const r = await axios.post(`${apiUrl}/cui-lookup`, { cui });
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
      const msg = e.response?.data?.detail || "Eroare la cautarea CUI.";
      toast.error(msg);
    } finally {
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
    setForm(DEFAULT_FORM);
    saveForm(DEFAULT_FORM);
    setResult(null);
    setLetter("");
    toast.success("Formular resetat la exemplul implicit.");
  };

  const clearForm = () => {
    const empty = { ...EMPTY_FORM, culpa_periods: [] };
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

  // subcomponent: rand facturat / acceptat / motivare
  const DiffRow = ({ label, unit, factKey, accKey, motivKey }) => (
    <div className="grid grid-cols-12 items-end gap-2 border-b py-2 last:border-0">
      <span className="col-span-12 text-xs font-medium sm:col-span-3">
        {label} {unit && <span className="text-muted-foreground">({unit})</span>}
      </span>
      <Input
        className="col-span-6 h-9 sm:col-span-2"
        inputMode="decimal"
        value={form[factKey] ?? ""}
        onChange={set(factKey)}
        placeholder="facturat"
        data-testid={`${factKey.replace(/_/g, "-")}-input`}
      />
      <Input
        className="col-span-6 h-9 border-primary/40 sm:col-span-2"
        inputMode="decimal"
        value={form[accKey] ?? ""}
        onChange={set(accKey)}
        placeholder="acceptat"
        data-testid={`${accKey.replace(/_/g, "-")}-input`}
      />
      <Input
        className="col-span-12 h-9 text-[11px] sm:col-span-5"
        value={form[motivKey] ?? ""}
        onChange={set(motivKey)}
        placeholder="motivare diferenta"
        data-testid={`${motivKey.replace(/_/g, "-")}-input`}
      />
    </div>
  );

  const CuiField = ({ label, cuiKey, nameKey, target, addrKey }) => (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-end gap-2">
        <Field label={label} id={cuiKey} className="flex-1">
          <Input id={cuiKey} value={form[cuiKey] ?? ""} onChange={set(cuiKey)} data-testid={`${cuiKey.replace(/_/g, "-")}-input`} />
        </Field>
        <Button
          type="button"
          variant="outline"
          className="h-9 gap-1.5"
          onClick={() => lookupCui(form[cuiKey], target)}
          disabled={cuiLoading === target}
          data-testid={`lookup-${target}-cui-button`}
        >
          <Search className="h-3.5 w-3.5" />
          {cuiLoading === target ? "..." : "ANAF"}
        </Button>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2">
        <Input value={form[nameKey] ?? ""} onChange={set(nameKey)} placeholder="Nume firma" data-testid={`${nameKey.replace(/_/g, "-")}-input`} />
        {addrKey && (
          <Input value={form[addrKey] ?? ""} onChange={set(addrKey)} placeholder="Adresa / localitate" data-testid={`${addrKey.replace(/_/g, "-")}-input`} />
        )}
      </div>
    </div>
  );

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
            <HolidayManager holidays={holidays} setHolidays={setHolidays} defaults={holidays} />
            <Button variant="outline" size="icon" onClick={() => setDark((d) => !d)} data-testid="theme-toggle-button" aria-label="Comuta tema">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        {!apiUrl && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm">
              API indisponibil: setează <code>REACT_APP_BACKEND_URL</code> și redeploy la frontend.
            </p>
          </div>
        )}
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* LEFT: form */}
          <div className="w-full space-y-5 lg:w-[60%]">
            {/* Numar dosar banner */}
            <div className="flex flex-col gap-2 rounded-xl border bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <Label htmlFor="nr_dosar" className="font-display text-sm font-semibold">Număr dosar</Label>
              <Input id="nr_dosar" value={form.nr_dosar} onChange={set("nr_dosar")} className="font-mono-num sm:max-w-xs" data-testid="nr-dosar-input" />
            </div>

            <Section icon={User} title="Date Păgubit">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Marca / Model" id="marca_model">
                  <Input id="marca_model" value={form.marca_model} onChange={set("marca_model")} data-testid="marca-model-input" />
                </Field>
                <Field label="Număr înmatriculare" id="numar_inmatriculare">
                  <Input id="numar_inmatriculare" value={form.numar_inmatriculare} onChange={set("numar_inmatriculare")} data-testid="numar-inmatriculare-input" />
                </Field>
                <Field label="Nume păgubit" id="nume_pagubit">
                  <Input id="nume_pagubit" value={form.nume_pagubit} onChange={set("nume_pagubit")} data-testid="nume-pagubit-input" />
                </Field>
                <Field label="Adresă păgubit" id="adresa_pagubit">
                  <Input id="adresa_pagubit" value={form.adresa_pagubit} onChange={set("adresa_pagubit")} data-testid="adresa-pagubit-input" />
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
              <CuiField label="CUI cesionar" cuiKey="cui_cesionar" nameKey="nume_cesionar" addrKey="adresa_cesionar" target="cesionar" />
            </Section>

            <Section icon={Receipt} title="Date Factură Reparație">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Număr factură" id="rep_factura_nr">
                  <Input id="rep_factura_nr" value={form.rep_factura_nr} onChange={set("rep_factura_nr")} data-testid="rep-factura-nr-input" />
                </Field>
                <Field label="Dată factură" id="rep_factura_data">
                  <DateField id="rep_factura_data" value={form.rep_factura_data} onChange={(v) => patch({ rep_factura_data: v })} testid="rep-factura-data-input" />
                </Field>
              </div>
              <div className="mt-4">
                <CuiField label="CUI emitent factură" cuiKey="rep_cui" nameKey="rep_emitent" addrKey="rep_localitate" target="rep" />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Valoare despăgubire facturată (lei)" id="valoare_desp_rep_facturata">
                  <Input id="valoare_desp_rep_facturata" inputMode="decimal" value={form.valoare_desp_rep_facturata} onChange={set("valoare_desp_rep_facturata")} data-testid="valoare-desp-rep-facturata-input" />
                </Field>
                <Field label="Preț oră manoperă facturat" id="ora_manopera_facturata">
                  <Input id="ora_manopera_facturata" inputMode="decimal" value={form.ora_manopera_facturata} onChange={set("ora_manopera_facturata")} data-testid="ora-manopera-facturata-input" />
                </Field>
                <Field label="Preț oră manoperă acceptat" id="ora_manopera_acceptata">
                  <Input id="ora_manopera_acceptata" inputMode="decimal" value={form.ora_manopera_acceptata} onChange={set("ora_manopera_acceptata")} data-testid="ora-manopera-acceptata-input" />
                </Field>
              </div>
            </Section>

            <Section icon={Wrench} title="Diferențe Despăgubire Reparație">
              <div className="mb-2 hidden grid-cols-12 gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
                <span className="col-span-3">Element</span>
                <span className="col-span-2">Facturat</span>
                <span className="col-span-2">Acceptat</span>
                <span className="col-span-5">Motivare diferență</span>
              </div>
              <DiffRow label="Piese" unit="lei" factKey="piese_facturat" accKey="piese_acceptat" motivKey="motivare_piese" />
              <DiffRow label="Materiale vopsitorie" unit="lei" factKey="materiale_facturat" accKey="materiale_vopsitorie_acceptat" motivKey="motivare_materiale" />
              <DiffRow label="Manoperă tinichigerie" unit="h" factKey="ore_tinichigerie_facturat" accKey="ore_tinichigerie" motivKey="motivare_tinichigerie" />
              <DiffRow label="Manoperă vopsitorie" unit="h" factKey="ore_vopsitorie_facturat" accKey="ore_vopsitorie" motivKey="motivare_vopsitorie" />
              <DiffRow label="Manoperă" unit="lei" factKey="manopera_facturat" accKey="manopera_acceptat" motivKey="motivare_manopera" />
              <div className="mt-3 flex items-center gap-3">
                <Field label="TVA (%)" id="tva_percent" className="w-32">
                  <Input id="tva_percent" inputMode="decimal" value={form.tva_percent} onChange={set("tva_percent")} data-testid="tva-percent-input" />
                </Field>
              </div>
              <Field label="Motivare reparatie (text scrisoare)" id="motivare_reparatie" className="mt-3">
                <Textarea id="motivare_reparatie" rows={2} value={form.motivare_reparatie} onChange={set("motivare_reparatie")} data-testid="motivare-reparatie-input" />
              </Field>
            </Section>

            <Section icon={Car} title="Date Factură Lipsă de Folosință (Rent)">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Număr factură" id="rent_factura_nr">
                  <Input id="rent_factura_nr" value={form.rent_factura_nr} onChange={set("rent_factura_nr")} data-testid="rent-factura-nr-input" />
                </Field>
                <Field label="Dată factură" id="rent_factura_data">
                  <DateField id="rent_factura_data" value={form.rent_factura_data} onChange={(v) => patch({ rent_factura_data: v })} testid="rent-factura-data-input" />
                </Field>
              </div>
              <div className="mt-4">
                <CuiField label="CUI emitent factură rent" cuiKey="rent_cui" nameKey="rent_emitent" addrKey="rent_localitate" target="rent" />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Valoare despăgubire facturată (lei)" id="valoare_desp_rent_facturata">
                  <Input id="valoare_desp_rent_facturata" inputMode="decimal" value={form.valoare_desp_rent_facturata} onChange={set("valoare_desp_rent_facturata")} data-testid="valoare-desp-rent-facturata-input" />
                </Field>
                <Field label="Zile facturate" id="zile_facturate" hint="Plafon maxim de zile">
                  <Input id="zile_facturate" inputMode="decimal" value={form.zile_facturate} onChange={set("zile_facturate")} data-testid="zile-facturate-input" />
                </Field>
                <Field label="Marca auto închiriat" id="auto_inchiriat_marca">
                  <Input id="auto_inchiriat_marca" value={form.auto_inchiriat_marca} onChange={set("auto_inchiriat_marca")} data-testid="auto-inchiriat-marca-input" />
                </Field>
                <Field label="Clasa auto închiriat" id="auto_inchiriat_clasa">
                  <Input id="auto_inchiriat_clasa" value={form.auto_inchiriat_clasa} onChange={set("auto_inchiriat_clasa")} data-testid="auto-inchiriat-clasa-input" />
                </Field>
                <Field label="Preț facturat / zi (lei)" id="pret_facturat">
                  <Input id="pret_facturat" inputMode="decimal" value={form.pret_facturat} onChange={set("pret_facturat")} data-testid="pret-facturat-input" />
                </Field>
                <Field label="Marca ofertă rentalcars" id="auto_oferta_marca">
                  <Input id="auto_oferta_marca" value={form.auto_oferta_marca} onChange={set("auto_oferta_marca")} data-testid="auto-oferta-marca-input" />
                </Field>
                <Field label="Preț ofertă / zi (lei)" id="pret_oferta">
                  <Input id="pret_oferta" inputMode="decimal" value={form.pret_oferta} onChange={set("pret_oferta")} data-testid="pret-oferta-input" />
                </Field>
                <Field label="Dată emitere RCA" id="data_emitere_rca" hint="Determină automat norma">
                  <DateField id="data_emitere_rca" value={form.data_emitere_rca} onChange={(v) => patch({ data_emitere_rca: v })} testid="data-emitere-rca-input" />
                </Field>
                <Field label="TVA etichetă" id="tva_label">
                  <Select value={form.tva_label} onValueChange={(v) => patch({ tva_label: v })}>
                    <SelectTrigger id="tva_label" data-testid="tva-label-select">
                      <SelectValue placeholder="Alege" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CU TVA" data-testid="tva-cu-option">CU TVA</SelectItem>
                      <SelectItem value="FĂRĂ TVA" data-testid="tva-fara-option">FĂRĂ TVA</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </Section>

            <Section icon={Calendar} title="Perioade & Cronologie">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Data avizării" id="data_avizare">
                  <DateField id="data_avizare" value={form.data_avizare} onChange={(v) => patch({ data_avizare: v })} testid="data-avizare-input" />
                </Field>
                <Field label="Data constatării" id="data_constatare">
                  <DateField id="data_constatare" value={form.data_constatare} onChange={(v) => patch({ data_constatare: v })} testid="data-constatare-input" />
                </Field>
                <Field label="Perioada rent - început" id="rent_start">
                  <DateField id="rent_start" value={form.rent_start} onChange={(v) => patch({ rent_start: v })} testid="rent-start-input" />
                </Field>
                <Field label="Perioada rent - sfârșit" id="rent_end">
                  <DateField id="rent_end" value={form.rent_end} onChange={(v) => patch({ rent_end: v })} testid="rent-end-input" />
                </Field>
                <Field label="Perioada reparație - început" id="rep_start">
                  <DateField id="rep_start" value={form.rep_start} onChange={(v) => patch({ rep_start: v })} testid="rep-start-input" />
                </Field>
                <Field label="Perioada reparație - sfârșit" id="rep_end">
                  <DateField id="rep_end" value={form.rep_end} onChange={(v) => patch({ rep_end: v })} testid="rep-end-input" />
                </Field>
              </div>

              <Separator className="my-4" />
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Perioade de culpă (opțional) — fiecare zi se adaugă integral; intersecțiile se numără o singură dată
                </p>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => addCulpa("reconstatare")} data-testid="add-reconstatare-button">
                    <Plus className="h-3 w-3" /> Reconstatare
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => addCulpa("comanda_piese")} data-testid="add-comanda-piese-button">
                    <Plus className="h-3 w-3" /> Comandă piese
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => addCulpa("antifrauda")} data-testid="add-antifrauda-button">
                    <Plus className="h-3 w-3" /> Antifraudă
                  </Button>
                </div>
              </div>

              {(form.culpa_periods || []).length === 0 ? (
                <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-4 text-center text-[11px] text-muted-foreground">
                  Nicio perioadă de culpă adăugată. Folosește butoanele de mai sus (Reconstatare 1, 2… / Comandă piese 1, 2… / Antifraudă 1, 2…).
                </p>
              ) : (
                <div className="space-y-3" data-testid="culpa-periods-list">
                  {(form.culpa_periods || []).map((p, idx, arr) => (
                    <div key={p.id} className="rounded-lg border bg-muted/20 p-3" data-testid={`culpa-period-row-${idx}`}>
                      <div className="mb-2 flex items-center justify-between">
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${CULPA_BADGE[p.type] || CULPA_BADGE.reconstatare}`}
                          data-testid={`culpa-period-label-${idx}`}
                        >
                          {culpaTypeName(p.type)} {culpaNumber(arr, idx)}
                        </span>
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeCulpa(p.id)} data-testid={`remove-culpa-period-${idx}`} aria-label="Sterge perioada">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="Început" id={`culpa_start_${idx}`}>
                          <DateField id={`culpa_start_${idx}`} value={p.start || ""} onChange={(v) => updateCulpa(p.id, "start", v)} testid={`culpa-start-input-${idx}`} />
                        </Field>
                        <Field label="Sfârșit" id={`culpa_end_${idx}`}>
                          <DateField id={`culpa_end_${idx}`} value={p.end || ""} onChange={(v) => updateCulpa(p.id, "end", v)} testid={`culpa-end-input-${idx}`} />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
