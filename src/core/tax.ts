/**
 * Besteuerung von Fondsausschuettungen (Deutschland, Rechtsstand 2026 in der
 * im Rechner verwendeten Modellierung).
 *
 * Reihenfolge der Rechenschritte (entscheidend fuer das Ergebnis):
 *   1. Bruttoausschuettung
 *   2. abzueglich Teilfreistellung (§ 20 InvStG)  -> steuerpflichtiger Anteil
 *   3. abzueglich Freistellungsauftrag / Sparer-Pauschbetrag (§ 20 Abs. 9 EStG)
 *   4. mal Steuersatz                              -> Steuer
 */

import type { FondsTyp, SteuerEinstellungen, Vermoegensart } from './types.js';

/** Abgeltungsteuersatz auf Kapitalertraege im Privatvermoegen. */
export const ABGELTUNGSTEUERSATZ = 0.25;

/** Solidaritaetszuschlag auf die festgesetzte Steuer. */
export const SOLIDARITAETSZUSCHLAG = 0.055;

/** Sparer-Pauschbetrag seit 2023. */
export const SPARER_PAUSCHBETRAG_EINZEL = 1000;
export const SPARER_PAUSCHBETRAG_ZUSAMMEN = 2000;

/** Zulaessige Kirchensteuersaetze (Bayern/Baden-Wuerttemberg 8 %, sonst 9 %). */
export const KIRCHENSTEUERSAETZE = [0, 0.08, 0.09] as const;

/**
 * Teilfreistellungssaetze nach § 20 InvStG.
 *
 * Der Anteil der Ausschuettung, der steuerfrei bleibt. Er haengt vom Fondstyp
 * (Kapitalbeteiligungsquote laut Anlagebedingungen) und von der Vermoegensart
 * ab. Im Betriebsvermoegen einer natuerlichen Person gelten hoehere Saetze,
 * weil dort der persoenliche Steuersatz statt der Abgeltungsteuer greift.
 */
export const TEILFREISTELLUNG: Readonly<Record<FondsTyp, Readonly<Record<Vermoegensart, number>>>> = {
  aktienfonds: { privat: 0.3, betrieb: 0.6 },
  mischfonds: { privat: 0.15, betrieb: 0.3 },
  immobilienfonds: { privat: 0.6, betrieb: 0.6 },
  immobilienfonds_ausland: { privat: 0.8, betrieb: 0.8 },
  sonstige: { privat: 0, betrieb: 0 },
};

export const FONDSTYP_LABEL: Readonly<Record<FondsTyp, string>> = {
  aktienfonds: 'Aktienfonds (Kapitalbeteiligungsquote ≥ 51 %)',
  mischfonds: 'Mischfonds (Kapitalbeteiligungsquote ≥ 25 %)',
  immobilienfonds: 'Immobilienfonds (Schwerpunkt Inland)',
  immobilienfonds_ausland: 'Immobilienfonds (Schwerpunkt Ausland)',
  sonstige: 'Sonstiger Fonds (z. B. Rentenfonds, keine Teilfreistellung)',
};

/** Teilfreistellungssatz fuer eine Kombination aus Fondstyp und Vermoegensart. */
export function teilfreistellungssatz(typ: FondsTyp, art: Vermoegensart): number {
  return TEILFREISTELLUNG[typ][art];
}

/**
 * Effektiver Steuersatz auf den steuerpflichtigen Teil der Ausschuettung.
 *
 * Privatvermoegen: Die Kirchensteuer mindert die Bemessungsgrundlage der
 * Kapitalertragsteuer (§ 32d Abs. 1 EStG). Statt 25 % gilt dann
 *
 *        KapESt = e / (4 + k)
 *
 * mit k = Kirchensteuersatz. Auf diese Kapitalertragsteuer kommen
 * Solidaritaetszuschlag (5,5 %) und Kirchensteuer (k) obendrauf:
 *
 *        s = 1 / (4 + k) * (1 + soli + k)
 *
 *   k = 0    ->  26,3750 %
 *   k = 0,08 ->  27,8186 %
 *   k = 0,09 ->  27,9951 %
 *
 * Betriebsvermoegen: persoenlicher Einkommensteuersatz zuzueglich Soli und
 * Kirchensteuer. Der Sonderausgabenabzug der Kirchensteuer wird - wie in
 * ueberschlaegigen Rechnern ueblich - vernachlaessigt.
 */
export function effektiverSteuersatz(einstellungen: SteuerEinstellungen): number {
  const k = einstellungen.kirchensteuersatz;
  const soli = einstellungen.soli ? SOLIDARITAETSZUSCHLAG : 0;

  if (einstellungen.vermoegensart === 'privat') {
    const kapitalertragsteuer = 1 / (1 / ABGELTUNGSTEUERSATZ + k);
    return kapitalertragsteuer * (1 + soli + k);
  }

  return einstellungen.persoenlicherSteuersatz * (1 + soli + k);
}

/**
 * Im Betriebsvermoegen gibt es keinen Sparer-Pauschbetrag; ausserdem darf der
 * Freistellungsauftrag nie negativ sein.
 */
export function nutzbarerFreistellungsauftrag(einstellungen: SteuerEinstellungen): number {
  if (einstellungen.vermoegensart === 'betrieb') return 0;
  return Math.max(0, einstellungen.freistellungsauftrag);
}

export interface Steueraufteilung {
  readonly brutto: number;
  readonly teilfreistellungssatz: number;
  readonly teilfreistellungsbetrag: number;
  readonly steuerpflichtigVorFreistellung: number;
  readonly freistellungsauftragGenutzt: number;
  readonly bemessungsgrundlage: number;
  readonly steuersatz: number;
  readonly steuer: number;
  readonly netto: number;
}

/**
 * Vorwaertsrechnung: Von der Bruttoausschuettung zur Nettoausschuettung.
 *
 *   steuerpflichtig = brutto * (1 - tf)
 *   bemessung       = max(0, steuerpflichtig - fsa)
 *   steuer          = bemessung * s
 *   netto           = brutto - steuer
 */
export function besteuereAusschuettung(
  brutto: number,
  typ: FondsTyp,
  einstellungen: SteuerEinstellungen,
): Steueraufteilung {
  const tf = teilfreistellungssatz(typ, einstellungen.vermoegensart);
  const s = effektiverSteuersatz(einstellungen);
  const fsa = nutzbarerFreistellungsauftrag(einstellungen);

  const teilfreistellungsbetrag = brutto * tf;
  const steuerpflichtigVorFreistellung = brutto - teilfreistellungsbetrag;
  const freistellungsauftragGenutzt = Math.min(fsa, steuerpflichtigVorFreistellung);
  const bemessungsgrundlage = steuerpflichtigVorFreistellung - freistellungsauftragGenutzt;
  const steuer = bemessungsgrundlage * s;

  return {
    brutto,
    teilfreistellungssatz: tf,
    teilfreistellungsbetrag,
    steuerpflichtigVorFreistellung,
    freistellungsauftragGenutzt,
    bemessungsgrundlage,
    steuersatz: s,
    steuer,
    netto: brutto - steuer,
  };
}

/**
 * Rueckwaertsrechnung: Welche Bruttoausschuettung liefert eine gewuenschte
 * Nettoausschuettung?
 *
 * Mit t = Steuersatz, f = Freistellungsauftrag und q = 1 - Teilfreistellung gilt
 *
 *        netto = brutto - max(0, brutto * q - f) * t
 *
 * Das ist stueckweise linear mit dem Knick bei brutto = f / q. Unterhalb des
 * Knicks faellt keine Steuer an (netto = brutto), oberhalb gilt
 *
 *        netto = brutto * (1 - q * t) + f * t
 *   <=>  brutto = (netto - f * t) / (1 - q * t)
 *
 * Die Funktion ist streng monoton steigend, die Umkehrung also eindeutig.
 */
export function bruttoAusNetto(
  netto: number,
  typ: FondsTyp,
  einstellungen: SteuerEinstellungen,
): number {
  if (netto <= 0) return 0;

  const tf = teilfreistellungssatz(typ, einstellungen.vermoegensart);
  const q = 1 - tf;
  const t = effektiverSteuersatz(einstellungen);
  const f = nutzbarerFreistellungsauftrag(einstellungen);

  // Voll steuerfrei: keine Teilfreistellungsluecke oder kein Steuersatz.
  if (q <= 0 || t <= 0) return netto;

  // Unterhalb des Knicks deckt der Freistellungsauftrag alles ab.
  const knickBrutto = f / q;
  if (netto <= knickBrutto) return netto;

  const nenner = 1 - q * t;
  // Nenner <= 0 hiesse: jeder zusaetzliche Euro brutto senkt das Netto.
  // Bei q <= 1 und t < 1 ist das ausgeschlossen, wird aber defensiv geprueft.
  if (nenner <= 0) {
    throw new Error('Unplausible Steuerparameter: Nettoausschuettung nicht erreichbar.');
  }

  return (netto - f * t) / nenner;
}
