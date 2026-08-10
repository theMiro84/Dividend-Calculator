/**
 * Kern des Ausschuettungsrechners.
 *
 * Das Modell in einer Zeile:
 *
 *        Ausschuettung p. a. = investiertes Kapital x Ausschuettungsrendite
 *
 * Die Kursentwicklung des Fonds taucht darin nicht auf. Sie wirkt nur indirekt,
 * weil eine kuenftige Ausschuettung je Anteil und ein kuenftiger Anteilwert
 * beide unbekannt sind - der Rechner friert beide auf dem heutigen Stand ein.
 */

import {
  besteuereAusschuettung,
  bruttoAusNetto,
  effektiverSteuersatz,
  knickBrutto,
  nutzbarerFreistellungsauftrag,
} from './tax.js';
import type {
  AnlagebetragErgebnis,
  AufschlagModus,
  Ergebnis,
  Fonds,
  SteuerEinstellungen,
} from './types.js';

/**
 * Ausschuettungsrendite p. a. auf den Anteilwert.
 *
 *        r = (Ausschuettung je Anteil x Termine pro Jahr) / Anteilwert
 *
 * Genau hier - und nur hier - steckt die "3, 4 oder 5 %" der Fondsauswahl.
 */
export function ausschuettungsrendite(fonds: Fonds): number {
  return (fonds.ausschuettungJeAnteil * fonds.frequenz) / fonds.anteilwert;
}

/** Bruttoanlagebetrag (inkl. Ausgabeaufschlag) aus dem investierten Kapital. */
export function anlagebetragAusKapital(
  kapital: number,
  ausgabeaufschlag: number,
  modus: AufschlagModus,
): number {
  return modus === 'auf_anteilwert'
    ? kapital * (1 + ausgabeaufschlag)
    : kapital / (1 - ausgabeaufschlag);
}

/** Investiertes Kapital aus dem Bruttoanlagebetrag (Umkehrung). */
export function kapitalAusAnlagebetrag(
  anlagebetrag: number,
  ausgabeaufschlag: number,
  modus: AufschlagModus,
): number {
  return modus === 'auf_anteilwert'
    ? anlagebetrag / (1 + ausgabeaufschlag)
    : anlagebetrag * (1 - ausgabeaufschlag);
}

export interface Eingaben {
  readonly fonds: Fonds;
  readonly ausgabeaufschlag: number;
  readonly aufschlagModus: AufschlagModus;
  readonly steuer: SteuerEinstellungen;
}

function pruefeEingaben(eingaben: Eingaben): void {
  const { fonds, ausgabeaufschlag, steuer } = eingaben;

  if (!(fonds.anteilwert > 0)) {
    throw new Error('Der Anteilwert des Fonds muss groesser als 0 sein.');
  }
  if (!(fonds.ausschuettungJeAnteil > 0)) {
    throw new Error('Die Ausschuettung je Anteil muss groesser als 0 sein.');
  }
  if (!Number.isFinite(ausgabeaufschlag) || ausgabeaufschlag < 0 || ausgabeaufschlag >= 1) {
    throw new Error('Der Ausgabeaufschlag muss zwischen 0 % und unter 100 % liegen.');
  }
  if (steuer.vermoegensart === 'privat' && steuer.freistellungsauftrag < 0) {
    throw new Error('Der Freistellungsauftrag darf nicht negativ sein.');
  }
  if (
    steuer.vermoegensart === 'betrieb' &&
    (steuer.persoenlicherSteuersatz < 0 || steuer.persoenlicherSteuersatz >= 1)
  ) {
    throw new Error('Der persoenliche Steuersatz muss zwischen 0 % und unter 100 % liegen.');
  }
  if (steuer.kirchensteuersatz < 0 || steuer.kirchensteuersatz >= 1) {
    throw new Error('Der Kirchensteuersatz muss zwischen 0 % und unter 100 % liegen.');
  }
}

/**
 * Richtung 1: Anlagebetrag -> moegliches monatliches Extra-Einkommen.
 *
 *   1. Kapital        = Anlagebetrag ohne Ausgabeaufschlag
 *   2. Anteile        = Kapital / Anteilwert
 *   3. Bruttoertrag   = Anteile x Ausschuettung je Anteil x Termine
 *   4. Steuer         = max(0, Brutto x (1 - tf) - FSA) x s
 */
export function berechneEinkommen(anlagebetragBrutto: number, eingaben: Eingaben): Ergebnis {
  pruefeEingaben(eingaben);
  if (!Number.isFinite(anlagebetragBrutto) || anlagebetragBrutto < 0) {
    throw new Error('Der Anlagebetrag muss eine Zahl groesser oder gleich 0 sein.');
  }

  const { fonds, ausgabeaufschlag, aufschlagModus, steuer } = eingaben;

  const investiertesKapital = kapitalAusAnlagebetrag(
    anlagebetragBrutto,
    ausgabeaufschlag,
    aufschlagModus,
  );
  const ausgabeaufschlagBetrag = anlagebetragBrutto - investiertesKapital;
  const anteile = investiertesKapital / fonds.anteilwert;

  const ausschuettungBruttoJahr = anteile * fonds.ausschuettungJeAnteil * fonds.frequenz;
  const steuern = besteuereAusschuettung(ausschuettungBruttoJahr, fonds.typ, steuer);

  return {
    fonds,
    ausschuettungsrendite: ausschuettungsrendite(fonds),
    anlagebetragBrutto,
    ausgabeaufschlagBetrag,
    investiertesKapital,
    anteile,
    ausschuettungBruttoJahr,
    ausschuettungBruttoMonat: ausschuettungBruttoJahr / 12,
    teilfreistellungssatz: steuern.teilfreistellungssatz,
    teilfreistellungsbetrag: steuern.teilfreistellungsbetrag,
    betragNachErstemAbzug: steuern.betragNachErstemAbzug,
    freistellungsauftragGenutzt: steuern.freistellungsauftragGenutzt,
    freistellungsauftragModus: steuern.freistellungsauftragModus,
    bemessungsgrundlage: steuern.bemessungsgrundlage,
    steuersatz: steuern.steuersatz,
    steuerJahr: steuern.steuer,
    ausschuettungNettoJahr: steuern.netto,
    ausschuettungNettoMonat: steuern.netto / 12,
    effektiveSteuerquote:
      ausschuettungBruttoJahr > 0 ? steuern.steuer / ausschuettungBruttoJahr : 0,
    nettorenditeAufAnlagebetrag: anlagebetragBrutto > 0 ? steuern.netto / anlagebetragBrutto : 0,
    bruttorenditeAufAnlagebetrag:
      anlagebetragBrutto > 0 ? ausschuettungBruttoJahr / anlagebetragBrutto : 0,
  };
}

/**
 * Richtung 2: Gewuenschtes monatliches Extra-Einkommen -> noetiger Anlagebetrag.
 *
 * Rueckwaerts durch dieselbe Kette:
 *
 *   Ziel (netto/Monat)
 *     -> Ziel p. a.
 *     -> Bruttoausschuettung p. a.        (Umkehrung der Steuerformel)
 *     -> Kapital = Brutto / Rendite
 *     -> Anlagebetrag = Kapital + Ausgabeaufschlag
 *
 * Es werden beide Lesarten geliefert - wie im Original-Rechner, der den
 * Anlagebetrag "Steuern unberuecksichtigt / beruecksichtigt" ausweist.
 */
export function berechneAnlagebetrag(
  zielMonat: number,
  eingaben: Eingaben,
): AnlagebetragErgebnis {
  pruefeEingaben(eingaben);
  if (!Number.isFinite(zielMonat) || zielMonat < 0) {
    throw new Error('Das gewuenschte Extra-Einkommen muss eine Zahl groesser oder gleich 0 sein.');
  }

  const { fonds, ausgabeaufschlag, aufschlagModus, steuer } = eingaben;
  const rendite = ausschuettungsrendite(fonds);
  const zielJahr = zielMonat * 12;

  const anlagebetragFuerBrutto = (bruttoJahr: number): number =>
    anlagebetragAusKapital(bruttoJahr / rendite, ausgabeaufschlag, aufschlagModus);

  // Variante A: Ziel = Bruttoausschuettung (Steuern unberuecksichtigt).
  const ohneSteuerbetrachtung = berechneEinkommen(anlagebetragFuerBrutto(zielJahr), eingaben);

  // Variante B: Ziel = Nettoausschuettung (Steuern beruecksichtigt).
  const bruttoNoetig = bruttoAusNetto(zielJahr, fonds.typ, steuer);
  const mitSteuerbetrachtung = berechneEinkommen(anlagebetragFuerBrutto(bruttoNoetig), eingaben);

  return { zielMonat, ohneSteuerbetrachtung, mitSteuerbetrachtung };
}

/**
 * Kapitalbetrag, ab dem der Freistellungsauftrag vollstaendig ausgeschoepft ist.
 * Nuetzlich fuer die Erklaerung des Knicks in der Netto-Kurve.
 */
export function anlagebetragFreistellungsauftragAusgeschoepft(eingaben: Eingaben): number {
  const { fonds, ausgabeaufschlag, aufschlagModus, steuer } = eingaben;
  if (nutzbarerFreistellungsauftrag(steuer) <= 0 || effektiverSteuersatz(steuer) <= 0) return 0;

  const bruttoAmKnick = knickBrutto(fonds.typ, steuer);
  if (!Number.isFinite(bruttoAmKnick)) return 0;

  return anlagebetragAusKapital(
    bruttoAmKnick / ausschuettungsrendite(fonds),
    ausgabeaufschlag,
    aufschlagModus,
  );
}
