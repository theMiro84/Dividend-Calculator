/**
 * Zwei durchgerechnete Beispiele - eines je Rechenrichtung.
 *
 * Sie werden an drei Stellen verwendet:
 *   - als Schnellauswahl im Prototyp (Buttons "Beispiel laden"),
 *   - als Referenzwerte in den Tests (tests/examples.test.ts),
 *   - als Grundlage der Beispielrechnungen in theorie.html.
 */

import type { Eingaben } from './core/calculator.js';
import type { AufschlagModus, SteuerEinstellungen } from './core/types.js';
import { findeFonds } from './data/funds.js';

export type Richtung = 'anlagebetrag' | 'einkommen';

export interface Beispiel {
  readonly id: string;
  readonly titel: string;
  readonly frage: string;
  readonly richtung: Richtung;
  /** Eingabewert: Zielrente pro Monat (Richtung `anlagebetrag`) oder Anlagebetrag. */
  readonly betrag: number;
  readonly fondsId: string;
  readonly ausgabeaufschlag: number;
  readonly aufschlagModus: AufschlagModus;
  /** Steuern beruecksichtigen: bei `anlagebetrag` heisst das "Ziel ist ein Nettobetrag". */
  readonly steuernBeruecksichtigen: boolean;
  readonly steuer: SteuerEinstellungen;
}

export const BEISPIELE: readonly Beispiel[] = [
  {
    id: 'beispiel-1',
    titel: 'Beispiel 1: 250 € netto pro Monat',
    frage:
      'Wie viel muss ich heute anlegen, damit nach Steuern 250 € im Monat auf dem Konto landen?',
    richtung: 'anlagebetrag',
    betrag: 250,
    fondsId: 'meridian-multi-asset-50-am',
    ausgabeaufschlag: 0.04,
    aufschlagModus: 'auf_anteilwert',
    steuernBeruecksichtigen: true,
    steuer: {
      vermoegensart: 'privat',
      freistellungsauftragModus: 'nach_teilfreistellung',
      freistellungsauftrag: 1000,
      kirchensteuersatz: 0,
      soli: true,
      persoenlicherSteuersatz: 0.42,
    },
  },
  {
    id: 'beispiel-2',
    titel: 'Beispiel 2: 100.000 € anlegen',
    frage:
      'Ich habe 100.000 € zur Verfuegung - welches monatliche Extra-Einkommen ist damit realistisch?',
    richtung: 'einkommen',
    betrag: 100000,
    fondsId: 'meridian-global-dividend-am',
    ausgabeaufschlag: 0.05,
    aufschlagModus: 'auf_anteilwert',
    steuernBeruecksichtigen: true,
    steuer: {
      vermoegensart: 'privat',
      freistellungsauftragModus: 'nach_teilfreistellung',
      freistellungsauftrag: 1000,
      kirchensteuersatz: 0.09,
      soli: true,
      persoenlicherSteuersatz: 0.42,
    },
  },
  {
    id: 'beispiel-3',
    titel: 'Beispiel 3: 500 € im Betriebsvermögen',
    frage:
      'Eine GmbH-Geschäftsführerin legt Betriebsvermögen an: Was kostet ein Extra-Ertrag von 500 € netto im Monat?',
    richtung: 'anlagebetrag',
    betrag: 500,
    fondsId: 'meridian-global-property-aq',
    ausgabeaufschlag: 0.05,
    aufschlagModus: 'auf_anteilwert',
    steuernBeruecksichtigen: true,
    steuer: {
      vermoegensart: 'betrieb',
      freistellungsauftragModus: 'nach_teilfreistellung',
      freistellungsauftrag: 0,
      kirchensteuersatz: 0,
      soli: true,
      persoenlicherSteuersatz: 0.42,
    },
  },
  {
    id: 'beispiel-4',
    titel: 'Beispiel 4: Referenzfall des Original-Rechners',
    frage:
      'Reproduktion einer echten Ausgabe: 50 € netto/Monat, 500 € Freistellungsauftrag – zeigt den Effekt der Abzugsreihenfolge.',
    richtung: 'anlagebetrag',
    betrag: 50,
    fondsId: 'meridian-sri-30-am',
    ausgabeaufschlag: 0.04,
    aufschlagModus: 'auf_anteilwert',
    steuernBeruecksichtigen: true,
    steuer: {
      vermoegensart: 'privat',
      freistellungsauftragModus: 'vor_teilfreistellung',
      freistellungsauftrag: 500,
      kirchensteuersatz: 0,
      soli: true,
      persoenlicherSteuersatz: 0.42,
    },
  },
];

/** Uebersetzt ein Beispiel in die Eingaben des Rechenkerns. */
export function eingabenAusBeispiel(beispiel: Beispiel): Eingaben {
  return {
    fonds: findeFonds(beispiel.fondsId),
    ausgabeaufschlag: beispiel.ausgabeaufschlag,
    aufschlagModus: beispiel.aufschlagModus,
    steuer: beispiel.steuer,
  };
}

export function findeBeispiel(id: string): Beispiel {
  const beispiel = BEISPIELE.find((b) => b.id === id);
  if (!beispiel) throw new Error(`Unbekanntes Beispiel: ${id}`);
  return beispiel;
}
