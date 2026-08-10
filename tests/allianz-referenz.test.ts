/**
 * Verifikation gegen echte Ausgaben des Original-Rechners.
 *
 * Grundlage sind Screenshots und das Ergebnis-PDF des Allianz-Rechners
 * "Extra-Einkommen" vom 10.08.2026 mit dem Fonds
 * "Allianz Dynamic Multi Asset Strategy SRI 30 AM5 EUR":
 *
 *   Anteilpreis            105,16 EUR
 *   Ausschuettung          0,25368 EUR je Anteil und Monat ("3 % p. a." laut Label)
 *   Teilfreistellung       15 %
 *   Steuer                 25 % Abgeltungsteuer + 5,5 % Soli, keine Kirchensteuer
 *   Ausgabeaufschlag       4,00 %
 *
 * Vier abgelesene Referenzwerte:
 *
 *   A) 50 EUR/Monat, FSA 0 EUR, Steuern unberuecksichtigt -> 21.555,98 EUR
 *   B) 50 EUR/Monat, FSA 0 EUR, Steuern beruecksichtigt   -> 27.785,03 EUR
 *      (PDF: 773,38 EUR p. a. vor Steuern, 64,45 EUR pro Monat)
 *   C) 50 EUR/Monat, FSA 500 EUR, Steuern beruecksichtigt -> 22.594,15 EUR
 *   D) 20.000 EUR Anlagebetrag, FSA 0 EUR, vor Steuern    -> 46,39 EUR pro Monat
 *
 * Fall C ist der aufschlussreiche: Er trifft nur, wenn der Freistellungsauftrag
 * VOR der Teilfreistellung abgezogen wird. Die gesetzliche Reihenfolge
 * (§ 20 Abs. 9 EStG) ergaebe 21.678,11 EUR.
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

describe('C) 50 €/Monat netto mit 500 € Freistellungsauftrag – der Reihenfolge-Nachweis', () => {
  it('trifft 22.594,15 €, wenn der Freistellungsauftrag zuerst abgezogen wird', () => {
    const e = berechneAnlagebetrag(50, eingaben(500, 'vor_teilfreistellung')).mitSteuerbetrachtung;
    expect(e.anlagebetragBrutto).toBeCloseTo(22594.15, 2);
    expect(e.ausschuettungNettoMonat).toBeCloseTo(50, 8);
  });

  it('ergäbe in der gesetzlichen Reihenfolge nur 21.678,11 €', () => {
    const e = berechneAnlagebetrag(50, eingaben(500, 'nach_teilfreistellung')).mitSteuerbetrachtung;
    expect(e.anlagebetragBrutto).toBeCloseTo(21678.11, 2);
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

describe('Ausgabeaufschlag-Konvention', () => {
  it('bestätigt A = K × (1 + a); die Alternative verfehlt die Referenz deutlich', () => {
    const alternative = berechneAnlagebetrag(50, {
      ...eingaben(0, 'nach_teilfreistellung'),
      aufschlagModus: 'im_anlagebetrag',
    }).ohneSteuerbetrachtung;

    expect(Math.abs(alternative.anlagebetragBrutto - 21555.98)).toBeGreaterThan(30);
  });
});
