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
import { betrieb, privat } from './helpers.js';

const steuerVarianten: ReadonlyArray<readonly [string, SteuerEinstellungen]> = [
  ['privat, kein FSA', privat()],
  ['privat, FSA 1.000 €', privat({ freistellungsauftrag: 1000 })],
  [
    'privat, FSA 2.000 €, Kirchensteuer 9 %',
    privat({ freistellungsauftrag: 2000, kirchensteuersatz: 0.09 }),
  ],
  [
    'privat, FSA 1.000 €, Freistellung vor Teilfreistellung',
    privat({ freistellungsauftrag: 1000, freistellungsauftragModus: 'vor_teilfreistellung' }),
  ],
  ['betrieb, 42 %', betrieb()],
  [
    'betrieb, 30 % mit Kirchensteuer 8 %',
    betrieb({ persoenlicherSteuersatz: 0.3, kirchensteuersatz: 0.08 }),
  ],
];

const modi: readonly AufschlagModus[] = ['auf_anteilwert', 'im_anlagebetrag'];
const zielBetraege = [0, 25, 50, 100, 250, 500, 1000, 2500];
const anlageBetraege = [0, 1000, 10000, 21555.98, 100000, 250000, 1_000_000];

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
