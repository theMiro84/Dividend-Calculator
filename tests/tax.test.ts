import { describe, expect, it } from 'vitest';

import {
  besteuereAusschuettung,
  bruttoAusNetto,
  effektiverSteuersatz,
  nutzbarerFreistellungsauftrag,
  teilfreistellungssatz,
} from '../src/core/tax.js';
import type { SteuerEinstellungen } from '../src/core/types.js';
import { betrieb, privat } from './helpers.js';

describe('effektiverSteuersatz', () => {
  it('ergibt im Privatvermoegen ohne Kirchensteuer exakt 26,375 %', () => {
    expect(effektiverSteuersatz(privat())).toBeCloseTo(0.26375, 12);
  });

  it('ergibt ohne Soli genau die Abgeltungsteuer von 25 %', () => {
    expect(effektiverSteuersatz(privat({ soli: false }))).toBeCloseTo(0.25, 12);
  });

  it('beruecksichtigt die Minderung der Bemessungsgrundlage durch Kirchensteuer', () => {
    // s = 1 / (4 + k) * (1 + 0,055 + k)
    expect(effektiverSteuersatz(privat({ kirchensteuersatz: 0.09 }))).toBeCloseTo(0.2799511, 7);
    expect(effektiverSteuersatz(privat({ kirchensteuersatz: 0.08 }))).toBeCloseTo(0.27818627, 7);
  });

  it('bleibt mit Kirchensteuer unter dem naiven Aufschlag auf 26,375 %', () => {
    const naiv = 0.25 * (1 + 0.055 + 0.09);
    expect(effektiverSteuersatz(privat({ kirchensteuersatz: 0.09 }))).toBeLessThan(naiv);
  });

  it('nutzt im Betriebsvermoegen den persoenlichen Steuersatz', () => {
    expect(effektiverSteuersatz(betrieb())).toBeCloseTo(0.42 * 1.055, 12);
    expect(effektiverSteuersatz(betrieb({ kirchensteuersatz: 0.09 }))).toBeCloseTo(0.42 * 1.145, 12);
  });
});

describe('teilfreistellungssatz', () => {
  it('bildet die Saetze des § 20 InvStG ab', () => {
    expect(teilfreistellungssatz('aktienfonds', 'privat')).toBe(0.3);
    expect(teilfreistellungssatz('aktienfonds', 'betrieb')).toBe(0.6);
    expect(teilfreistellungssatz('mischfonds', 'privat')).toBe(0.15);
    expect(teilfreistellungssatz('mischfonds', 'betrieb')).toBe(0.3);
    expect(teilfreistellungssatz('immobilienfonds', 'privat')).toBe(0.6);
    expect(teilfreistellungssatz('immobilienfonds_ausland', 'privat')).toBe(0.8);
    expect(teilfreistellungssatz('sonstige', 'privat')).toBe(0);
  });
});

describe('nutzbarerFreistellungsauftrag', () => {
  it('gilt nicht im Betriebsvermoegen', () => {
    expect(nutzbarerFreistellungsauftrag(betrieb({ freistellungsauftrag: 1000 }))).toBe(0);
  });

  it('wird nie negativ', () => {
    expect(nutzbarerFreistellungsauftrag(privat({ freistellungsauftrag: -50 }))).toBe(0);
  });
});

describe('besteuereAusschuettung', () => {
  it('rechnet Teilfreistellung vor Freistellungsauftrag', () => {
    const a = besteuereAusschuettung(4000, 'mischfonds', privat({ freistellungsauftrag: 1000 }));

    expect(a.teilfreistellungsbetrag).toBeCloseTo(600, 10);
    expect(a.betragNachErstemAbzug).toBeCloseTo(3400, 10);
    expect(a.freistellungsauftragGenutzt).toBeCloseTo(1000, 10);
    expect(a.bemessungsgrundlage).toBeCloseTo(2400, 10);
    expect(a.steuer).toBeCloseTo(633, 10); // 2400 * 26,375 %
    expect(a.netto).toBeCloseTo(3367, 10);
  });

  it('laesst die Ausschuettung steuerfrei, solange der Freistellungsauftrag reicht', () => {
    const a = besteuereAusschuettung(1000, 'mischfonds', privat({ freistellungsauftrag: 1000 }));

    expect(a.betragNachErstemAbzug).toBeCloseTo(850, 10);
    expect(a.freistellungsauftragGenutzt).toBeCloseTo(850, 10);
    expect(a.bemessungsgrundlage).toBe(0);
    expect(a.steuer).toBe(0);
    expect(a.netto).toBeCloseTo(1000, 10);
  });

  it('besteuert Rentenfonds voll (keine Teilfreistellung)', () => {
    const a = besteuereAusschuettung(1000, 'sonstige', privat());

    expect(a.teilfreistellungsbetrag).toBe(0);
    expect(a.bemessungsgrundlage).toBeCloseTo(1000, 10);
    expect(a.steuer).toBeCloseTo(263.75, 10);
  });

  it('entlastet Auslandsimmobilienfonds am staerksten', () => {
    const immo = besteuereAusschuettung(1000, 'immobilienfonds_ausland', privat());
    const renten = besteuereAusschuettung(1000, 'sonstige', privat());

    expect(immo.steuer).toBeCloseTo(renten.steuer * 0.2, 10);
  });

  it('zieht im Modus "vor_teilfreistellung" zuerst den Freistellungsauftrag ab', () => {
    const a = besteuereAusschuettung(
      4000,
      'mischfonds',
      privat({ freistellungsauftrag: 1000, freistellungsauftragModus: 'vor_teilfreistellung' }),
    );

    expect(a.freistellungsauftragGenutzt).toBeCloseTo(1000, 10);
    expect(a.betragNachErstemAbzug).toBeCloseTo(3000, 10);
    expect(a.teilfreistellungsbetrag).toBeCloseTo(450, 10);
    expect(a.bemessungsgrundlage).toBeCloseTo(2550, 10);
    expect(a.steuer).toBeCloseTo(672.5625, 10); // 2550 * 26,375 %
  });

  it('besteuert in der vereinfachten Reihenfolge staerker', () => {
    const gesetzlich = besteuereAusschuettung(4000, 'mischfonds', privat({ freistellungsauftrag: 1000 }));
    const vereinfacht = besteuereAusschuettung(
      4000,
      'mischfonds',
      privat({ freistellungsauftrag: 1000, freistellungsauftragModus: 'vor_teilfreistellung' }),
    );

    expect(vereinfacht.steuer).toBeGreaterThan(gesetzlich.steuer);
    // Der Unterschied ist genau der Teilfreistellungsanteil des Freistellungsauftrags:
    expect(vereinfacht.steuer - gesetzlich.steuer).toBeCloseTo(1000 * 0.15 * 0.26375, 10);
  });

  it('ist ohne Freistellungsauftrag in beiden Reihenfolgen identisch', () => {
    const a = besteuereAusschuettung(4000, 'mischfonds', privat());
    const b = besteuereAusschuettung(
      4000,
      'mischfonds',
      privat({ freistellungsauftragModus: 'vor_teilfreistellung' }),
    );
    expect(b.steuer).toBeCloseTo(a.steuer, 10);
  });

  it('liefert bei Bruttoausschuettung 0 keine Steuer', () => {
    const a = besteuereAusschuettung(0, 'aktienfonds', privat({ freistellungsauftrag: 1000 }));
    expect(a.steuer).toBe(0);
    expect(a.netto).toBe(0);
  });
});

describe('bruttoAusNetto', () => {
  const faelle: ReadonlyArray<[string, SteuerEinstellungen]> = [
    ['privat ohne FSA', privat()],
    ['privat mit FSA 1.000', privat({ freistellungsauftrag: 1000 })],
    ['privat mit FSA 2.000 und Kirchensteuer', privat({ freistellungsauftrag: 2000, kirchensteuersatz: 0.09 })],
    ['privat ohne Soli', privat({ soli: false })],
    ['betrieb 42 %', betrieb()],
    ['betrieb 30 % mit Kirchensteuer', betrieb({ persoenlicherSteuersatz: 0.3, kirchensteuersatz: 0.08 })],
    [
      'privat, FSA 1.000, Freistellung vor Teilfreistellung',
      privat({ freistellungsauftrag: 1000, freistellungsauftragModus: 'vor_teilfreistellung' }),
    ],
  ];

  const typen = ['aktienfonds', 'mischfonds', 'immobilienfonds', 'immobilienfonds_ausland', 'sonstige'] as const;
  const nettoWerte = [0, 1, 250, 600, 849.99, 850, 850.01, 1200, 3000, 25000, 1_000_000];

  it.each(faelle)('ist exakte Umkehrung der Vorwaertsrechnung (%s)', (_name, einstellungen) => {
    for (const typ of typen) {
      for (const netto of nettoWerte) {
        const brutto = bruttoAusNetto(netto, typ, einstellungen);
        const zurueck = besteuereAusschuettung(brutto, typ, einstellungen);
        expect(zurueck.netto).toBeCloseTo(netto, 8);
      }
    }
  });

  it('ist monoton steigend', () => {
    const einstellungen = privat({ freistellungsauftrag: 1000 });
    let vorher = -1;
    for (let netto = 0; netto <= 5000; netto += 25) {
      const brutto = bruttoAusNetto(netto, 'mischfonds', einstellungen);
      expect(brutto).toBeGreaterThan(vorher);
      vorher = brutto;
    }
  });

  it('ist unterhalb des Knicks die Identitaet', () => {
    const einstellungen = privat({ freistellungsauftrag: 1000 });
    // Knick bei brutto = 1000 / 0,85 = 1176,47
    expect(bruttoAusNetto(1000, 'mischfonds', einstellungen)).toBeCloseTo(1000, 10);
    expect(bruttoAusNetto(1176.47, 'mischfonds', einstellungen)).toBeCloseTo(1176.47, 10);
    expect(bruttoAusNetto(1200, 'mischfonds', einstellungen)).toBeGreaterThan(1200);
  });

  it('ist am Knick stetig', () => {
    const einstellungen = privat({ freistellungsauftrag: 1000 });
    const knick = 1000 / 0.85;
    const links = bruttoAusNetto(knick - 1e-6, 'mischfonds', einstellungen);
    const rechts = bruttoAusNetto(knick + 1e-6, 'mischfonds', einstellungen);
    expect(rechts - links).toBeLessThan(1e-4);
  });

  it('gibt bei nicht positivem Netto 0 zurueck', () => {
    expect(bruttoAusNetto(0, 'aktienfonds', privat())).toBe(0);
    expect(bruttoAusNetto(-10, 'aktienfonds', privat())).toBe(0);
  });
});
