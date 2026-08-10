/**
 * Prognosen zur Abzugsreihenfolge - inzwischen weitgehend bestaetigt.
 *
 * Diese Datei entstand, als nur EIN Datenpunkt mit Freistellungsauftrag
 * vorlag (500 EUR -> 22.594,15 EUR). Sie hielt fest, was die beiden Hypothesen
 * fuer weitere Eingaben vorhersagen.
 *
 * Zwei der Prognosen wurden anschliessend nachgemessen und trafen exakt:
 *
 *   250 EUR -> 25.189,59 EUR   (vorhergesagt: 25.189,59 EUR)
 *   550 EUR -> 22.075,06 EUR   (vorhergesagt: 22.075,06 EUR)
 *
 * Der 550-EUR-Fall ist der entscheidende: Dort deckt der Freistellungsauftrag
 * die teilfreigestellten 510 EUR vollstaendig ab. Die gesetzliche Reihenfolge
 * sagt "gar keine Steuer" voraus, beide ausgewiesenen Betraege waeren identisch.
 * Beobachtet wurden aber 21.555,98 / 22.075,06 EUR. Damit ist die gesetzliche
 * Reihenfolge fuer diesen Rechner ausgeschlossen.
 *
 * Die uebrigen Zeilen bleiben als offene Prognosen stehen.
 */

import { describe, expect, it } from 'vitest';

import { berechneAnlagebetrag } from '../src/core/calculator.js';
import type { Eingaben } from '../src/core/calculator.js';
import { findeFonds } from '../src/data/funds.js';
import type { FreistellungsauftragModus } from '../src/core/types.js';
import { privat } from './helpers.js';

const fonds = findeFonds('meridian-sri-30-am');

const anlagebetrag = (
  zielMonat: number,
  freistellungsauftrag: number,
  modus: FreistellungsauftragModus,
): number => {
  const eingaben: Eingaben = {
    fonds,
    ausgabeaufschlag: 0.04,
    aufschlagModus: 'auf_anteilwert',
    steuer: privat({ freistellungsauftrag, freistellungsauftragModus: modus }),
  };
  return berechneAnlagebetrag(zielMonat, eingaben).mitSteuerbetrachtung.anlagebetragBrutto;
};

/** [Freistellungsauftrag, gesetzliche Reihenfolge, beobachtete Reihenfolge] */
const prognosen: ReadonlyArray<readonly [number, number, number]> = [
  [0, 27785.03, 27785.03],
  [100, 26563.65, 26746.86],
  [250, 24731.57, 25189.59], // <- bestaetigt
  [500, 21678.11, 22594.15], // <- bestaetigt
  [550, 21555.98, 22075.06], // <- bestaetigt, qualitativ entscheidend
  [600, 21555.98, 21555.98],
  [1000, 21555.98, 21555.98],
];

describe('Prognosen für 50 €/Monat netto, Referenzfonds, 4 % Ausgabeaufschlag', () => {
  it.each(prognosen)(
    'Freistellungsauftrag %s € → gesetzlich %s €, beobachtete Variante %s €',
    (fsa, gesetzlich, beobachtet) => {
      expect(anlagebetrag(50, fsa, 'nach_teilfreistellung')).toBeCloseTo(gesetzlich, 2);
      expect(anlagebetrag(50, fsa, 'vor_teilfreistellung')).toBeCloseTo(beobachtet, 2);
    },
  );

  it('unterscheidet sich zwischen 511 € und 599 € qualitativ, nicht nur quantitativ', () => {
    // Gesetzlich: der Freistellungsauftrag deckt die teilfreigestellten
    // 600 x 0,85 = 510 € vollständig ab -> gar keine Steuer, beide Werte gleich.
    for (const fsa of [520, 550, 590]) {
      expect(anlagebetrag(50, fsa, 'nach_teilfreistellung')).toBeCloseTo(21555.98, 2);
      expect(anlagebetrag(50, fsa, 'vor_teilfreistellung')).toBeGreaterThan(21555.98 + 50);
    }
    // Am deutlichsten kurz oberhalb von 510 €; zur 600er-Grenze hin laeuft die
    // Differenz wieder auf null zu. 550 € liegt gut sichtbar dazwischen.
    expect(anlagebetrag(50, 520, 'vor_teilfreistellung')).toBeCloseTo(22386.52, 2);
    expect(anlagebetrag(50, 590, 'vor_teilfreistellung')).toBeCloseTo(21659.8, 1);
  });

  it('ist ab 600 € Freistellungsauftrag in beiden Varianten steuerfrei', () => {
    // Ab hier deckt der Freistellungsauftrag auch den BRUTTO-Ertrag von 600 €/Jahr.
    expect(anlagebetrag(50, 600, 'nach_teilfreistellung')).toBeCloseTo(21555.98, 2);
    expect(anlagebetrag(50, 600, 'vor_teilfreistellung')).toBeCloseTo(21555.98, 2);
  });

  it('sagt bei doppeltem Zielbetrag konsistente Werte voraus', () => {
    expect(anlagebetrag(100, 500, 'nach_teilfreistellung')).toBeCloseTo(49463.15, 2);
    expect(anlagebetrag(100, 500, 'vor_teilfreistellung')).toBeCloseTo(50379.19, 2);
  });
});

describe('Nullkontrolle: ohne Teilfreistellung müssen beide Varianten übereinstimmen', () => {
  it('gilt für einen Rentenfonds (0 % Teilfreistellung)', () => {
    const rentenfonds = findeFonds('meridian-corporate-bond-am');
    const rechne = (modus: FreistellungsauftragModus): number =>
      berechneAnlagebetrag(50, {
        fonds: rentenfonds,
        ausgabeaufschlag: 0.03,
        aufschlagModus: 'auf_anteilwert',
        steuer: privat({ freistellungsauftrag: 500, freistellungsauftragModus: modus }),
      }).mitSteuerbetrachtung.anlagebetragBrutto;

    expect(rechne('vor_teilfreistellung')).toBeCloseTo(rechne('nach_teilfreistellung'), 8);
  });

  it('spreizt sich beim Aktienfonds (30 % Teilfreistellung) doppelt so stark wie beim Mischfonds', () => {
    // Der Unterschied in der Steuer betraegt f x tf x s - er skaliert linear in tf.
    const spreizung = (fondsId: string, ausgabeaufschlag: number): number => {
      const f = findeFonds(fondsId);
      const rechne = (modus: FreistellungsauftragModus) =>
        berechneAnlagebetrag(50, {
          fonds: f,
          ausgabeaufschlag,
          aufschlagModus: 'auf_anteilwert',
          steuer: privat({ freistellungsauftrag: 300, freistellungsauftragModus: modus }),
        }).mitSteuerbetrachtung;
      const a = rechne('vor_teilfreistellung');
      const b = rechne('nach_teilfreistellung');
      return a.ausschuettungBruttoJahr - b.ausschuettungBruttoJahr;
    };

    const misch = spreizung('meridian-sri-30-am', 0.04); // 15 % Teilfreistellung
    const aktien = spreizung('meridian-global-dividend-am', 0.05); // 30 % Teilfreistellung

    // Exakt: (D_vor - D_nach) = f x s x tf / (1 - q x s); der Nenner daempft die
    // Verdopplung leicht ab, deshalb liegt das Verhaeltnis knapp unter 2.
    expect(aktien / misch).toBeCloseTo(1.903, 2);
  });
});
