/**
 * Kreuztests: Die beiden Rechenrichtungen muessen exakt zueinander invers sein.
 * Das ist die staerkste Aussage ueber die Korrektheit des Rechners - jeder
 * Vorzeichen- oder Reihenfolgefehler in der Steuerformel bricht sie sofort.
 */

import { describe, expect, it } from 'vitest';

import { berechneAnlagebetrag, berechneEinkommen } from '../src/core/calculator.js';
import type { Eingaben } from '../src/core/calculator.js';
import { FONDS } from '../src/data/funds.js';
import type { AufschlagModus, SteuerEinstellungen } from '../src/core/types.js';

const steuerVarianten: ReadonlyArray<readonly [string, SteuerEinstellungen]> = [
  [
    'privat, kein FSA',
    {
      vermoegensart: 'privat',
      freistellungsauftrag: 0,
      kirchensteuersatz: 0,
      soli: true,
      persoenlicherSteuersatz: 0.42,
    },
  ],
  [
    'privat, FSA 1.000 €',
    {
      vermoegensart: 'privat',
      freistellungsauftrag: 1000,
      kirchensteuersatz: 0,
      soli: true,
      persoenlicherSteuersatz: 0.42,
    },
  ],
  [
    'privat, FSA 2.000 €, Kirchensteuer 9 %',
    {
      vermoegensart: 'privat',
      freistellungsauftrag: 2000,
      kirchensteuersatz: 0.09,
      soli: true,
      persoenlicherSteuersatz: 0.42,
    },
  ],
  [
    'betrieb, 42 %',
    {
      vermoegensart: 'betrieb',
      freistellungsauftrag: 0,
      kirchensteuersatz: 0,
      soli: true,
      persoenlicherSteuersatz: 0.42,
    },
  ],
  [
    'betrieb, 30 % mit Kirchensteuer 8 %',
    {
      vermoegensart: 'betrieb',
      freistellungsauftrag: 0,
      kirchensteuersatz: 0.08,
      soli: true,
      persoenlicherSteuersatz: 0.3,
    },
  ],
];

const modi: readonly AufschlagModus[] = ['auf_anteilwert', 'im_anlagebetrag'];
const zielBetraege = [0, 25, 50, 100, 250, 500, 1000, 2500];
const anlageBetraege = [0, 1000, 10000, 21508.83, 100000, 250000, 1_000_000];

describe('Inversion der beiden Rechenrichtungen', () => {
  it.each(steuerVarianten)('Ziel -> Anlagebetrag -> Ziel (%s)', (_name, steuer) => {
    for (const fonds of FONDS) {
      for (const aufschlagModus of modi) {
        const eingaben: Eingaben = {
          fonds,
          ausgabeaufschlag: fonds.ausgabeaufschlagStandard,
          aufschlagModus,
          steuer,
        };

        for (const ziel of zielBetraege) {
          const ergebnis = berechneAnlagebetrag(ziel, eingaben);
          expect(ergebnis.ohneSteuerbetrachtung.ausschuettungBruttoMonat).toBeCloseTo(ziel, 8);
          expect(ergebnis.mitSteuerbetrachtung.ausschuettungNettoMonat).toBeCloseTo(ziel, 8);
        }
      }
    }
  });

  it.each(steuerVarianten)('Anlagebetrag -> Ziel -> Anlagebetrag (%s)', (_name, steuer) => {
    for (const fonds of FONDS) {
      for (const aufschlagModus of modi) {
        const eingaben: Eingaben = {
          fonds,
          ausgabeaufschlag: fonds.ausgabeaufschlagStandard,
          aufschlagModus,
          steuer,
        };

        for (const betrag of anlageBetraege) {
          const einkommen = berechneEinkommen(betrag, eingaben);
          const zurueck = berechneAnlagebetrag(einkommen.ausschuettungNettoMonat, eingaben);
          expect(zurueck.mitSteuerbetrachtung.anlagebetragBrutto).toBeCloseTo(betrag, 6);

          const zurueckBrutto = berechneAnlagebetrag(einkommen.ausschuettungBruttoMonat, eingaben);
          expect(zurueckBrutto.ohneSteuerbetrachtung.anlagebetragBrutto).toBeCloseTo(betrag, 6);
        }
      }
    }
  });

  it('haelt die Reihenfolge Netto <= Brutto in jeder Konstellation ein', () => {
    for (const [, steuer] of steuerVarianten) {
      for (const fonds of FONDS) {
        const e = berechneEinkommen(150000, {
          fonds,
          ausgabeaufschlag: fonds.ausgabeaufschlagStandard,
          aufschlagModus: 'auf_anteilwert',
          steuer,
        });
        expect(e.ausschuettungNettoJahr).toBeLessThanOrEqual(e.ausschuettungBruttoJahr + 1e-9);
        expect(e.effektiveSteuerquote).toBeGreaterThanOrEqual(0);
        expect(e.effektiveSteuerquote).toBeLessThan(1);
        expect(e.investiertesKapital).toBeLessThanOrEqual(e.anlagebetragBrutto + 1e-9);
      }
    }
  });
});

describe('Plausibilisierung am Original-Rechner', () => {
  it('reproduziert die Groessenordnung aus dem Screenshot (50 €/Monat, 4 % AA)', () => {
    // Screenshot: 50,00 € gewuenschtes Extra-Einkommen, 4 % Ausgabeaufschlag,
    // Steuern unberuecksichtigt -> Anlagebetrag 21.508,83 €.
    // Unser fiktiver Fonds mit 2,90 % Ausschuettungsrendite trifft das auf < 1 € genau.
    const fonds = FONDS.find((f) => f.id === 'meridian-sri-30-am');
    expect(fonds).toBeDefined();

    const ergebnis = berechneAnlagebetrag(50, {
      fonds: fonds!,
      ausgabeaufschlag: 0.04,
      aufschlagModus: 'auf_anteilwert',
      steuer: {
        vermoegensart: 'privat',
        freistellungsauftrag: 0,
        kirchensteuersatz: 0,
        soli: true,
        persoenlicherSteuersatz: 0.42,
      },
    });

    expect(ergebnis.ohneSteuerbetrachtung.investiertesKapital).toBeCloseTo(20682, 6);
    expect(ergebnis.ohneSteuerbetrachtung.anlagebetragBrutto).toBeCloseTo(21509.28, 2);
    expect(Math.abs(ergebnis.ohneSteuerbetrachtung.anlagebetragBrutto - 21508.83)).toBeLessThan(1);
  });
});
