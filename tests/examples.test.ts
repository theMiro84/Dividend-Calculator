/**
 * Pinning-Tests fuer die drei Beispiele aus src/examples.ts.
 *
 * Die Erwartungswerte sind die in theorie.html von Hand nachgerechneten Zahlen.
 * Aendert sich das Modell, fallen diese Tests - genau das ist beabsichtigt.
 */

import { describe, expect, it } from 'vitest';

import { berechneAnlagebetrag, berechneEinkommen } from '../src/core/calculator.js';
import { BEISPIELE, eingabenAusBeispiel, findeBeispiel } from '../src/examples.js';

describe('Beispiel 1 - 250 € netto pro Monat (Mischfonds, 4 % Rendite)', () => {
  const beispiel = findeBeispiel('beispiel-1');
  const ergebnis = berechneAnlagebetrag(beispiel.betrag, eingabenAusBeispiel(beispiel));

  it('braucht ohne Steuerbetrachtung glatte 78.000 €', () => {
    const e = ergebnis.ohneSteuerbetrachtung;
    expect(e.investiertesKapital).toBeCloseTo(75000, 6); // 3.000 € / 4 %
    expect(e.anlagebetragBrutto).toBeCloseTo(78000, 6); // + 4 % Ausgabeaufschlag
    expect(e.ausschuettungBruttoMonat).toBeCloseTo(250, 8);
  });

  it('braucht mit Steuerbetrachtung rund 91.700 €', () => {
    const e = ergebnis.mitSteuerbetrachtung;
    expect(e.ausschuettungBruttoJahr).toBeCloseTo(3526.95, 2);
    expect(e.investiertesKapital).toBeCloseTo(88173.69, 2);
    expect(e.anlagebetragBrutto).toBeCloseTo(91700.64, 2);
    expect(e.ausschuettungNettoMonat).toBeCloseTo(250, 8);
    expect(e.freistellungsauftragGenutzt).toBeCloseTo(1000, 8);
    expect(e.steuerJahr).toBeCloseTo(526.95, 2);
  });

  it('kostet die Steuer rund 17,6 % mehr Kapital', () => {
    const aufschlag =
      ergebnis.mitSteuerbetrachtung.anlagebetragBrutto /
        ergebnis.ohneSteuerbetrachtung.anlagebetragBrutto -
      1;
    expect(aufschlag).toBeCloseTo(0.1757, 3);
  });
});

describe('Beispiel 2 - 100.000 € im Aktienfonds mit 5 % Rendite', () => {
  const beispiel = findeBeispiel('beispiel-2');
  const e = berechneEinkommen(beispiel.betrag, eingabenAusBeispiel(beispiel));

  it('rechnet den Ausgabeaufschlag von 5 % heraus', () => {
    expect(e.investiertesKapital).toBeCloseTo(95238.1, 1);
    expect(e.ausgabeaufschlagBetrag).toBeCloseTo(4761.9, 1);
    expect(e.anteile).toBeCloseTo(793.6508, 4);
  });

  it('ergibt 396,83 € brutto und 342,39 € netto pro Monat', () => {
    expect(e.ausschuettungBruttoJahr).toBeCloseTo(4761.9, 1);
    expect(e.ausschuettungBruttoMonat).toBeCloseTo(396.83, 2);
    expect(e.ausschuettungNettoMonat).toBeCloseTo(342.39, 2);
  });

  it('setzt 30 % Teilfreistellung und Kirchensteuer korrekt an', () => {
    expect(e.teilfreistellungssatz).toBe(0.3);
    expect(e.steuersatz).toBeCloseTo(0.2799511, 7);
    expect(e.bemessungsgrundlage).toBeCloseTo(2333.33, 2);
    expect(e.steuerJahr).toBeCloseTo(653.22, 2);
    expect(e.effektiveSteuerquote).toBeCloseTo(0.13718, 4);
  });
});

describe('Beispiel 3 - 500 € netto im Betriebsvermögen (Auslandsimmobilien)', () => {
  const beispiel = findeBeispiel('beispiel-3');
  const ergebnis = berechneAnlagebetrag(beispiel.betrag, eingabenAusBeispiel(beispiel));

  it('nutzt 80 % Teilfreistellung und den persoenlichen Steuersatz', () => {
    const e = ergebnis.mitSteuerbetrachtung;
    expect(e.teilfreistellungssatz).toBe(0.8);
    expect(e.steuersatz).toBeCloseTo(0.4431, 8);
    expect(e.freistellungsauftragGenutzt).toBe(0); // kein Sparer-Pauschbetrag im BV
  });

  it('braucht rund 172.800 € statt 157.500 €', () => {
    expect(ergebnis.ohneSteuerbetrachtung.anlagebetragBrutto).toBeCloseTo(157500, 6);
    expect(ergebnis.mitSteuerbetrachtung.anlagebetragBrutto).toBeCloseTo(172814.85, 2);
    expect(ergebnis.mitSteuerbetrachtung.ausschuettungNettoMonat).toBeCloseTo(500, 8);
  });
});

describe('Alle Beispiele', () => {
  it('verweisen auf existierende Fonds und plausible Parameter', () => {
    for (const beispiel of BEISPIELE) {
      const eingaben = eingabenAusBeispiel(beispiel);
      expect(eingaben.fonds.id).toBe(beispiel.fondsId);
      expect(beispiel.ausgabeaufschlag).toBeGreaterThanOrEqual(0);
      expect(beispiel.ausgabeaufschlag).toBeLessThan(0.1);
      expect(beispiel.betrag).toBeGreaterThan(0);
    }
  });

  it('lassen sich in beide Richtungen ohne Fehler rechnen', () => {
    for (const beispiel of BEISPIELE) {
      const eingaben = eingabenAusBeispiel(beispiel);
      expect(() => berechneAnlagebetrag(beispiel.betrag, eingaben)).not.toThrow();
      expect(() => berechneEinkommen(beispiel.betrag, eingaben)).not.toThrow();
    }
  });
});
