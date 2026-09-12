// Port 1:1 al calculului din backend/calc.py (rulat 100% in browser pentru GDPR).

function parseDate(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) {
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getFullYear() <= 1900 ? null : d;
  }
  if ((m = s.match(/^(\d{2})[.\/](\d{2})[.\/](\d{4})$/))) {
    const d = new Date(+m[3], +m[2] - 1, +m[1]);
    return d.getFullYear() <= 1900 ? null : d;
  }
  return null;
}

function toFloat(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? 0 : n;
}

const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
const round6 = (x) => Math.round((x + Number.EPSILON) * 1e6) / 1e6;
const money2 = (x) => x.toFixed(2);

function trim(x) {
  let s = x.toFixed(6);
  s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s === "" || s === "-0" ? "0" : s;
}

function fmtDate(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function* daterange(start, end) {
  const cur = new Date(start);
  while (cur <= end) {
    yield new Date(cur);
    cur.setDate(cur.getDate() + 1);
  }
}

export function detecteazaNorma(dataEmitereRca) {
  if (!dataEmitereRca) return "N18 dupa incetarea HG298";
  const d = dataEmitereRca;
  if (d <= new Date(2022, 8, 10)) return "N20";
  if (d <= new Date(2023, 3, 11)) return "N18";
  if (d <= new Date(2025, 5, 30)) return "HG298";
  return "N18 dupa incetarea HG298";
}

export function calculeaza(form) {
  const dosar = String(form.nr_dosar || "");
  const marcaPagubit = String(form.marca_pagubit || form.marca_model || "");
  const status = String(form.status_deplasare || "");

  const dataEmitereRca = parseDate(form.data_emitere_rca);
  const norma = detecteazaNorma(dataEmitereRca);

  const piese = toFloat(form.piese_acceptat);
  const materiale = toFloat(form.materiale_vopsitorie_acceptat);
  const manopera = toFloat(form.manopera_acceptat);
  const tva = toFloat(form.tva_percent);
  const bazaRep = piese + materiale + manopera;
  const valoareReparatie = round2(bazaRep + (tva * bazaRep) / 100);

  const oreTini = round2(toFloat(form.ore_tinichigerie));
  const oreVops = round2(toFloat(form.ore_vopsitorie));
  const oreTotal = round2(oreTini + oreVops);
  const zileReparatie = oreTotal > 0 ? Math.ceil(oreTotal / 4) : 0;

  const pretFacturat = toFloat(form.pret_facturat);
  const pretOferta = toFloat(form.pret_oferta);
  const tvaLabel = String(form.tva_label || "CU TVA");
  const zileFacturate = Math.trunc(toFloat(form.zile_facturate));

  const autoInchMarca = String(form.auto_inchiriat_marca || "");
  const autoInchClasa = String(form.auto_inchiriat_clasa || "");
  const autoOfertaMarca = String(form.auto_oferta_marca || "");

  const dataAvizare = parseDate(form.data_avizare);
  const dataConstatare = parseDate(form.data_constatare);
  const rentStart = parseDate(form.rent_start);
  const rentEnd = parseDate(form.rent_end);
  const repStart = parseDate(form.rep_start);
  const repEnd = parseDate(form.rep_end);

  // perioade de culpa dinamice
  const culpaPeriods = [];
  for (const p of form.culpa_periods || []) {
    const ps = parseDate(p.start);
    const pe = parseDate(p.end);
    const label = (String(p.label || "").trim()) || "culpa";
    if (ps && pe && pe >= ps) culpaPeriods.push({ label, start: ps, end: pe });
  }
  const zileCulpa = {};
  for (const p of culpaPeriods) {
    for (const d of daterange(p.start, p.end)) {
      const k = dayKey(d);
      if (!(k in zileCulpa)) zileCulpa[k] = p.label;
    }
  }

  const zileLibere = {};
  for (const h of form.holidays || []) {
    const hd = parseDate(h.date);
    if (hd) zileLibere[dayKey(hd)] = String(h.name || "sarbatoare legala");
  }

  const dayList = [];
  let zileRent = 0;
  let warning = "";

  if (rentStart && rentEnd && repStart && repEnd) {
    const startInt = new Date(Math.max(rentStart, repStart));
    const endInt = new Date(Math.min(rentEnd, repEnd));

    if (startInt <= endInt) {
      const multime = {};
      const order = [];
      const addSet = (d, tip) => {
        const k = dayKey(d);
        if (!(k in multime)) {
          multime[k] = { d: new Date(d), tip };
          order.push(k);
        }
      };
      if (dataAvizare && dataConstatare && (dataConstatare - dataAvizare) / 86400000 >= 1) {
        for (const d of daterange(dataAvizare, dataConstatare)) addSet(d, "avizare-constatare");
      }
      for (const d of daterange(startInt, endInt)) addSet(d, "intersectie");

      const keys = order.slice().sort((a, b) => multime[a].d - multime[b].d);
      let zileRepEfective = 0;
      for (const k of keys) {
        const { d, tip } = multime[k];
        if (tip === "avizare-constatare") {
          zileRent += 1;
          dayList.push({ date: fmtDate(d), label: "perioada avizare-constatare", type: "avizare" });
          continue;
        }
        if (k in zileCulpa) {
          zileRent += 1;
          dayList.push({ date: fmtDate(d), label: zileCulpa[k], type: "culpa" });
        } else if (k in zileLibere) {
          zileRent += 1;
          dayList.push({ date: fmtDate(d), label: zileLibere[k], type: "liber" });
        } else if (zileRepEfective < zileReparatie) {
          const wd = d.getDay(); // 0=Dum,6=Sam
          if (wd >= 1 && wd <= 5) {
            zileRent += 1;
            zileRepEfective += 1;
            dayList.push({ date: fmtDate(d), label: "reparatie", type: "reparatie" });
          } else {
            zileRent += 1;
            dayList.push({ date: fmtDate(d), label: "weekend", type: "weekend" });
          }
        }
      }

      if (zileFacturate > 0 && zileRent > zileFacturate) {
        warning = `Numarul calculat (${zileRent}) depaseste zilele facturate; limitat la ${zileFacturate}.`;
        zileRent = zileFacturate;
      }
    } else {
      warning = "Perioada rent si perioada reparatie nu se suprapun.";
    }
  } else {
    warning = "Completati perioadele de rent si reparatie pentru calcul.";
  }

  const ofertaMajorata = round6(pretOferta * 1.2);
  const sumaRent =
    ofertaMajorata < pretFacturat ? round2(pretOferta * zileRent) : round2(pretFacturat * zileRent);

  const rentTotal = rentStart && rentEnd ? Math.round((rentEnd - rentStart) / 86400000) : 0;
  const repTotal = repStart && repEnd ? Math.round((repEnd - repStart) / 86400000) : 0;

  // ---------- scrisoare ----------
  const motivareRep = String(form.motivare_reparatie || "").trim();
  const observatii = String(form.observatii || "").trim();
  const semnatura = String(form.semnatura || "").trim();

  const L = [];
  L.push("Salut!");
  L.push(`Rog acord plata dosar ${dosar} astfel:`);
  L.push(`Pentru reparatie suma de ${money2(valoareReparatie)} lei ${motivareRep}`.trimEnd());
  L.push(`Pentru inchiriere suma de ${trim(sumaRent)} lei cf. calculatie de mai jos:`);
  L.push("");
  L.push(`Calcul lipsa de folosinta dupa norma ${norma}, ${status}`);
  L.push("");
  if (dataAvizare) L.push(`Data AVIZARII: ${fmtDate(dataAvizare)}`);
  if (dataConstatare) L.push(`Data Constatarii: ${fmtDate(dataConstatare)}`);
  if (rentStart && rentEnd)
    L.push(`Perioada rent : ${fmtDate(rentStart)} - ${fmtDate(rentEnd)} total ${rentTotal} zile`);
  if (repStart && repEnd)
    L.push(`Perioada rep : ${fmtDate(repStart)} - ${fmtDate(repEnd)} total ${repTotal} zile`);
  for (const p of culpaPeriods) {
    const n = Math.round((p.end - p.start) / 86400000) + 1;
    L.push(`Perioada ${p.label} : ${fmtDate(p.start)} - ${fmtDate(p.end)} total ${n} zile`);
  }
  L.push(`Timp manopera tinichigerie : ${trim(oreTini)} h`);
  L.push(`Timp manopera vopsitorie : ${trim(oreVops)} h`);
  L.push(`TOTAL ORE MANOPERA : ${trim(oreTotal)} h`);
  L.push("");
  L.push(`ZILE INCHIRIERE DIN REPARATIE: ${trim(oreTotal)} h : 4 = ${zileReparatie} zile rotunjite la intreg`);
  L.push("");
  L.push("");
  for (const item of dayList) L.push(`• ${item.date} - ${item.label}`);
  L.push("");
  if (observatii) {
    L.push(observatii);
    L.push("");
  }
  L.push(`Au fost facturate : ${zileFacturate} zile`);
  L.push(`Auto avariat : ${marcaPagubit}`);
  L.push(
    `Auto inchiriat : ${autoInchMarca} ${autoInchClasa} clasei celui avariat la pretul de ` +
      `${money2(pretFacturat)} lei pe zi ${tvaLabel}`
  );
  L.push(`Auto oferta rentalcars: ${autoOfertaMarca} la pretul de ${trim(pretOferta)} lei pe zi ${tvaLabel}`);
  if (ofertaMajorata < pretFacturat) {
    L.push(`${trim(pretOferta)} + 20% = ${trim(ofertaMajorata)} < ${trim(pretFacturat)}`);
    L.push(
      `Propun instrumentarea dosarului ${dosar} ca abuz inchiriere si plata a ${zileRent} zile ` +
        `la pretul din oferta rentalcars de ${trim(pretOferta)} lei pe zi ${tvaLabel} cu un total de ${trim(sumaRent)} lei.`
    );
  } else {
    L.push(`${trim(pretOferta)} + 20% = ${trim(ofertaMajorata)} > ${trim(pretFacturat)}`);
    L.push(
      `Propun instrumentarea dosarului ${dosar} si plata a ${zileRent} zile ` +
        `la pretul din oferta facturata de ${trim(pretFacturat)} lei pe zi ${tvaLabel} cu un total de ${trim(sumaRent)} lei.`
    );
  }
  L.push("");
  L.push("");
  L.push("Multumesc !");
  if (semnatura) {
    L.push("");
    L.push("");
    L.push(semnatura);
  }

  return {
    zile_rent: zileRent,
    suma_rent: sumaRent,
    valoare_reparatie: valoareReparatie,
    norma,
    zile_reparatie: zileReparatie,
    ore_total: oreTotal,
    oferta_majorata: ofertaMajorata,
    abuz_pret: ofertaMajorata < pretFacturat,
    rent_total: rentTotal,
    rep_total: repTotal,
    day_list: dayList,
    letter_text: L.join("\n"),
    warning,
  };
}
