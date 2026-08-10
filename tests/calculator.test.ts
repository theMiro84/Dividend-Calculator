import { describe, expect, it } from 'vitest';

import {
  anlagebetragAusKapital,
  anlagebetragFreistellungsauftragAusgeschoepft,
  ausschuettungsrendite,
  berechneAnlagebetrag,
  berechneEinkommen,
  kapitalAusAnlagebetrag,
} from '../src/core/calculator.js';
import type { Eingaben } from '../src/core/calculator.js';
import { findeFonds } from '../src/data/funds.js';
import { betrieb, privat } from './helpers.js';

const eingaben = (u: Partial<Eingaben> = {}): Eingaben => ({
  fonds: findeFonds('meridian-multi-asset-30-am'),
  ausgabeaufschlag: 0.04,
  aufschlagModus: 'auf_anteilwert',
  steuer: privat(),
  ...u,
});

describe('ausschuettungsrendite', () => {
  it('rechnet je Anteil x Termine / Anteilwert', () => {
    expect(ausschuettungsrendite(findeFonds('meridian-multi-asset-30-am'))).toBeCloseTo(0.03, 12);
    expect(ausschuettungsrendite(findeFonds('meridian-multi-asset-50-am'))).toBeCloseTo(0.04, 12);
    expect(ausschuettungsrendite(findeFonds('meridian-global-dividend-am'))).toBeCloseTo(0.05, 12);
    expect(ausschuettungsrendite(findeFonds('meridian-real-estate-aq'))).toBeCloseTo(0.035, 12);
    expect(ausschuettungsrendite(findeFonds('meridian-global-property-aq'))).toBeCloseTo(0.04, 12);
    expect(ausschuettungsrendite(findeFonds('meridian-corporate-bond-am'))).toBeCloseTo(0.03, 12);
    expect(ausschuettungsrendite(findeFonds('meridian-balanced-25-aj'))).toBeCloseTo(0.035, 12);
  });

  it('ist unabhaengig von der Frequenz, wenn die Jahressumme gleich ist', () => {
    const monatlich = ausschuettungsrendite(findeFonds('meridian-real-estate-aq'));
    const jaehrlich = ausschuettungsrendite(findeFonds('meridian-balanced-25-aj'));
    expect(monatlich).toBeCloseTo(jaehrlich, 12);
  });
});

describe('Ausgabeaufschlag', () => {
  it('rechnet in der Konvention "auf den Anteilwert" mit (1 + a)', () => {
    expect(anlagebetragAusKapital(20000, 0.04, 'auf_anteilwert')).toBeCloseTo(20800, 10);
    expect(kapitalAusAnlagebetrag(20800, 0.04, 'auf_anteilwert')).toBeCloseTo(20000, 10);
  });

  it('rechnet in der Konvention "im Anlagebetrag enthalten" mit 1 / (1 - a)', () => {
    expect(anlagebetragAusKapital(20000, 0.04, 'im_anlagebetrag')).toBeCloseTo(20833.333333, 6);
    expect(kapitalAusAnlagebetrag(20833.333333, 0.04, 'im_anlagebetrag')).toBeCloseTo(20000, 5);
  });

  it('unterscheidet sich zwischen beiden Konventionen um a² / (1 - a²)', () => {
    // (1/(1-a)) / (1+a) - 1 = 1/(1-a²) - 1 = a² / (1-a²)
    for (const a of [0.01, 0.04, 0.05]) {
      const aufAnteilwert = anlagebetragAusKapital(20000, a, 'auf_anteilwert');
      const imAnlagebetrag = anlagebetragAusKapital(20000, a, 'im_anlagebetrag');
      expect((imAnlagebetrag - aufAnteilwert) / aufAnteilwert).toBeCloseTo(
        (a * a) / (1 - a * a),
        12,
      );
    }
    // Bei 4 % sind das rund 0,16 % - klein, aber nicht null.
    expect(0.04 ** 2 / (1 - 0.04 ** 2)).toBeCloseTo(0.0016026, 7);
  });

  it('ist bei 0 % Aufschlag in beiden Konventionen identisch', () => {
    expect(anlagebetragAusKapital(50000, 0, 'auf_anteilwert')).toBe(50000);
    expect(anlagebetragAusKapital(50000, 0, 'im_anlagebetrag')).toBe(50000);
  });
});

describe('berechneEinkommen (Richtung: Anlagebetrag -> Einkommen)', () => {
  it('rechnet das Referenzbeispiel 100.000 € / 3 % / 4 % AA korrekt', () => {
    const e = berechneEinkommen(100000, eingaben({ steuer: privat({ freistellungsauftrag: 1000 }) }));

    expect(e.investiertesKapital).toBeCloseTo(96153.846154, 6); // 100.000 / 1,04
    expect(e.ausgabeaufschlagBetrag).toBeCloseTo(3846.153846, 6);
    expect(e.anteile).toBeCloseTo(961.538462, 6); // Anteilwert 100 €
    expect(e.ausschuettungBruttoJahr).toBeCloseTo(2884.615385, 6);
    expect(e.ausschuettungBruttoMonat).toBeCloseTo(240.384615, 6);

    expect(e.teilfreistellungsbetrag).toBeCloseTo(432.692308, 6);
    expect(e.betragNachErstemAbzug).toBeCloseTo(2451.923077, 6);
    expect(e.freistellungsauftragGenutzt).toBeCloseTo(1000, 10);
    expect(e.bemessungsgrundlage).toBeCloseTo(1451.923077, 6);
    expect(e.steuerJahr).toBeCloseTo(382.944712, 6);
    expect(e.ausschuettungNettoJahr).toBeCloseTo(2501.670673, 6);
    expect(e.ausschuettungNettoMonat).toBeCloseTo(208.472556, 6);
  });

  it('weist Ausschuettung = Kapital x Rendite aus', () => {
    for (const betrag of [1000, 25000, 100000, 750000]) {
      const e = berechneEinkommen(betrag, eingaben());
      expect(e.ausschuettungBruttoJahr).toBeCloseTo(e.investiertesKapital * 0.03, 8);
    }
  });

  it('trifft bei monatlicher Ausschuettung genau Anteile x Ausschuettung je Anteil', () => {
    const e = berechneEinkommen(100000, eingaben());
    expect(e.ausschuettungBruttoMonat).toBeCloseTo(e.anteile * 0.25, 8);
  });

  it('glaettet bei jaehrlicher Ausschuettung auf zwoelf Monate', () => {
    const e = berechneEinkommen(100000, eingaben({ fonds: findeFonds('meridian-balanced-25-aj') }));
    expect(e.ausschuettungBruttoJahr).toBeCloseTo(96153.846154 * 0.035, 6);
    expect(e.ausschuettungBruttoMonat).toBeCloseTo(e.ausschuettungBruttoJahr / 12, 10);
  });

  it('ist streng monoton im Anlagebetrag', () => {
    let vorher = -1;
    for (let betrag = 0; betrag <= 500000; betrag += 5000) {
      const e = berechneEinkommen(betrag, eingaben({ steuer: privat({ freistellungsauftrag: 1000 }) }));
      expect(e.ausschuettungNettoJahr).toBeGreaterThan(vorher);
      vorher = e.ausschuettungNettoJahr;
    }
  });

  it('skaliert die Bruttoausschuettung linear mit dem Anlagebetrag', () => {
    const a = berechneEinkommen(50000, eingaben());
    const b = berechneEinkommen(150000, eingaben());
    expect(b.ausschuettungBruttoJahr).toBeCloseTo(a.ausschuettungBruttoJahr * 3, 8);
  });

  it('liefert bei Anlagebetrag 0 lauter Nullen', () => {
    const e = berechneEinkommen(0, eingaben());
    expect(e.ausschuettungBruttoJahr).toBe(0);
    expect(e.steuerJahr).toBe(0);
    expect(e.ausschuettungNettoMonat).toBe(0);
    expect(e.effektiveSteuerquote).toBe(0);
  });

  it('besteuert im Betriebsvermoegen anders als im Privatvermoegen', () => {
    const pv = berechneEinkommen(200000, eingaben({ steuer: privat() }));
    const bv = berechneEinkommen(
      200000,
      eingaben({
        steuer: betrieb(),
      }),
    );

    // Mischfonds: 15 % vs. 30 % Teilfreistellung, 26,375 % vs. 44,31 % Steuersatz
    expect(pv.teilfreistellungssatz).toBe(0.15);
    expect(bv.teilfreistellungssatz).toBe(0.3);
    expect(bv.steuerJahr).toBeGreaterThan(pv.steuerJahr);
    expect(bv.effektiveSteuerquote).toBeCloseTo(0.7 * 0.4431, 8);
  });

  it('weist Fehler bei unzulaessigen Eingaben aus', () => {
    expect(() => berechneEinkommen(-1, eingaben())).toThrow();
    expect(() => berechneEinkommen(1000, eingaben({ ausgabeaufschlag: 1 }))).toThrow();
    expect(() => berechneEinkommen(1000, eingaben({ ausgabeaufschlag: -0.1 }))).toThrow();
    expect(() =>
      berechneEinkommen(1000, eingaben({ steuer: privat({ freistellungsauftrag: -5 }) })),
    ).toThrow();
  });
});

describe('berechneAnlagebetrag (Richtung: Einkommen -> Anlagebetrag)', () => {
  it('rechnet die steuerfreie Variante glatt', () => {
    // 250 € brutto/Monat = 3.000 €/Jahr bei 3 % -> 100.000 € Kapital -> 104.000 € Anlagebetrag
    const e = berechneAnlagebetrag(250, eingaben());
    expect(e.ohneSteuerbetrachtung.anlagebetragBrutto).toBeCloseTo(104000, 6);
    expect(e.ohneSteuerbetrachtung.investiertesKapital).toBeCloseTo(100000, 6);
    expect(e.ohneSteuerbetrachtung.ausschuettungBruttoMonat).toBeCloseTo(250, 8);
  });

  it('verlangt fuer denselben Nettobetrag mehr Kapital', () => {
    const e = berechneAnlagebetrag(250, eingaben());
    expect(e.mitSteuerbetrachtung.anlagebetragBrutto).toBeGreaterThan(
      e.ohneSteuerbetrachtung.anlagebetragBrutto,
    );
    expect(e.mitSteuerbetrachtung.ausschuettungNettoMonat).toBeCloseTo(250, 8);
  });

  it('ist bei vollstaendig gedecktem Freistellungsauftrag in beiden Varianten gleich', () => {
    // 60 €/Monat = 720 €/Jahr brutto, davon 85 % steuerpflichtig = 612 € < 1.000 € FSA
    const e = berechneAnlagebetrag(60, eingaben({ steuer: privat({ freistellungsauftrag: 1000 }) }));
    expect(e.mitSteuerbetrachtung.anlagebetragBrutto).toBeCloseTo(
      e.ohneSteuerbetrachtung.anlagebetragBrutto,
      8,
    );
    expect(e.mitSteuerbetrachtung.steuerJahr).toBe(0);
  });

  it('liefert bei Ziel 0 einen Anlagebetrag von 0', () => {
    const e = berechneAnlagebetrag(0, eingaben());
    expect(e.ohneSteuerbetrachtung.anlagebetragBrutto).toBe(0);
    expect(e.mitSteuerbetrachtung.anlagebetragBrutto).toBe(0);
  });

  it('weist negative Ziele zurueck', () => {
    expect(() => berechneAnlagebetrag(-5, eingaben())).toThrow();
  });
});

describe('anlagebetragFreistellungsauftragAusgeschoepft', () => {
  it('markiert genau den Knick der Steuerkurve', () => {
    const input = eingaben({ steuer: privat({ freistellungsauftrag: 1000 }) });
    const knick = anlagebetragFreistellungsauftragAusgeschoepft(input);

    const genauAmKnick = berechneEinkommen(knick, input);
    expect(genauAmKnick.bemessungsgrundlage).toBeCloseTo(0, 8);
    expect(genauAmKnick.steuerJahr).toBeCloseTo(0, 8);

    const knappDarueber = berechneEinkommen(knick + 100, input);
    expect(knappDarueber.steuerJahr).toBeGreaterThan(0);

    const knappDarunter = berechneEinkommen(knick - 100, input);
    expect(knappDarunter.steuerJahr).toBe(0);
  });

  it('ist 0, wenn kein Freistellungsauftrag vorliegt', () => {
    expect(anlagebetragFreistellungsauftragAusgeschoepft(eingaben())).toBe(0);
  });
});
