# Ausschüttungsrechner – Prototyp

Nachbau und Erklärung eines Rechners für „monatliches Extra-Einkommen“ aus ausschüttenden
Fonds – als SPA in TypeScript, mit einer ausführlichen Theorieseite und getestetem Rechenkern.

Der Rechner läuft in **beide Richtungen**:

| Richtung | Eingabe | Ausgabe |
| --- | --- | --- |
| Anlagebetrag | gewünschtes Monatseinkommen | dafür nötiger Anlagebetrag |
| Einkommen | Anlagebetrag | daraus mögliches Monatseinkommen |

Beide sind mathematisch exakt zueinander invers – das wird im Testlauf über alle Fonds- und
Steuerkonstellationen geprüft.

## Kurzantwort auf die zwei Ausgangsfragen

1. **Wie funktioniert die Mathematik?** Der Anlagebetrag wird um den Ausgabeaufschlag bereinigt,
   mit der Ausschüttungsrendite multipliziert und durch zwölf geteilt; darauf wird die deutsche
   Kapitalertragsbesteuerung angewendet (Teilfreistellung → Freistellungsauftrag → Steuersatz –
   der Original-Rechner dreht die ersten beiden Schritte um, siehe Verifikation unten).
   Die zweite Richtung ist die Umkehrfunktion derselben Kette.
2. **Geht die Wertentwicklung ein?** Nein. In der Formel steht kein Performance-Parameter.
   Relevant ist ausschließlich die Ausschüttung je Anteil im Verhältnis zum Anteilwert.
   Der Kurs wirkt nur als Nenner dieser Rendite: Im verifizierten Referenzfall trägt der Fonds
   „3 % p. a.“ im Label, liefert auf den aktuellen Anteilpreis aber 2,8948 %.
   Was diese Vereinfachung verdeckt, steht in `theorie.html`, Abschnitt 6.

## Loslegen

```bash
npm install
npm run dev        # Entwicklungsserver (Rechner unter /index.html, Theorie unter /theorie.html)
npm test           # 119 Unit-Tests des Rechenkerns
npm run typecheck  # TypeScript im strict-Modus
npm run build      # Produktions-Build nach dist/
npm run artefakt   # Theorieseite als veröffentlichbare Fassung nach build/
```

Die Theorieseite ist mobil-first gestaltet (Lesefortschritt, tippbare Kapitelliste, Tabellen
scrollen in eigenen Containern) und funktioniert in hellem wie dunklem Theme.

## Aufbau

```
index.html            SPA – Formular, Ergebnis, Rechenweg
theorie.html          Theorieseite: Formeln, Herleitungen, Beispiele, Grenzen (standalone)
src/
  core/types.ts       Domänentypen (Fonds, Steuereinstellungen, Ergebnis)
  core/tax.ts         Teilfreistellung, Steuersätze, Netto↔Brutto (inkl. Umkehrformel)
  core/calculator.ts  beide Rechenrichtungen
  core/format.ts      deutsche Zahlformatierung und -eingabe
  data/funds.ts       neun FIKTIVE Fonds für die Simulation
  examples.ts         vier Beispielszenarien (UI-Buttons, Tests, Theorieseite)
  main.ts             UI-Logik (rechnet selbst nichts)
  styles.css
tests/                tax · calculator · roundtrip · allianz-referenz · prognosen ·
                      examples · format
scripts/artefakt.mjs  leitet aus theorie.html eine veröffentlichbare Fassung ab
```

Rechenkern und Oberfläche sind strikt getrennt: `src/main.ts` liest nur Formularwerte,
ruft `src/core/` und rendert. Alle Tests laufen ohne DOM.

## Das Modell

```
Anlagebetrag  →  investiertes Kapital  →  Bruttoausschüttung  →  Nettoausschüttung
                 (Ausgabeaufschlag)       (Ausschüttungsrendite)  (Steuern)
```

Abgebildet werden:

- **Ausschüttungsrendite** `r = (Ausschüttung je Anteil × Termine pro Jahr) ÷ Anteilwert`
- **Ausgabeaufschlag** in beiden gebräuchlichen Konventionen (`× (1+a)` bzw. `÷ (1−a)`);
  der Unterschied beträgt exakt `a² / (1−a²)`
- **Teilfreistellung** nach § 20 InvStG, getrennt für Privat- und Betriebsvermögen
- **Freistellungsauftrag** (Sparer-Pauschbetrag) in beiden Abzugsreihenfolgen: gesetzlich
  *nach* der Teilfreistellung (§ 20 Abs. 9 EStG, Standard) oder *davor* wie im Original-Rechner
- **Steuersatz**: Abgeltungsteuer + Soli + optionale Kirchensteuer mit der Minderungsformel
  `s = 1/(4+k) × (1 + 0,055 + k)`, im Betriebsvermögen der persönliche Satz

Die Umkehrung der Steuerformel ist stückweise linear mit einem Knick bei
`Bruttoausschüttung = Freistellungsauftrag ÷ (1 − Teilfreistellung)` (bzw. bei
`= Freistellungsauftrag` in der vereinfachten Reihenfolge); unterhalb davon gilt brutto = netto.
Die Oberfläche blendet diese Grenze als Hinweis ein.

## Fiktive Fonds

Alle neun Fonds sind **frei erfunden** – Namen, ISINs (`DE000FIKT…`), Anteilwerte und
Ausschüttungen. Sie decken bewusst alle Teilfreistellungsklassen (Aktien-, Misch-, Inlands- und
Auslandsimmobilien-, Rentenfonds) und alle Frequenzen (monatlich, quartalsweise, jährlich) ab.

Zwei Fonds (`meridian-sri-30-am`, `meridian-sri-75-am`) tragen die Kennzahlen aus den
Ergebnis-PDFs des Original-Rechners – einmal mit 15 %, einmal mit 30 % Teilfreistellung. Damit
reproduziert der Prototyp elf abgelesene Ausgaben **auf den Cent** – siehe unten.

## Verifikation gegen den Original-Rechner

Zwei Fonds derselben Familie, Stichtag 10.08.2026. Alle elf abgelesenen Werte werden auf den
Cent reproduziert:

| Fall | Original | Modell |
| --- | --- | --- |
| SRI 30 · 50 €/Monat, FSA 0 €, ohne Steuern | 21.555,98 € | 21.555,98 € |
| SRI 30 · 50 €/Monat, FSA 0 €, mit Steuern | 27.785,03 € | 27.785,03 € |
| SRI 30 · Bruttoausschüttung laut PDF | 773,38 € p. a. | 773,38 € p. a. |
| SRI 30 · 50 €/Monat, FSA 250 € | 25.189,59 € | 25.189,59 € |
| SRI 30 · 50 €/Monat, FSA 500 € | 22.594,15 € | 22.594,15 € |
| SRI 30 · 50 €/Monat, FSA 550 € | 22.075,06 € | 22.075,06 € |
| SRI 30 · 20.000 € Anlage, vor Steuern | 46,39 €/Monat | 46,39 €/Monat |
| SRI 75 · 50 €/Monat, FSA 0 €, ohne Steuern | 11.457,03 € | 11.457,03 € |
| SRI 75 · 50 €/Monat, FSA 0 €, mit Steuern | 14.051,24 € | 14.051,24 € |
| SRI 30 · 50 €/Monat, **Betriebsvermögen** | 21.555,98 € / 27.785,03 € | identisch zum Privatvermögen |

Ein zehnter Wert aus einer früheren Sitzung (21.508,83 €, gleicher Fonds, gleiche Einstellungen)
passt ebenfalls exakt – bei einem Anteilpreis von 104,93 € statt 105,16 €, also nach einem
Kurs-Update von 0,219 %.

Damit sind fünf Modellfragen entschieden:

1. **Ausgabeaufschlag** folgt `A = K × (1 + a)` — belegt bei 4 % und bei 5 %.
2. **Umkehrung der Steuerformel** stimmt exakt, bei zwei Teilfreistellungssätzen (15 % / 30 %).
3. **Ausschüttungsmechanik**: Das Ziel (3 % bzw. 6 % p. a.) wird Anfang Januar auf den
   Vorjahres-Schlusskurs bezogen und als fester Eurobetrag je Anteil fixiert. Fußnote 1 des
   Ergebnis-PDF bestätigt das wörtlich. Die laufende Rendite liegt entsprechend darunter:
   2,8948 % statt 3 % (SRI 30), 5,4988 % statt 6 % (SRI 75).
4. **Freistellungsauftrag**: Er wirkt nur mit dem teilfreigestellten Satz `(1 − tf) × s`, nicht
   mit `s`. Im 500-€-Fall kostet das 916 € zusätzliches Kapital (4,2 %).

5. **Betriebsvermögen**: Der Schalter ändert die Rechnung nicht — er deaktiviert nur das
   Freistellungsauftrag-Feld. Weiterhin 15 % Teilfreistellung und 26,375 %, nicht die
   30 % / persönlicher Satz nach § 20 InvStG. Passend dazu schreibt das PDF unter „Annahmen"
   ausdrücklich „Gilt für Anlagen im Privatvermögen".

Punkt 4 ist der bemerkenswerte. Entscheidend ist der 550-€-Fall: Dort deckt der
Freistellungsauftrag die teilfreigestellten 510 € vollständig ab, nach § 20 Abs. 9 EStG fiele
also *gar keine* Steuer an und der Rechner müsste zweimal dieselbe Zahl zeigen. Er zeigt aber
21.555,98 € / 22.075,06 €. Das schließt die gesetzliche Reihenfolge qualitativ aus.

Welche interne Implementierung dahintersteckt, lässt sich von außen nicht entscheiden — Abzug vor
der Teilfreistellung, Anrechnung gegen einen bereits reduzierten effektiven Satz oder
Teilfreistellung des Pauschbetrags selbst ergeben identische Zahlen. Es handelt sich um eine als
solche gekennzeichnete Marketing-Anzeige, die auf eine Vereinfachung beim Freistellungsauftrag
hinweist; die Abweichung geht in die konservative Richtung (mehr Kapital, nicht weniger).

## Tests

119 Tests in sieben Dateien:

- `tax.test.ts` – Steuersätze auf zwölf Nachkommastellen (26,3750 % / 27,8186 % / 27,9951 %),
  Teilfreistellungstabelle, Reihenfolge der Abzüge, Umkehrformel inklusive Knick und Monotonie
- `calculator.test.ts` – Vorwärtsrechnung mit handgerechneten Referenzwerten, beide
  Aufschlagkonventionen, Frequenzen, Randfälle, Fehlerbehandlung
- `roundtrip.test.ts` – Kreuztest über 9 Fonds × 6 Steuerkonstellationen × 2 Konventionen ×
  8 Beträge: beide Richtungen müssen exakt invers sein
- `allianz-referenz.test.ts` – pinnt die elf oben genannten Referenzwerte auf den Cent
- `prognosen.test.ts` – Vorhersagen zur Abzugsreihenfolge; drei davon inzwischen bestätigt
- `examples.test.ts` – Pinning der vier Beispielszenarien auf den Cent
- `format.test.ts` – deutsche Zahleneingabe und -ausgabe, inklusive Rundlauf

## Hinweis

Prototyp zu Demonstrationszwecken. Keine Anlage- oder Steuerberatung; die Steuermodellierung
ist bewusst vereinfacht (siehe `theorie.html`, Abschnitt 9 „Grenzen des Modells“).
