/**
 * FIKTIVE Fonds fuer die Simulation.
 *
 * Alle Namen, ISINs, Anteilwerte und Ausschuettungen sind frei erfunden. Die
 * ISIN-Praefixe "DE000FIKT" sind bewusst als Fantasie erkennbar. Die Auswahl
 * deckt absichtlich alle Teilfreistellungsklassen und alle gaengigen
 * Ausschuettungsfrequenzen ab, damit der Rechner vollstaendig getestet werden
 * kann.
 *
 * Zwei Fonds tragen die Kennzahlen, die der Original-Rechner ausweist:
 * `meridian-sri-30-am` (Mischfonds, 15 % Teilfreistellung) und
 * `meridian-sri-75-am` (Aktienfonds, 30 % Teilfreistellung). Damit reproduziert
 * der Prototyp neun abgelesene Ausgaben auf den Cent - siehe
 * tests/allianz-referenz.test.ts.
 *
 * Beide tragen ein `ausschuettungsziel`: Die Quote (3 % bzw. 6 % p. a.) wird
 * Anfang Januar auf den Schlusskurs des Vorjahres bezogen, der Jahresbetrag
 * anteilig auf die zwoelf Termine verteilt und bleibt in Euro fix. Die laufende
 * Rendite auf den aktuellen Anteilpreis liegt darunter, sobald der Kurs
 * gestiegen ist - genau um diesen Kursanstieg.
 *
 * `ausschuettungJeAnteil` ist damit bei diesen beiden Fonds eine ABGELEITETE
 * Groesse. tests/ausschuettungsziel.test.ts prueft, dass die hinterlegte Zahl
 * zur Zielquote passt.
 */

import type { Fonds } from '../core/types.js';

export const FONDS: readonly Fonds[] = [
  {
    id: 'meridian-global-dividend-am',
    name: 'Meridian Global Dividend Select AM (EUR)',
    isin: 'DE000FIKT001',
    typ: 'aktienfonds',
    anteilwert: 120.0,
    ausschuettungJeAnteil: 0.5,
    frequenz: 12,
    ausgabeaufschlagStandard: 0.05,
    laufendeKosten: 0.0158,
    kapitalbeteiligungsquote: 0.95,
    beschreibung:
      'Globaler Dividendenfonds mit Fokus auf ausschuettungsstarke Standardwerte. ' +
      'Monatliche Ausschuettung, hohe Aktienquote und damit 30 % Teilfreistellung im Privatvermoegen.',
  },
  {
    id: 'meridian-multi-asset-30-am',
    name: 'Meridian Multi Asset Income 30 AM (EUR)',
    isin: 'DE000FIKT002',
    typ: 'mischfonds',
    anteilwert: 100.0,
    ausschuettungJeAnteil: 0.25,
    frequenz: 12,
    ausgabeaufschlagStandard: 0.04,
    laufendeKosten: 0.0124,
    kapitalbeteiligungsquote: 0.3,
    beschreibung:
      'Defensiver Mischfonds mit rund 30 % Aktienquote. Monatliche Ausschuettung von 0,25 EUR ' +
      'je Anteil bei einem Anteilwert von 100 EUR ergibt glatte 3,00 % Ausschuettungsrendite p. a.',
  },
  {
    id: 'meridian-multi-asset-50-am',
    name: 'Meridian Multi Asset Income 50 AM (EUR)',
    isin: 'DE000FIKT003',
    typ: 'mischfonds',
    anteilwert: 105.0,
    ausschuettungJeAnteil: 0.35,
    frequenz: 12,
    ausgabeaufschlagStandard: 0.04,
    laufendeKosten: 0.0139,
    kapitalbeteiligungsquote: 0.5,
    beschreibung:
      'Ausgewogener Mischfonds mit rund 50 % Aktienquote und 4,00 % Ausschuettungsrendite p. a. ' +
      'Weiterhin Mischfonds im Sinne des InvStG (unter 51 % Kapitalbeteiligungen).',
  },
  {
    id: 'meridian-sri-30-am',
    name: 'Meridian Dynamic Multi Asset SRI 30 AM5 (EUR)',
    isin: 'DE000FIKT004',
    typ: 'mischfonds',
    anteilwert: 105.16,
    ausschuettungJeAnteil: 0.25368,
    frequenz: 12,
    // 3,00 % p. a. auf den Schlusskurs 2025 -> 3,04416 EUR p. a. -> 0,25368 EUR je Monat
    ausschuettungsziel: { quote: 0.03, basisAnteilpreis: 101.472 },
    ausgabeaufschlagStandard: 0.04,
    laufendeKosten: 0.0142,
    kapitalbeteiligungsquote: 0.3,
    beschreibung:
      'Referenzfonds zur Verifikation: traegt die Kennzahlen, die der Original-Rechner ausweist. ' +
      'Die Ausschuettung wurde zu Jahresbeginn auf 3,00 % p. a. des damaligen Anteilpreises ' +
      '(101,472 EUR) fixiert; bezogen auf den aktuellen Preis von 105,16 EUR sind das noch ' +
      '2,8948 % - genau diese Zahl geht in die Rechnung ein, nicht die 3 % aus dem Fondsnamen.',
  },
  {
    id: 'meridian-sri-75-am',
    name: 'Meridian Dynamic Multi Asset SRI 75 AM5 (EUR)',
    isin: 'DE000FIKT009',
    typ: 'aktienfonds',
    anteilwert: 113.01,
    ausschuettungJeAnteil: 0.51785,
    frequenz: 12,
    // 6,00 % p. a. auf den Schlusskurs 2025 -> 6,21420 EUR p. a. -> 0,51785 EUR je Monat
    ausschuettungsziel: { quote: 0.06, basisAnteilpreis: 103.57 },
    ausgabeaufschlagStandard: 0.05,
    laufendeKosten: 0.0182,
    kapitalbeteiligungsquote: 0.75,
    beschreibung:
      'Zweiter Referenzfonds zur Verifikation, offensives Profil mit 75 % Aktienquote und damit ' +
      '30 % Teilfreistellung. Ausschuettungsziel 6,00 % p. a. auf den Vorjahres-Schlusskurs von ' +
      '103,57 EUR; auf den aktuellen Anteilpreis von 113,01 EUR sind das noch 5,4988 %.',
  },
  {
    id: 'meridian-real-estate-aq',
    name: 'Meridian European Real Estate Income AQ (EUR)',
    isin: 'DE000FIKT005',
    typ: 'immobilienfonds',
    anteilwert: 52.0,
    ausschuettungJeAnteil: 0.455,
    frequenz: 4,
    ausgabeaufschlagStandard: 0.05,
    laufendeKosten: 0.0185,
    kapitalbeteiligungsquote: 0,
    beschreibung:
      'Immobilienfonds mit Schwerpunkt Inland, quartalsweise Ausschuettung, 3,50 % p. a. ' +
      '60 % Teilfreistellung - der steuerlich guenstigste Fall neben Auslandsimmobilien.',
  },
  {
    id: 'meridian-global-property-aq',
    name: 'Meridian Global Property Income AQ (EUR)',
    isin: 'DE000FIKT006',
    typ: 'immobilienfonds_ausland',
    anteilwert: 60.0,
    ausschuettungJeAnteil: 0.6,
    frequenz: 4,
    ausgabeaufschlagStandard: 0.05,
    laufendeKosten: 0.0192,
    kapitalbeteiligungsquote: 0,
    beschreibung:
      'Immobilienfonds mit ueberwiegend auslaendischen Objekten, 4,00 % p. a. und 80 % ' +
      'Teilfreistellung. Die Steuerlast sinkt dadurch auf rund ein Fuenftel des Normalfalls.',
  },
  {
    id: 'meridian-corporate-bond-am',
    name: 'Meridian Euro Corporate Bond Income AM (EUR)',
    isin: 'DE000FIKT007',
    typ: 'sonstige',
    anteilwert: 45.0,
    ausschuettungJeAnteil: 0.1125,
    frequenz: 12,
    ausgabeaufschlagStandard: 0.03,
    laufendeKosten: 0.0085,
    kapitalbeteiligungsquote: 0,
    beschreibung:
      'Unternehmensanleihenfonds mit 3,00 % Ausschuettungsrendite p. a. Ohne Kapitalbeteiligungen ' +
      'gibt es keine Teilfreistellung - die Ausschuettung ist voll steuerpflichtig.',
  },
  {
    id: 'meridian-balanced-25-aj',
    name: 'Meridian Balanced Income 25 AJ (EUR)',
    isin: 'DE000FIKT008',
    typ: 'mischfonds',
    anteilwert: 80.0,
    ausschuettungJeAnteil: 2.8,
    frequenz: 1,
    ausgabeaufschlagStandard: 0.04,
    laufendeKosten: 0.0118,
    kapitalbeteiligungsquote: 0.25,
    beschreibung:
      'Mischfonds mit nur einer Ausschuettung pro Jahr (3,50 % p. a.). Zeigt, dass der Rechner ' +
      'ein GLATTGERECHNETES Monatseinkommen ausweist - tatsaechlich fliesst das Geld einmal jaehrlich.',
  },
];

export const FONDS_NACH_ID: ReadonlyMap<string, Fonds> = new Map(FONDS.map((f) => [f.id, f]));

export function findeFonds(id: string): Fonds {
  const fonds = FONDS_NACH_ID.get(id);
  if (!fonds) throw new Error(`Unbekannter Fonds: ${id}`);
  return fonds;
}
