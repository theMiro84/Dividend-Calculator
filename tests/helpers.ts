import type { SteuerEinstellungen } from '../src/core/types.js';

const basis: SteuerEinstellungen = {
  vermoegensart: 'privat',
  freistellungsauftragModus: 'nach_teilfreistellung',
  freistellungsauftrag: 0,
  kirchensteuersatz: 0,
  soli: true,
  persoenlicherSteuersatz: 0.42,
};

export const privat = (u: Partial<SteuerEinstellungen> = {}): SteuerEinstellungen => ({
  ...basis,
  ...u,
});

export const betrieb = (u: Partial<SteuerEinstellungen> = {}): SteuerEinstellungen => ({
  ...basis,
  vermoegensart: 'betrieb',
  ...u,
});
