/**
 * Verifikation gegen echte Ausgaben des Original-Rechners.
 *
 * Grundlage sind Screenshots und Ergebnis-PDFs des Allianz-Rechners
 * "Extra-Einkommen" vom 10.08.2026, zwei Fonds derselben Familie:
 *
 *   SRI 30 AM5   Anteilpreis 105,16 EUR, 0,25368 EUR je Anteil und Monat,
 *                15 % Teilfreistellung, Ausgabeaufschlag 4,00 %
 *   SRI 75 AM5   Anteilpreis 113,01 EUR, 0,51785 EUR je Anteil und Monat,
 *                30 % Teilfreistellung, Ausgabeaufschlag 5,00 %
 *
 * In allen Faellen: 25 % Abgeltungsteuer + 5,5 % Soli, keine Kirchensteuer.
 *
 * Neun abgelesene Referenzwerte, alle auf den Cent getroffen:
 *
 *   A) SRI 30, 50 EUR/Monat, FSA   0 EUR, ohne Steuern -> 21.555,98 EUR
 *   B) SRI 30, 50 EUR/Monat, FSA   0 EUR, mit Steuern  -> 27.785,03 EUR
 *      (PDF: 773,38 EUR p. a. vor Steuern, 64,45 EUR pro Monat)
 *   C) SRI 30, 50 EUR/Monat, FSA 250 EUR, mit Steuern  -> 25.189,59 EUR
 *      SRI 30, 50 EUR/Monat, FSA 500 EUR, mit Steuern  -> 22.594,15 EUR
 *      SRI 30, 50 EUR/Monat, FSA 550 EUR, mit Steuern  -> 22.075,06 EUR
 *   D) SRI 30, 20.000 EUR Anlagebetrag, FSA 0, vor Steuern -> 46,39 EUR/Monat
 *   E) SRI 75, 50 EUR/Monat, FSA   0 EUR -> 11.457,03 / 14.051,24 EUR
 *
 * Die drei C-Faelle entscheiden die Frage der Abzugsreihenfolge. Am schaerfsten
 * der 550-EUR-Fall: Dort deckt der Freistellungsauftrag die teilfreigestellten
 * 510 EUR vollstaendig ab. Die gesetzliche Reihenfolge (§ 20 Abs. 9 EStG) saehe
 * gar keine Steuer vor, beide ausgewiesenen Betraege waeren identisch.
 * Beobachtet werden aber zwei verschiedene Zahlen.
 */

import { describe, expect, it } from 'vitest';

import { ausschuettungsrendite, berechneAnlagebetrag, berechneEinkommen } from '../src/core/calculator.js';
import type { Eingaben } from '../src/core/calculator.js';
import { findeFonds } from '../src/data/funds.js';
import { privat } from './helpers.js';

const fonds = findeFonds('meridian-sri-30-am');

const eingaben = (freistellungsauftrag: number, modus: 'nach_teilfreistellung' | 'vor_teilfreistellung'): Eingaben => ({
  fonds,
  ausgabeaufschlag: 0.04,
  aufschlagModus: 'auf_anteilwert',
  steuer: privat({ freistellungsauftrag, freistellungsauftragModus: modus }),
});

describe('Fondskennzahlen des Referenzfalls', () => {
  it('traegt Anteilpreis und Ausschuettung je Anteil aus dem Ergebnis-PDF', () => {
    expect(fonds.anteilwert).toBe(105.16);
    expect(fonds.ausschuettungJeAnteil).toBe(0.25368);
    expect(fonds.frequenz).toBe(12);
    expect(fonds.typ).toBe('mischfonds'); // -> 15 % Teilfreistellung
  });

  it('ergibt 2,8948 % statt der im Namen genannten 3 %', () => {
    expect(ausschuettungsrendite(fonds)).toBeCloseTo(0.028948, 6);
  });

  it('erklaert die 3 % als Quote auf den Anteilpreis zu Jahresbeginn', () => {
    // 0,25368 * 12 = 3,04416 EUR p. a. je Anteil; das sind genau 3 % von 101,472 EUR.
    const jahresausschuettung = fonds.ausschuettungJeAnteil * fonds.frequenz;
    expect(jahresausschuettung / 0.03).toBeCloseTo(101.472, 3);
  });
});

describe('A) 50 €/Monat, kein Freistellungsauftrag, Steuern unberücksichtigt', () => {
  it('trifft 21.555,98 € auf den Cent', () => {
    const e = berechneAnlagebetrag(50, eingaben(0, 'nach_teilfreistellung')).ohneSteuerbetrachtung;
    expect(e.anlagebetragBrutto).toBeCloseTo(21555.98, 2);
    expect(e.ausschuettungBruttoMonat).toBeCloseTo(50, 8);
  });
});

describe('B) 50 €/Monat netto, kein Freistellungsauftrag', () => {
  const e = berechneAnlagebetrag(50, eingaben(0, 'nach_teilfreistellung')).mitSteuerbetrachtung;

  it('trifft 27.785,03 € auf den Cent', () => {
    expect(e.anlagebetragBrutto).toBeCloseTo(27785.03, 2);
  });

  it('trifft die Zwischenwerte des Ergebnis-PDF', () => {
    expect(e.ausschuettungBruttoJahr).toBeCloseTo(773.38, 2);
    expect(e.ausschuettungBruttoMonat).toBeCloseTo(64.45, 2);
    expect(e.ausschuettungNettoJahr).toBeCloseTo(600, 8);
    expect(e.ausschuettungNettoMonat).toBeCloseTo(50, 8);
  });

  it('ist ohne Freistellungsauftrag von der Reihenfolge unabhängig', () => {
    const andereReihenfolge = berechneAnlagebetrag(50, eingaben(0, 'vor_teilfreistellung'))
      .mitSteuerbetrachtung;
    expect(andereReihenfolge.anlagebetragBrutto).toBeCloseTo(e.anlagebetragBrutto, 8);
  });
});

describe('C) 50 €/Monat netto mit Freistellungsauftrag – der Reihenfolge-Nachweis', () => {
  /** [Freistellungsauftrag, beobachteter Anlagebetrag] */
  const beobachtet: ReadonlyArray<readonly [number, number]> = [
    [250, 25189.59],
    [500, 22594.15],
    [550, 22075.06],
  ];

  it.each(beobachtet)(
    'trifft bei %s € Freistellungsauftrag %s €, wenn der Freistellungsauftrag zuerst abgezogen wird',
    (fsa, erwartet) => {
      const e = berechneAnlagebetrag(50, eingaben(fsa, 'vor_teilfreistellung')).mitSteuerbetrachtung;
      expect(e.anlagebetragBrutto).toBeCloseTo(erwartet, 2);
      expect(e.ausschuettungNettoMonat).toBeCloseTo(50, 8);
    },
  );

  it('ergäbe in der gesetzlichen Reihenfolge durchweg weniger', () => {
    expect(
      berechneAnlagebetrag(50, eingaben(250, 'nach_teilfreistellung')).mitSteuerbetrachtung
        .anlagebetragBrutto,
    ).toBeCloseTo(24731.57, 2);
    expect(
      berechneAnlagebetrag(50, eingaben(500, 'nach_teilfreistellung')).mitSteuerbetrachtung
        .anlagebetragBrutto,
    ).toBeCloseTo(21678.11, 2);
  });

  it('schließt die gesetzliche Reihenfolge bei 550 € qualitativ aus', () => {
    // Gesetzlich decken 550 € die teilfreigestellten 600 x 0,85 = 510 € komplett ab:
    // Es fiele GAR KEINE Steuer an, beide ausgewiesenen Betraege waeren identisch.
    const gesetzlich = berechneAnlagebetrag(50, eingaben(550, 'nach_teilfreistellung'));
    expect(gesetzlich.mitSteuerbetrachtung.steuerJahr).toBe(0);
    expect(gesetzlich.mitSteuerbetrachtung.anlagebetragBrutto).toBeCloseTo(21555.98, 2);

    // Beobachtet werden aber 21.555,98 € / 22.075,06 € - also zwei verschiedene Zahlen.
    const beobachteteVariante = berechneAnlagebetrag(50, eingaben(550, 'vor_teilfreistellung'));
    expect(beobachteteVariante.ohneSteuerbetrachtung.anlagebetragBrutto).toBeCloseTo(21555.98, 2);
    expect(beobachteteVariante.mitSteuerbetrachtung.anlagebetragBrutto).toBeCloseTo(22075.06, 2);
    expect(beobachteteVariante.mitSteuerbetrachtung.steuerJahr).toBeGreaterThan(0);
  });

  it('kostet die Vereinfachung rund 4,2 % zusätzliches Kapital', () => {
    const vereinfacht = berechneAnlagebetrag(50, eingaben(500, 'vor_teilfreistellung'))
      .mitSteuerbetrachtung.anlagebetragBrutto;
    const gesetzlich = berechneAnlagebetrag(50, eingaben(500, 'nach_teilfreistellung'))
      .mitSteuerbetrachtung.anlagebetragBrutto;
    expect(vereinfacht / gesetzlich - 1).toBeCloseTo(0.0423, 4);
  });

  it('lässt den Wert ohne Steuerbetrachtung unverändert bei 21.555,98 €', () => {
    const e = berechneAnlagebetrag(50, eingaben(500, 'vor_teilfreistellung')).ohneSteuerbetrachtung;
    expect(e.anlagebetragBrutto).toBeCloseTo(21555.98, 2);
  });
});

describe('D) 20.000 € Anlagebetrag, Richtung Einkommen', () => {
  it('trifft 46,39 € pro Monat vor Steuern', () => {
    const e = berechneEinkommen(20000, eingaben(0, 'nach_teilfreistellung'));
    expect(e.ausschuettungBruttoMonat).toBeCloseTo(46.39, 2);
  });
});

describe('E) Zweiter Fonds: SRI 75 mit 30 % Teilfreistellung', () => {
  /*
   * Screenshot: 50 EUR/Monat, FSA 0 EUR, Ausgabeaufschlag 5,00 %,
   * Anteilpreis 113,01 EUR vom 10.08.2026 -> 11.457,03 EUR / 14.051,24 EUR.
   * Der Fonds haelt 75 % Aktien, ist damit Aktienfonds im Sinne des InvStG
   * und traegt 30 % statt 15 % Teilfreistellung.
   */
  const sri75 = findeFonds('meridian-sri-75-am');
  const eingabenSri75: Eingaben = {
    fonds: sri75,
    ausgabeaufschlag: 0.05,
    aufschlagModus: 'auf_anteilwert',
    steuer: privat({ freistellungsauftrag: 0 }),
  };
  const ergebnis = berechneAnlagebetrag(50, eingabenSri75);

  it('trifft beide Werte auf den Cent', () => {
    expect(ergebnis.ohneSteuerbetrachtung.anlagebetragBrutto).toBeCloseTo(11457.03, 2);
    expect(ergebnis.mitSteuerbetrachtung.anlagebetragBrutto).toBeCloseTo(14051.24, 2);
  });

  it('belegt die Teilfreistellung von 30 % – mit 15 % kaeme 14.767,79 € heraus', () => {
    expect(ergebnis.mitSteuerbetrachtung.teilfreistellungssatz).toBe(0.3);
    expect(ergebnis.mitSteuerbetrachtung.ausschuettungBruttoJahr).toBeCloseTo(735.86, 2);

    const alsMischfonds = berechneAnlagebetrag(50, {
      ...eingabenSri75,
      fonds: { ...sri75, typ: 'mischfonds' },
    });
    expect(alsMischfonds.mitSteuerbetrachtung.anlagebetragBrutto).toBeCloseTo(14767.79, 2);
  });

  it('zeigt dasselbe Muster beim Ausschüttungsziel wie der SRI 30', () => {
    // 6,00 % p. a. auf den Vorjahres-Schlusskurs; laufend nur noch 5,4988 %.
    const jahresausschuettung = sri75.ausschuettungJeAnteil * sri75.frequenz;
    expect(jahresausschuettung / 0.06).toBeCloseTo(103.57, 2);
    expect(ausschuettungsrendite(sri75)).toBeCloseTo(0.054988, 6);
  });
});

describe('Ausgabeaufschlag-Konvention', () => {
  it('bestätigt A = K × (1 + a); die Alternative verfehlt die Referenz deutlich', () => {
    const alternative = berechneAnlagebetrag(50, {
      ...eingaben(0, 'nach_teilfreistellung'),
      aufschlagModus: 'im_anlagebetrag',
    }).ohneSteuerbetrachtung;

    expect(Math.abs(alternative.anlagebetragBrutto - 21555.98)).toBeGreaterThan(30);
  });
});
