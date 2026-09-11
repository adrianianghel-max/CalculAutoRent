import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { toast } from "sonner";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { HolidayManager } from "@/components/HolidayManager";
import {
  DEFAULT_FORM,
  DEFAULT_EMAIL_TO,
  loadForm,
  saveForm,
  loadHolidays,
  saveHolidays,
} from "@/lib/rentDefaults";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TYPE_STYLES = {
  avizare: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
  reparatie: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  weekend: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700",
  culpa: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  liber: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-300 dark:border-fuchsia-900",
};

function Field({ label, id, children, hint }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-xl border bg-card shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-2.5 border-b bg-muted/40 px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="font-display text-sm font-semibold tracking-tight">{title}</h3>
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
  const [form, setForm] = useState(loadForm);
  const [holidays, setHolidays] = useState([]);
  const [result, setResult] = useState(null);
  const [letter, setLetter] = useState("");
  const [emailTo, setEmailTo] = useState(DEFAULT_EMAIL_TO);
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const local = loadHolidays(null);
    if (local) {
      setHolidays(local);
    } else {
      axios
        .get(`${API}/holidays`)
        .then((r) => setHolidays(r.data))
        .catch(() => setHolidays([]));
    }
  }, []);

  useEffect(() => {
    if (holidays.length) saveHolidays(holidays);
  }, [holidays]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const set = (key) => (e) => {
    const next = { ...form, [key]: e.target.value };
    setForm(next);
    saveForm(next);
  };

  const calcula = async () => {
    setLoading(true);
    try {
      const payload = {
        ...form,
        piese_acceptat: parseFloat(form.piese_acceptat) || 0,
        materiale_vopsitorie_acceptat: parseFloat(form.materiale_vopsitorie_acceptat) || 0,
        manopera_acceptat: parseFloat(form.manopera_acceptat) || 0,
        tva_percent: parseFloat(form.tva_percent) || 0,
        ore_tinichigerie: parseFloat(form.ore_tinichigerie) || 0,
        ore_vopsitorie: parseFloat(form.ore_vopsitorie) || 0,
        pret_facturat: parseFloat(form.pret_facturat) || 0,
        pret_oferta: parseFloat(form.pret_oferta) || 0,
        zile_facturate: parseFloat(form.zile_facturate) || 0,
        holidays,
      };
      const r = await axios.post(`${API}/calculate`, payload);
      setResult(r.data);
      setLetter(r.data.letter_text);
      if (r.data.warning) toast.warning(r.data.warning);
      else toast.success(`Calcul finalizat: ${r.data.zile_rent} zile aprobate.`);
    } catch (e) {
      toast.error("Eroare la calcul. Verifica datele introduse.");
      console.error(e);
    } finally {
      setLoading(false);
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
    const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(letter)}`;
    window.location.href = href;
  };

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    saveForm(DEFAULT_FORM);
    toast.success("Formular resetat la exemplul implicit.");
  };

  const money = (x) =>
    (x ?? 0).toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const economie = useMemo(() => {
    if (!result) return null;
    const solicitat = (parseFloat(form.zile_facturate) || 0) * (parseFloat(form.pret_facturat) || 0);
    return solicitat - result.suma_rent;
  }, [result, form]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <h1 className="font-display text-base font-bold tracking-tight sm:text-lg">
                Calcul Rent Auto RCA
              </h1>
              <p className="text-[11px] text-muted-foreground">
                Solicitare Acord Plata · Lipsa de folosinta
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <HolidayManager holidays={holidays} setHolidays={setHolidays} defaults={holidays} />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setDark((d) => !d)}
              data-testid="theme-toggle-button"
              aria-label="Comuta tema"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* LEFT: form */}
          <div className="w-full space-y-5 lg:w-[57%]">
            <Section icon={FileText} title="Date Dosar & Parte Vatamata">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Numar dosar" id="nr_dosar">
                  <Input id="nr_dosar" value={form.nr_dosar} onChange={set("nr_dosar")} data-testid="nr-dosar-input" />
                </Field>
                <Field label="Marca / Model auto avariat" id="marca_pagubit">
                  <Input id="marca_pagubit" value={form.marca_pagubit} onChange={set("marca_pagubit")} data-testid="marca-pagubit-input" />
                </Field>
                <Field label="Status deplasare" id="status_deplasare" hint="ex. NEDEPLASABIL / DEPLASABIL">
                  <Input id="status_deplasare" value={form.status_deplasare} onChange={set("status_deplasare")} data-testid="status-deplasare-input" />
                </Field>
                <Field label="Data emitere RCA" id="data_emitere_rca" hint="Determina automat norma aplicabila">
                  <Input id="data_emitere_rca" type="date" value={form.data_emitere_rca} onChange={set("data_emitere_rca")} data-testid="data-emitere-rca-input" />
                </Field>
              </div>
            </Section>

            <Section icon={Wrench} title="Reparatie & Ore Manopera">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Piese acceptat (lei)" id="piese_acceptat">
                  <Input id="piese_acceptat" inputMode="decimal" value={form.piese_acceptat} onChange={set("piese_acceptat")} data-testid="piese-acceptat-input" />
                </Field>
                <Field label="Materiale vopsitorie (lei)" id="materiale_vopsitorie_acceptat">
                  <Input id="materiale_vopsitorie_acceptat" inputMode="decimal" value={form.materiale_vopsitorie_acceptat} onChange={set("materiale_vopsitorie_acceptat")} data-testid="materiale-input" />
                </Field>
                <Field label="Manopera (lei)" id="manopera_acceptat">
                  <Input id="manopera_acceptat" inputMode="decimal" value={form.manopera_acceptat} onChange={set("manopera_acceptat")} data-testid="manopera-input" />
                </Field>
                <Field label="TVA (%)" id="tva_percent">
                  <Input id="tva_percent" inputMode="decimal" value={form.tva_percent} onChange={set("tva_percent")} data-testid="tva-percent-input" />
                </Field>
                <Field label="Ore tinichigerie" id="ore_tinichigerie">
                  <Input id="ore_tinichigerie" inputMode="decimal" value={form.ore_tinichigerie} onChange={set("ore_tinichigerie")} data-testid="ore-tinichigerie-input" />
                </Field>
                <Field label="Ore vopsitorie" id="ore_vopsitorie">
                  <Input id="ore_vopsitorie" inputMode="decimal" value={form.ore_vopsitorie} onChange={set("ore_vopsitorie")} data-testid="ore-vopsitorie-input" />
                </Field>
              </div>
              <Field label="Motivare reparatie (text scrisoare)" id="motivare_reparatie">
                <Textarea id="motivare_reparatie" rows={2} value={form.motivare_reparatie} onChange={set("motivare_reparatie")} className="mt-1" data-testid="motivare-reparatie-input" />
              </Field>
            </Section>

            <Section icon={Car} title="Date Lipsa de Folosinta (Rent-a-Car)">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Marca auto inchiriat" id="auto_inchiriat_marca">
                  <Input id="auto_inchiriat_marca" value={form.auto_inchiriat_marca} onChange={set("auto_inchiriat_marca")} data-testid="auto-inchiriat-marca-input" />
                </Field>
                <Field label="Clasa auto inchiriat" id="auto_inchiriat_clasa">
                  <Input id="auto_inchiriat_clasa" value={form.auto_inchiriat_clasa} onChange={set("auto_inchiriat_clasa")} data-testid="auto-inchiriat-clasa-input" />
                </Field>
                <Field label="Pret facturat / zi (lei)" id="pret_facturat">
                  <Input id="pret_facturat" inputMode="decimal" value={form.pret_facturat} onChange={set("pret_facturat")} data-testid="pret-facturat-input" />
                </Field>
                <Field label="Marca oferta rentalcars" id="auto_oferta_marca">
                  <Input id="auto_oferta_marca" value={form.auto_oferta_marca} onChange={set("auto_oferta_marca")} data-testid="auto-oferta-marca-input" />
                </Field>
                <Field label="Pret oferta / zi (lei)" id="pret_oferta">
                  <Input id="pret_oferta" inputMode="decimal" value={form.pret_oferta} onChange={set("pret_oferta")} data-testid="pret-oferta-input" />
                </Field>
                <Field label="TVA eticheta" id="tva_label">
                  <Input id="tva_label" value={form.tva_label} onChange={set("tva_label")} data-testid="tva-label-input" />
                </Field>
                <Field label="Zile facturate" id="zile_facturate" hint="Plafon maxim de zile">
                  <Input id="zile_facturate" inputMode="decimal" value={form.zile_facturate} onChange={set("zile_facturate")} data-testid="zile-facturate-input" />
                </Field>
              </div>
            </Section>

            <Section icon={Calendar} title="Perioade & Cronologie">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Data avizarii" id="data_avizare">
                  <Input id="data_avizare" type="date" value={form.data_avizare} onChange={set("data_avizare")} data-testid="data-avizare-input" />
                </Field>
                <Field label="Data constatarii" id="data_constatare">
                  <Input id="data_constatare" type="date" value={form.data_constatare} onChange={set("data_constatare")} data-testid="data-constatare-input" />
                </Field>
              </div>
              <Separator className="my-4" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Perioada rent - inceput" id="rent_start">
                  <Input id="rent_start" type="date" value={form.rent_start} onChange={set("rent_start")} data-testid="rent-start-input" />
                </Field>
                <Field label="Perioada rent - sfarsit" id="rent_end">
                  <Input id="rent_end" type="date" value={form.rent_end} onChange={set("rent_end")} data-testid="rent-end-input" />
                </Field>
                <Field label="Perioada reparatie - inceput" id="rep_start">
                  <Input id="rep_start" type="date" value={form.rep_start} onChange={set("rep_start")} data-testid="rep-start-input" />
                </Field>
                <Field label="Perioada reparatie - sfarsit" id="rep_end">
                  <Input id="rep_end" type="date" value={form.rep_end} onChange={set("rep_end")} data-testid="rep-end-input" />
                </Field>
              </div>
              <Separator className="my-4" />
              <p className="mb-3 text-xs font-medium text-muted-foreground">
                Perioade de culpa (optional) — se adauga integral la zilele de rent
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Reconstatare - inceput" id="rec1_start">
                  <Input id="rec1_start" type="date" value={form.rec1_start} onChange={set("rec1_start")} data-testid="rec1-start-input" />
                </Field>
                <Field label="Reconstatare - sfarsit" id="rec1_end">
                  <Input id="rec1_end" type="date" value={form.rec1_end} onChange={set("rec1_end")} data-testid="rec1-end-input" />
                </Field>
                <Field label="Comanda piese - inceput" id="rec2_start">
                  <Input id="rec2_start" type="date" value={form.rec2_start} onChange={set("rec2_start")} data-testid="rec2-start-input" />
                </Field>
                <Field label="Comanda piese - sfarsit" id="rec2_end">
                  <Input id="rec2_end" type="date" value={form.rec2_end} onChange={set("rec2_end")} data-testid="rec2-end-input" />
                </Field>
              </div>
            </Section>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={calcula}
                disabled={loading}
                size="lg"
                className="gap-2 shadow-md transition-transform active:scale-[0.98]"
                data-testid="calculeaza-rent-button"
              >
                <Calculator className="h-4 w-4" />
                {loading ? "Se calculeaza..." : "Calculeaza"}
              </Button>
              <Button variant="ghost" onClick={resetForm} className="gap-2 text-muted-foreground" data-testid="reset-form-button">
                <RotateCcw className="h-3.5 w-3.5" />
                Reseteaza formularul
              </Button>
            </div>
          </div>

          {/* RIGHT: results */}
          <div className="w-full lg:w-[43%]">
            <div className="sticky top-20 space-y-5">
              {!result ? (
                <div className="rounded-xl border border-dashed bg-card/50 p-10 text-center">
                  <Calculator className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="font-display text-sm font-semibold">Rezultatul apare aici</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Completeaza campurile si apasa <b>Calculeaza</b> pentru a genera solicitarea.
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
                      <span className="rounded-md bg-primary/10 px-2 py-1 font-medium text-primary">
                        Norma: {result.norma}
                      </span>
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

                  {/* Chronological table */}
                  <div className="rounded-xl border bg-card shadow-sm">
                    <div className="border-b px-4 py-3">
                      <h3 className="font-display text-sm font-semibold">
                        Cronologie zile ({result.day_list.length})
                      </h3>
                    </div>
                    <div className="max-h-80 overflow-y-auto p-3">
                      <div className="space-y-1.5" data-testid="cronologie-list">
                        {result.day_list.map((d, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 text-sm">
                            <span className="font-mono-num text-xs text-foreground/80">{d.date}</span>
                            <span
                              className={`rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize ${
                                TYPE_STYLES[d.type] || "bg-muted text-muted-foreground border-border"
                              }`}
                            >
                              {d.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Letter */}
                  <div className="rounded-xl border bg-card shadow-sm">
                    <div className="flex items-center justify-between border-b px-4 py-3">
                      <h3 className="font-display text-sm font-semibold">Text solicitare (editabil)</h3>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={copyLetter} data-testid="copy-solicitare-letter-button">
                          <Copy className="h-3.5 w-3.5" /> Copiaza
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
                      <Textarea
                        value={letter}
                        onChange={(e) => setLetter(e.target.value)}
                        rows={20}
                        className="font-mono-num text-xs leading-relaxed"
                        data-testid="letter-textarea"
                      />
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
