/**
 * Gemeinsame Typen des Ausschuettungsrechners.
 *
 * Grundidee des Modells (siehe theorie.html):
 * Der Rechner ist ein reines EINKOMMENS-Modell. Er verknuepft ausschliesslich
 * das investierte Kapital mit der Ausschuettung des Fonds. Die Kursentwicklung
 * (Wertentwicklung) des Fonds geht NICHT in die Rechnung ein.
 */

/**
 * Fondstyp im Sinne von § 20 InvStG. Der Typ bestimmt allein die
 * Teilfreistellungsquote - er hat keinen Einfluss auf die Ausschuettung selbst.
 */
export type FondsTyp =
  | 'aktienfonds'
  | 'mischfonds'
  | 'immobilienfonds'
  | 'immobilienfonds_ausland'
  | 'sonstige';

/** Privat- oder Betriebsvermoegen. Bestimmt Teilfreistellung und Steuersatz. */
export type Vermoegensart = 'privat' | 'betrieb';

/** Anzahl der Ausschuettungstermine pro Jahr. */
export type Ausschuettungsfrequenz = 1 | 2 | 4 | 12;

/**
 * Konvention, nach der der Ausgabeaufschlag gerechnet wird.
 *
 * - `auf_anteilwert`: Ausgabepreis = Anteilwert x (1 + a). Der Aufschlag wird
 *   auf den Ruecknahmepreis AUFGESCHLAGEN. Das ist die uebliche Definition in
 *   Verkaufsprospekten ("Ausgabeaufschlag von bis zu 5 % des Anteilwerts").
 *   -> Anlagebetrag = Kapital x (1 + a)
 * - `im_anlagebetrag`: Der Aufschlag wird als Prozentsatz DES ANLAGEBETRAGS
 *   verstanden und aus diesem entnommen.
 *   -> Anlagebetrag = Kapital / (1 - a)
 *
 * Der Unterschied betraegt exakt a² / (1 - a²) - bei 4 % also rund 0,16 % des
 * Anlagebetrags. Klein, aber nicht null; der Rechner macht die Wahl explizit.
 */
export type AufschlagModus = 'auf_anteilwert' | 'im_anlagebetrag';

/**
 * Herkunft der Ausschuettung bei Fonds mit fest zugesagter Zielquote.
 *
 * Der Anbieter legt die Ausschuettung "jedes Jahr Anfang Januar fuer die
 * folgenden 12 Monate" auf eine Quote fest; Basis ist der letzte Anteilpreis
 * des Vorjahres. Der so bestimmte Jahresbetrag wird anteilig auf die Termine
 * verteilt und bleibt fuer das Jahr in Euro fix - notfalls ergaenzt durch eine
 * Substanzausschuettung.
 *
 * Damit ist die Ausschuettung je Anteil keine Stammdatengroesse, sondern eine
 * ABGELEITETE: sie folgt aus Quote und Basispreis. Fuer eine Anbindung echter
 * Fondsdaten ist das der entscheidende Punkt - der laufende Anteilpreis
 * aktualisiert sich taeglich, die Ausschuettung je Anteil aber nur einmal im
 * Jahr.
 */
export interface Ausschuettungsziel {
  /** Zugesagte Quote p. a. als Dezimal (z. B. 0.03, 0.04, 0.06). */
  readonly quote: number;
  /** Anteilpreis, auf den die Quote bezogen wurde: Schlusskurs des Vorjahres. */
  readonly basisAnteilpreis: number;
}

/** Stammdaten eines (fiktiven) ausschuettenden Fonds. */
export interface Fonds {
  readonly id: string;
  readonly name: string;
  readonly isin: string;
  readonly typ: FondsTyp;
  /** Anteilwert / Ruecknahmepreis in EUR. */
  readonly anteilwert: number;
  /** Ausschuettung je Anteil und Termin in EUR. */
  readonly ausschuettungJeAnteil: number;
  /** Ausschuettungstermine pro Jahr. */
  readonly frequenz: Ausschuettungsfrequenz;
  /**
   * Nur bei Fonds mit zugesagter Zielquote: woraus `ausschuettungJeAnteil`
   * stammt. Fehlt das Feld, ist die Ausschuettung je Anteil eine reine
   * Stammdatengroesse ohne bekannte Herleitung.
   */
  readonly ausschuettungsziel?: Ausschuettungsziel;
  /** Vom Anbieter uebliche Obergrenze des Ausgabeaufschlags (Dezimal, z. B. 0.04). */
  readonly ausgabeaufschlagStandard: number;
  /** Laufende Kosten p. a. (TER, Dezimal). Nur informativ - siehe Theorie. */
  readonly laufendeKosten: number;
  /** Aktienquote o. ae. - nur zur Erlaeuterung der Teilfreistellung. */
  readonly kapitalbeteiligungsquote: number;
  readonly beschreibung: string;
}

/**
 * Reihenfolge, in der Teilfreistellung und Freistellungsauftrag abgezogen werden.
 *
 * - `nach_teilfreistellung`: erst Teilfreistellung, dann Sparer-Pauschbetrag.
 *   Das entspricht § 20 Abs. 9 EStG i. V. m. § 20 InvStG - die Teilfreistellung
 *   mindert die Kapitalertraege, und erst darauf wird der Pauschbetrag angesetzt.
 * - `vor_teilfreistellung`: erst Freistellungsauftrag vom Bruttoertrag, dann
 *   Teilfreistellung auf den Rest. Vereinfachung, die der Allianz-Rechner
 *   verwendet (nachgewiesen in tests/allianz-referenz.test.ts). Sie fuehrt zu
 *   einer hoeheren Steuer und damit zu einem hoeheren noetigen Anlagebetrag.
 */
export type FreistellungsauftragModus = 'nach_teilfreistellung' | 'vor_teilfreistellung';

/** Steuerliche Rahmenbedingungen des Anlegers. */
export interface SteuerEinstellungen {
  readonly vermoegensart: Vermoegensart;
  /** Reihenfolge der beiden Freistellungen. Siehe `FreistellungsauftragModus`. */
  readonly freistellungsauftragModus: FreistellungsauftragModus;
  /**
   * Nur `privat`: noch freier Betrag des Freistellungsauftrags in EUR
   * (Sparer-Pauschbetrag 1.000 EUR / 2.000 EUR bei Zusammenveranlagung).
   */
  readonly freistellungsauftrag: number;
  /** Kirchensteuersatz als Dezimal: 0, 0.08 oder 0.09. */
  readonly kirchensteuersatz: number;
  /** Solidaritaetszuschlag beruecksichtigen (auf Kapitalertraege weiterhin voll). */
  readonly soli: boolean;
  /**
   * Nur `betrieb`: persoenlicher Einkommensteuersatz als Dezimal (z. B. 0.42).
   * Im Privatvermoegen wird immer die Abgeltungsteuer von 25 % angesetzt.
   */
  readonly persoenlicherSteuersatz: number;
}

/** Vollstaendige Aufschluesselung einer Berechnung. */
export interface Ergebnis {
  readonly fonds: Fonds;
  /** Ausschuettungsrendite p. a. auf den Anteilwert (Dezimal). */
  readonly ausschuettungsrendite: number;

  /** Betrag, den der Anleger inklusive Ausgabeaufschlag aufbringt. */
  readonly anlagebetragBrutto: number;
  /** Im Ausgabeaufschlag steckender Eurobetrag. */
  readonly ausgabeaufschlagBetrag: number;
  /** Tatsaechlich in Fondsanteilen investiertes Kapital. */
  readonly investiertesKapital: number;
  /** Erworbene (rechnerisch teilbare) Anteile. */
  readonly anteile: number;

  readonly ausschuettungBruttoJahr: number;
  readonly ausschuettungBruttoMonat: number;

  readonly teilfreistellungssatz: number;
  readonly teilfreistellungsbetrag: number;
  /** Zwischenstand nach dem ersten der beiden Abzuege (je nach Reihenfolge). */
  readonly betragNachErstemAbzug: number;
  readonly freistellungsauftragGenutzt: number;
  readonly freistellungsauftragModus: FreistellungsauftragModus;
  readonly bemessungsgrundlage: number;
  readonly steuersatz: number;
  readonly steuerJahr: number;

  readonly ausschuettungNettoJahr: number;
  readonly ausschuettungNettoMonat: number;

  /** Steuer / Bruttoausschuettung. */
  readonly effektiveSteuerquote: number;
  /** Nettoausschuettung p. a. / Bruttoanlagebetrag. */
  readonly nettorenditeAufAnlagebetrag: number;
  /** Bruttoausschuettung p. a. / Bruttoanlagebetrag. */
  readonly bruttorenditeAufAnlagebetrag: number;
}

/** Ergebnis der Richtung "welchen Betrag muss ich anlegen?". */
export interface AnlagebetragErgebnis {
  /** Zielbetrag pro Monat, wie ihn der Nutzer eingegeben hat. */
  readonly zielMonat: number;
  /** Variante: Ziel als Bruttoausschuettung verstanden (Steuern unberuecksichtigt). */
  readonly ohneSteuerbetrachtung: Ergebnis;
  /** Variante: Ziel als Nettoausschuettung verstanden (Steuern beruecksichtigt). */
  readonly mitSteuerbetrachtung: Ergebnis;
}
