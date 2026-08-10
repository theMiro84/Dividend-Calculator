import { describe, expect, it } from 'vitest';

import {
  formatAnteile,
  formatEuro,
  formatEuroGenau,
  formatProzent,
  formatZahl,
  parseDeutscheZahl,
} from '../src/core/format.js';

// Intl liefert ein schmales geschuetztes Leerzeichen - fuer den Vergleich normalisieren.
const norm = (s: string): string => s.replace(/ | /g, ' ');

describe('Formatierung', () => {
  it('formatiert Euro im deutschen Format', () => {
    expect(norm(formatEuro(21508.83))).toBe('21.508,83 €');
    expect(norm(formatEuro(0))).toBe('0,00 €');
    expect(norm(formatEuro(1000000))).toBe('1.000.000,00 €');
  });

  it('formatiert Prozentwerte aus Dezimalanteilen', () => {
    expect(norm(formatProzent(0.04))).toBe('4,00 %');
    expect(norm(formatProzent(0.26375, 4))).toBe('26,3750 %');
  });

  it('formatiert Anteile mit vier Nachkommastellen', () => {
    expect(formatAnteile(793.65079365)).toBe('793,6508');
  });

  it('formatiert Zahlen mit waehlbarer Genauigkeit', () => {
    expect(formatZahl(1234.5678, 3)).toBe('1.234,568');
    expect(formatZahl(1234.5678, 0)).toBe('1.235');
  });
});

describe('parseDeutscheZahl', () => {
  it('liest deutsche Zahlen mit Tausenderpunkt und Komma', () => {
    expect(parseDeutscheZahl('21.508,83')).toBeCloseTo(21508.83, 10);
    expect(parseDeutscheZahl('1.000.000,00')).toBeCloseTo(1000000, 10);
    expect(parseDeutscheZahl('50,00')).toBeCloseTo(50, 10);
    expect(parseDeutscheZahl('4,5')).toBeCloseTo(4.5, 10);
  });

  it('erkennt einen Punkt mit drei Ziffern als Tausendertrennzeichen', () => {
    expect(parseDeutscheZahl('1.000')).toBeCloseTo(1000, 10);
    expect(parseDeutscheZahl('100.000')).toBeCloseTo(100000, 10);
  });

  it('erkennt einen Punkt sonst als Dezimaltrennzeichen', () => {
    expect(parseDeutscheZahl('4.5')).toBeCloseTo(4.5, 10);
    expect(parseDeutscheZahl('0.25')).toBeCloseTo(0.25, 10);
  });

  it('ignoriert Waehrungs- und Prozentzeichen sowie Leerzeichen', () => {
    expect(parseDeutscheZahl(' 1.234,50 € ')).toBeCloseTo(1234.5, 10);
    expect(parseDeutscheZahl('4,00 %')).toBeCloseTo(4, 10);
  });

  it('liest ganze Zahlen ohne Trennzeichen', () => {
    expect(parseDeutscheZahl('250')).toBe(250);
    expect(parseDeutscheZahl('0')).toBe(0);
  });

  it('gibt null fuer ungueltige Eingaben zurueck', () => {
    expect(parseDeutscheZahl('')).toBeNull();
    expect(parseDeutscheZahl('   ')).toBeNull();
    expect(parseDeutscheZahl('abc')).toBeNull();
    expect(parseDeutscheZahl('1,2,3')).toBeNull();
    expect(parseDeutscheZahl(',')).toBeNull();
  });

  it('ist invers zur Formatierung', () => {
    for (const wert of [0, 12.34, 250, 21508.83, 91700.64, 1000000]) {
      const text = formatZahl(wert, 2);
      expect(parseDeutscheZahl(text)).toBeCloseTo(wert, 8);
    }
  });
});

describe('formatEuroGenau', () => {
  it('zeigt so viele Nachkommastellen wie noetig (zwei bis fuenf)', () => {
    expect(norm(formatEuroGenau(0.25368))).toBe('0,25368 €');
    expect(norm(formatEuroGenau(0.25))).toBe('0,25 €');
    expect(norm(formatEuroGenau(2.8))).toBe('2,80 €');
  });

  it('rundet die entscheidende Information nicht weg', () => {
    expect(norm(formatEuro(0.25368))).toBe('0,25 €');
    expect(norm(formatEuroGenau(0.25368))).not.toBe(norm(formatEuro(0.25368)));
  });
});
