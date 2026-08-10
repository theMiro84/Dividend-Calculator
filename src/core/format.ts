/** Formatierung und Parsing im deutschen Zahlenformat. */

const euroFormat = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const zahlFormat = (nachkommastellen: number): Intl.NumberFormat =>
  new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: nachkommastellen,
    maximumFractionDigits: nachkommastellen,
  });

export function formatEuro(wert: number): string {
  return euroFormat.format(wert);
}

export function formatZahl(wert: number, nachkommastellen = 2): string {
  return zahlFormat(nachkommastellen).format(wert);
}

/** Erwartet einen Dezimalanteil (0.04) und gibt "4,00 %" zurueck. */
export function formatProzent(anteil: number, nachkommastellen = 2): string {
  return `${zahlFormat(nachkommastellen).format(anteil * 100)} %`;
}

export function formatAnteile(anteile: number): string {
  return zahlFormat(4).format(anteile);
}

/**
 * Liest eine Zahl im deutschen Format ("21.508,83", "4,5", "1.000").
 *
 * Heuristik, wenn nur Punkte vorkommen: Ein Punkt mit genau drei Ziffern
 * dahinter (oder mehrere Punkte) gilt als Tausendertrennzeichen, sonst als
 * Dezimaltrennzeichen. Damit funktionieren sowohl "1.000" als auch "4.5".
 */
export function parseDeutscheZahl(eingabe: string): number | null {
  const roh = eingabe.replace(/[\s €%]/g, '');
  if (roh === '') return null;

  let normalisiert: string;
  if (roh.includes(',')) {
    normalisiert = roh.replace(/\./g, '').replace(',', '.');
  } else if (roh.includes('.')) {
    const teile = roh.split('.');
    const letzter = teile[teile.length - 1] ?? '';
    const istTausender = teile.length > 2 || (letzter.length === 3 && (teile[0] ?? '').length > 0);
    normalisiert = istTausender ? teile.join('') : roh;
  } else {
    normalisiert = roh;
  }

  if (!/^-?\d*(\.\d+)?$/.test(normalisiert) || !/\d/.test(normalisiert)) return null;

  const wert = Number(normalisiert);
  return Number.isFinite(wert) ? wert : null;
}
