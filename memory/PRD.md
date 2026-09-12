# PRD — Calcul Rent Auto RCA (Solicitare Acord Plata)

## Problem Statement (original)
Inspector daune auto (Groupama) foloseste zilnic un Excel cu macro VBA ("Solicitare Acord Plata")
care calculeaza numarul zilelor de inchiriere auto (lipsa de folosinta) pe RCA in Romania si
genereaza textul unei solicitari de acord plata. Vrea o aplicatie web in cloud, accesibila de
oriunde, care sa reproduca acelasi calcul si sa arate ca o aplicatie profesionista.

## Architecture
- Frontend: React (CRA + craco), Tailwind, shadcn/ui, framer-motion, sonner. Single-page
  workspace (formular stanga / rezultate + scrisoare dreapta). Fonts: Outfit/Inter/JetBrains Mono.
- Backend: FastAPI, stateless. Logica de calcul portata 1:1 din macro-ul VBA (`calc.py`).
- Fara baza de date, fara autentificare (single-user, per cererea utilizatorului).
- Zile libere legale RO preincarcate (`holidays_ro.py`), editabile in UI (persistate in localStorage).

## User Persona
- Inspector daune auto care instrumenteaza dosare RCA si trimite solicitari de acord plata colegilor.

## Core Requirements (static)
- Reproducere exacta a calculului de zile rent din macro (intersectie rent∩reparatie, zile
  avizare-constatare, zile reparatie = ceil(ore/4), weekend-uri, zile culpa, zile libere legale,
  plafonare la zile facturate).
- Detectare automata norma dupa data emitere RCA (N20 / N18 / HG298 / N18 dupa incetarea HG298).
- Valoare reparatie = (piese+materiale+manopera) * (1+TVA/100).
- Logica abuz pret rent si formula suma (IF oferta*1.2 < facturat => oferta*zile, altfel facturat*zile).
- Generare text solicitare (identic cu output-ul Excel), editabil, cu copy-to-clipboard + mailto.

## Implemented (2026-06-12) — Migrare completa functii Excel + GDPR
- Perioade de culpa DINAMICE (Reconstatare/Comanda piese, numerotate automat, intersectii numarate o singura data).
- Formular RECONSTRUIT ca in Excel "Fisa de completat": banner Numar dosar, Date Pagubit
  (marca/model, nr inmatriculare, nume+adresa pagubit, data eveniment, data depunere CD, status,
  bloc Cesionar cu CUI+ANAF), Date Factura Reparatie (nr/data, CUI emitent+ANAF, valoare facturata,
  pret ora manopera), Diferente Despagubire Reparatie (facturat vs acceptat + motivare pe rand),
  Date Factura Lipsa Folosinta (rent), Perioade & Cronologie.
- GDPR: calculul + generarea scrisorii portate 1:1 in frontend (`src/lib/rcaCalc.js`); datele personale
  NU mai parasesc browserul. Backend pastreaza doar /api/holidays (static) si /api/cui-lookup (doar CUI public).
- Culege Date PDF: citire locala nc.pdf + polita (pdfjs-dist, worker local in public/), regex extrage
  nr dosar, nr inmatriculare, marca/model, nume pagubit, data eveniment, data notificare/avizare si
  data emitere RCA ("Date Given"). Extragere CUI-uri din marcaje galbene (highlight) in ordine.
- Cautare CUI la ANAF (API oficial v9) prin proxy backend -> completeaza nume+adresa+judet.
- Export PDF al scrisorii (jsPDF).
- Testat: backend 20/20, frontend 5/5 fluxuri (iteration_3.json). Paritate calcul JS vs Excel confirmata (15 zile / 5445 / 39347.19).

## Implemented (2026-06-11)
- POST /api/calculate + GET /api/holidays.
- Formular complet cu toate campurile din "Fisa de completat", preumplut cu exemplul din dosar.
- KPI-uri (zile aprobate, suma, valoare reparatie, economie), cronologie zi-cu-zi colorata,
  scrisoare editabila, copiere + deschidere client email, manager zile libere, dark mode, reset.
- Verificat: sample => 15 zile, 5445 lei, 39347.19 lei, 9 zile reparatie — identic cu Excel.
- Testat: 17/17 backend + frontend 100%.

## Implemented (2026-06-12)
- Perioade de culpa DINAMICE: butoane "+ Reconstatare" / "+ Comanda piese" adauga oricate
  randuri, numerotate automat per tip (Reconstatare 1,2.../Comanda piese 1,2...), fiecare cu
  data inceput/sfarsit si buton de stergere. Payload: `culpa_periods: [{label,start,end}]`.
- Fiecare zi dintr-o perioada de culpa se adauga integral la zilele de rent (ca vechiul rec1);
  perioadele care se intersecteaza se numara O SINGURA DATA (setdefault pe dict de zile).
- Scrisoarea listeaza "Perioada <label> : start - sfarsit total N zile" pentru fiecare perioada.
- calc.py/server.py refactorizate (eliminat rec1_*/rec2_*, adaugat model CulpaPeriod).
- Testat frontend 100% (iteration_2.json): add/remove/renumerotare, calcul, cronologie, overlap dedup.

## Backlog / Next (P1/P2)
- P1: Export PDF al solicitarii; salvare/istoric dosare (daca se doreste ulterior).
- P1: Trimitere email server-side (Resend/SendGrid) in loc de mailto.
- P2: Autentificare simpla daca aplicatia devine multi-user.
- P2: Import direct din fisierul Excel.

## Next Tasks
- Astept feedback pe wording/format scrisoare si eventuale cazuri suplimentare (culpa, HG298).
