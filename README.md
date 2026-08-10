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
npm test           # 96 Unit-Tests des Rechenkerns
npm run typecheck  # TypeScript im strict-Modus
npm run build      # Produktions-Build nach dist/
```

## Aufbau

```
index.html            SPA – Formular, Ergebnis, Rechenweg
theorie.html          Theorieseite: Formeln, Herleitungen, Beispiele, Grenzen (standalone)
src/
  core/types.ts       Domänentypen (Fonds, Steuereinstellungen, Ergebnis)
  core/tax.ts         Teilfreistellung, Steuersätze, Netto↔Brutto (inkl. Umkehrformel)
  core/calculator.ts  beide Rechenrichtungen
  core/format.ts      deutsche Zahlformatierung und -eingabe
  data/funds.ts       acht FIKTIVE Fonds für die Simulation
  examples.ts         vier Beispielszenarien (UI-Buttons, Tests, Theorieseite)
  main.ts             UI-Logik (rechnet selbst nichts)
  styles.css
tests/                tax · calculator · roundtrip · allianz-referenz · examples · format
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

Alle acht Fonds sind **frei erfunden** – Namen, ISINs (`DE000FIKT…`), Anteilwerte und
Ausschüttungen. Sie decken bewusst alle Teilfreistellungsklassen (Aktien-, Misch-, Inlands- und
Auslandsimmobilien-, Rentenfonds) und alle Frequenzen (monatlich, quartalsweise, jährlich) ab.

Ein Fonds (`meridian-sri-30-am`) trägt die Kennzahlen aus dem Ergebnis-PDF des Original-Rechners
(Anteilpreis 105,16 €, 0,25368 € je Anteil und Monat). Damit reproduziert der Prototyp vier
abgelesene Ausgaben **auf den Cent** – siehe unten.

## Verifikation gegen den Original-Rechner

| Fall | Original | Modell |
| --- | --- | --- |
| 50 €/Monat, FSA 0 €, ohne Steuern | 21.555,98 € | 21.555,98 € |
| 50 €/Monat, FSA 0 €, mit Steuern | 27.785,03 € | 27.785,03 € |
| dazu Bruttoausschüttung laut PDF | 773,38 € p. a. | 773,38 € p. a. |
| 50 €/Monat, FSA 500 €, mit Steuern | 22.594,15 € | 22.594,15 € |
| 20.000 € Anlage → Einkommen vor Steuern | 46,39 €/Monat | 46,39 €/Monat |

Das entscheidet drei Modellfragen: Der Ausgabeaufschlag folgt `A = K × (1 + a)`, die Steuerumkehr
stimmt exakt – und der Freistellungsauftrag wird im Original **vor** der Teilfreistellung
abgezogen, nicht danach. Letzteres kostet im Referenzfall 916 € zusätzliches Kapital (4,2 %).

## Tests

96 Tests in sechs Dateien:

- `tax.test.ts` – Steuersätze auf zwölf Nachkommastellen (26,3750 % / 27,8186 % / 27,9951 %),
  Teilfreistellungstabelle, Reihenfolge der Abzüge, Umkehrformel inklusive Knick und Monotonie
- `calculator.test.ts` – Vorwärtsrechnung mit handgerechneten Referenzwerten, beide
  Aufschlagkonventionen, Frequenzen, Randfälle, Fehlerbehandlung
- `roundtrip.test.ts` – Kreuztest über 8 Fonds × 6 Steuerkonstellationen × 2 Konventionen ×
  8 Beträge: beide Richtungen müssen exakt invers sein
- `allianz-referenz.test.ts` – pinnt die vier oben genannten Referenzwerte auf den Cent
- `examples.test.ts` – Pinning der vier Beispielszenarien auf den Cent
- `format.test.ts` – deutsche Zahleneingabe und -ausgabe, inklusive Rundlauf

## Hinweis

Prototyp zu Demonstrationszwecken. Keine Anlage- oder Steuerberatung; die Steuermodellierung
ist bewusst vereinfacht (siehe `theorie.html`, Abschnitt 9 „Grenzen des Modells“).
