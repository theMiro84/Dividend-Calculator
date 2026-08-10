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
   Kapitalertragsbesteuerung angewendet (Teilfreistellung → Freistellungsauftrag → Steuersatz,
   in dieser Reihenfolge). Die zweite Richtung ist die Umkehrfunktion derselben Kette.
2. **Geht die Wertentwicklung ein?** Nein. In der Formel steht kein Performance-Parameter.
   Relevant ist ausschließlich die Ausschüttung je Anteil im Verhältnis zum Anteilwert.
   Was diese Vereinfachung verdeckt, steht in `theorie.html`, Abschnitt 6.

## Loslegen

```bash
npm install
npm run dev        # Entwicklungsserver (Rechner unter /index.html, Theorie unter /theorie.html)
npm test           # 78 Unit-Tests des Rechenkerns
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
  examples.ts         drei Beispielszenarien (UI-Buttons, Tests, Theorieseite)
  main.ts             UI-Logik (rechnet selbst nichts)
  styles.css
tests/                tax · calculator · roundtrip · examples · format
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
- **Freistellungsauftrag** (Sparer-Pauschbetrag), korrekt *nach* der Teilfreistellung
- **Steuersatz**: Abgeltungsteuer + Soli + optionale Kirchensteuer mit der Minderungsformel
  `s = 1/(4+k) × (1 + 0,055 + k)`, im Betriebsvermögen der persönliche Satz

Die Umkehrung der Steuerformel ist stückweise linear mit einem Knick bei
`Bruttoausschüttung = Freistellungsauftrag ÷ (1 − Teilfreistellung)`; unterhalb davon gilt
brutto = netto. Die Oberfläche blendet diese Grenze als Hinweis ein.

## Fiktive Fonds

Alle acht Fonds sind **frei erfunden** – Namen, ISINs (`DE000FIKT…`), Anteilwerte und
Ausschüttungen. Sie decken bewusst alle Teilfreistellungsklassen (Aktien-, Misch-, Inlands- und
Auslandsimmobilien-, Rentenfonds) und alle Frequenzen (monatlich, quartalsweise, jährlich) ab.

Ein Fonds (`meridian-sri-30-am`, 2,90 % p. a.) ist so parametrisiert, dass er die Ausgabe des
Original-Rechners reproduziert: 50 €/Monat bei 4 % Ausgabeaufschlag ergeben 21.509,28 € gegenüber
21.508,83 € im Original – Abweichung unter einem Euro. Ein Test hält das fest.

## Tests

78 Tests in fünf Dateien:

- `tax.test.ts` – Steuersätze auf zwölf Nachkommastellen (26,3750 % / 27,8186 % / 27,9951 %),
  Teilfreistellungstabelle, Reihenfolge der Abzüge, Umkehrformel inklusive Knick und Monotonie
- `calculator.test.ts` – Vorwärtsrechnung mit handgerechneten Referenzwerten, beide
  Aufschlagkonventionen, Frequenzen, Randfälle, Fehlerbehandlung
- `roundtrip.test.ts` – Kreuztest über 8 Fonds × 5 Steuerkonstellationen × 2 Konventionen ×
  8 Beträge: beide Richtungen müssen exakt invers sein
- `examples.test.ts` – Pinning der drei Beispielszenarien auf den Cent
- `format.test.ts` – deutsche Zahleneingabe und -ausgabe, inklusive Rundlauf

## Hinweis

Prototyp zu Demonstrationszwecken. Keine Anlage- oder Steuerberatung; die Steuermodellierung
ist bewusst vereinfacht (siehe `theorie.html`, Abschnitt 9 „Grenzen des Modells“).
