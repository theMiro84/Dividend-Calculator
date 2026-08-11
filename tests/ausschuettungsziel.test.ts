/**
 * Die Ausschuettung je Anteil ist bei Fonds mit Zielquote keine freie
 * Stammdatengroesse, sondern folgt aus Quote und Basispreis:
 *
 *   "Die Ausschuettung wird jedes Jahr Anfang Januar fuer die folgenden
 *    12 Monate auf 3,0 %, bzw. 4,0 % oder 6,0 % p. a. festgelegt. Die Basis ist
 *    der letzte Anteilspreis des Vorjahres, deshalb kann die Ausschuettung in
 *    Euro jaehrlich schwanken. Um die Ausschuettung zu gewaehrleisten, koennen
 *    bei Bedarf die ordentlichen Ertraege um eine Substanzausschuettung
 *    ergaenzt werden. Die Ausschuettungen erfolgen anteilig jeweils am 15.
 *    eines Monats."
 *
 * Diese Tests halten die Konsistenz zwischen beiden Angaben fest. Fuer eine
 * spaetere Anbindung echter Fondsdaten ist das die entscheidende Invariante:
 * Der Anteilpreis aktualisiert sich taeglich, die Ausschuettung je Anteil aber
 * nur einmal im Jahr. Wer beim Kursupdate versehentlich auch die Ausschuettung
 * mitzieht, bekaeme dauerhaft die Zielquote statt der laufenden Rendite - und
 * damit systematisch zu niedrige Anlagebetraege.
 */

import { describe, expect, it } from 'vitest';

import {
  ausschuettungJeAnteilAusZiel,
  ausschuettungsrendite,
  laufendeRenditeAusZiel,
  wertentwicklungSeitZielfestlegung,
} from '../src/core/calculator.js';
import { FONDS, findeFonds } from '../src/data/funds.js';

const mitZiel = FONDS.filter((f) => f.ausschuettungsziel !== undefined);

describe('Fonds mit Ausschüttungsziel', () => {
  it('gibt es im Datenbestand', () => {
    expect(mitZiel.map((f) => f.id)).toEqual(['meridian-sri-30-am', 'meridian-sri-75-am']);
  });

  it.each(mitZiel.map((f) => [f.id, f] as const))(
    'leitet bei %s die hinterlegte Ausschüttung je Anteil aus der Zielquote ab',
    (_id, fonds) => {
      const ziel = fonds.ausschuettungsziel;
      expect(ziel).toBeDefined();
      expect(ausschuettungJeAnteilAusZiel(ziel!, fonds.frequenz)).toBeCloseTo(
        fonds.ausschuettungJeAnteil,
        10,
      );
    },
  );

  it.each(mitZiel.map((f) => [f.id, f] as const))(
    'liefert bei %s dieselbe laufende Rendite wie die direkte Rechnung',
    (_id, fonds) => {
      expect(laufendeRenditeAusZiel(fonds.ausschuettungsziel!, fonds.anteilwert)).toBeCloseTo(
        ausschuettungsrendite(fonds),
        12,
      );
    },
  );
});

describe('Zielquote gegen laufende Rendite', () => {
  it('trennt sie genau um die Kursentwicklung seit Jahresbeginn', () => {
    // r = z / (1 + w)
    for (const fonds of mitZiel) {
      const ziel = fonds.ausschuettungsziel!;
      const w = wertentwicklungSeitZielfestlegung(ziel, fonds.anteilwert);
      expect(laufendeRenditeAusZiel(ziel, fonds.anteilwert)).toBeCloseTo(ziel.quote / (1 + w), 12);
    }
  });

  it('rechnet den SRI 30 nach: 3,00 % Zusage, 3,6345 % Kursplus, 2,8948 % laufend', () => {
    const fonds = findeFonds('meridian-sri-30-am');
    const ziel = fonds.ausschuettungsziel!;

    expect(ziel.quote).toBe(0.03);
    expect(ziel.basisAnteilpreis).toBe(101.472);
    expect(ausschuettungJeAnteilAusZiel(ziel, 12)).toBeCloseTo(0.25368, 10);
    expect(wertentwicklungSeitZielfestlegung(ziel, fonds.anteilwert)).toBeCloseTo(0.036345, 6);
    expect(laufendeRenditeAusZiel(ziel, fonds.anteilwert)).toBeCloseTo(0.028948, 6);
  });

  it('rechnet den SRI 75 nach: 6,00 % Zusage, 9,1146 % Kursplus, 5,4988 % laufend', () => {
    const fonds = findeFonds('meridian-sri-75-am');
    const ziel = fonds.ausschuettungsziel!;

    expect(ziel.quote).toBe(0.06);
    expect(ausschuettungJeAnteilAusZiel(ziel, 12)).toBeCloseTo(0.51785, 10);
    expect(wertentwicklungSeitZielfestlegung(ziel, fonds.anteilwert)).toBeCloseTo(0.091146, 6);
    expect(laufendeRenditeAusZiel(ziel, fonds.anteilwert)).toBeCloseTo(0.054988, 6);
  });

  it('lässt die laufende Rendite bei steigendem Kurs sinken – die Zusage bleibt', () => {
    const ziel = { quote: 0.03, basisAnteilpreis: 100 };

    expect(laufendeRenditeAusZiel(ziel, 100)).toBeCloseTo(0.03, 12); // Jahresanfang
    expect(laufendeRenditeAusZiel(ziel, 110)).toBeCloseTo(0.03 / 1.1, 12); // + 10 %
    expect(laufendeRenditeAusZiel(ziel, 90)).toBeCloseTo(0.03 / 0.9, 12); // − 10 %

    // Die Ausschüttung je Anteil bleibt davon unberührt.
    expect(ausschuettungJeAnteilAusZiel(ziel, 12)).toBeCloseTo(0.25, 12);
  });

  it('weist einen unmöglichen Anteilpreis zurück', () => {
    expect(() => laufendeRenditeAusZiel({ quote: 0.03, basisAnteilpreis: 100 }, 0)).toThrow();
    expect(() => laufendeRenditeAusZiel({ quote: 0.03, basisAnteilpreis: 100 }, -5)).toThrow();
  });
});
