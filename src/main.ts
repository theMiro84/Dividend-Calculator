/**
 * Prototyp-Oberflaeche des Ausschuettungsrechners.
 *
 * Die Datei enthaelt ausschliesslich UI-Logik. Gerechnet wird in
 * src/core/calculator.ts - die Oberflaeche liest Werte aus dem Formular,
 * ruft den Rechenkern und stellt Ergebnis plus Rechenweg dar.
 */

import {
  anlagebetragFreistellungsauftragAusgeschoepft,
  ausschuettungsrendite,
  berechneAnlagebetrag,
  berechneEinkommen,
} from './core/calculator.js';
import type { Eingaben } from './core/calculator.js';
import {
  formatAnteile,
  formatEuro,
  formatEuroGenau,
  formatProzent,
  formatZahl,
  parseDeutscheZahl,
} from './core/format.js';
import { FONDSTYP_LABEL, effektiverSteuersatz, teilfreistellungssatz } from './core/tax.js';
import type {
  AufschlagModus,
  Ergebnis,
  Fonds,
  SteuerEinstellungen,
  Vermoegensart,
} from './core/types.js';
import { FONDS, findeFonds } from './data/funds.js';
import { BEISPIELE, eingabenAusBeispiel } from './examples.js';
import type { Beispiel, Richtung } from './examples.js';

/* ------------------------------------------------------------------ Helfer */

function el<T extends HTMLElement>(id: string): T {
  const knoten = document.getElementById(id);
  if (!knoten) throw new Error(`Element #${id} fehlt im Markup.`);
  return knoten as T;
}

const HTML_ENTITAETEN: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escape(text: string): string {
  return text.replace(/[&<>"']/g, (zeichen) => HTML_ENTITAETEN[zeichen] ?? zeichen);
}

const form = el<HTMLFormElement>('rechner-form');
const zielInput = el<HTMLInputElement>('ziel');
const anlageInput = el<HTMLInputElement>('anlagebetrag');
const fsaInput = el<HTMLInputElement>('freistellungsauftrag');
const fsaModusSelect = el<HTMLSelectElement>('fsaModus');
const kirchensteuerSelect = el<HTMLSelectElement>('kirchensteuer');
const steuersatzInput = el<HTMLInputElement>('steuersatz');
const fondsSelect = el<HTMLSelectElement>('fonds');
const aufschlagInput = el<HTMLInputElement>('ausgabeaufschlag');
const modusSelect = el<HTMLSelectElement>('aufschlagModus');
const steuernCheckbox = el<HTMLInputElement>('steuern');
const ergebnisKnoten = el<HTMLElement>('ergebnis');
const rechenwegKnoten = el<HTMLElement>('rechenweg');
const fondsInfo = el<HTMLElement>('fonds-info');
const richtungHinweis = el<HTMLElement>('richtung-hinweis');
const fsaModusHinweis = el<HTMLElement>('fsaModus-hinweis');
const beispieleKnoten = el<HTMLElement>('beispiele');

/* ------------------------------------------------------- Formular auslesen */

function radioWert(name: string): string {
  const gewaehlt = form.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`);
  return gewaehlt?.value ?? '';
}

interface Formularzustand {
  richtung: Richtung;
  vermoegensart: Vermoegensart;
  betrag: number | null;
  fonds: Fonds;
  ausgabeaufschlag: number | null;
  aufschlagModus: AufschlagModus;
  steuernBeruecksichtigen: boolean;
  steuer: SteuerEinstellungen;
}

function leseFormular(): Formularzustand {
  const richtung = radioWert('richtung') === 'einkommen' ? 'einkommen' : 'anlagebetrag';
  const vermoegensart: Vermoegensart = radioWert('vermoegensart') === 'betrieb' ? 'betrieb' : 'privat';
  const prozent = parseDeutscheZahl(steuersatzInput.value);

  return {
    richtung,
    vermoegensart,
    betrag: parseDeutscheZahl(richtung === 'anlagebetrag' ? zielInput.value : anlageInput.value),
    fonds: findeFonds(fondsSelect.value),
    ausgabeaufschlag: (() => {
      const wert = parseDeutscheZahl(aufschlagInput.value);
      return wert === null ? null : wert / 100;
    })(),
    aufschlagModus: modusSelect.value === 'im_anlagebetrag' ? 'im_anlagebetrag' : 'auf_anteilwert',
    steuernBeruecksichtigen: steuernCheckbox.checked,
    steuer: {
      vermoegensart,
      freistellungsauftragModus:
        fsaModusSelect.value === 'vor_teilfreistellung'
          ? 'vor_teilfreistellung'
          : 'nach_teilfreistellung',
      freistellungsauftrag: parseDeutscheZahl(fsaInput.value) ?? 0,
      kirchensteuersatz: Number(kirchensteuerSelect.value) || 0,
      soli: true,
      persoenlicherSteuersatz: prozent === null ? 0.42 : prozent / 100,
    },
  };
}

/* ---------------------------------------------------------- Sichtbarkeiten */

function aktualisiereSichtbarkeit(zustand: Formularzustand): void {
  for (const knoten of form.querySelectorAll<HTMLElement>('[data-richtung]')) {
    knoten.hidden = knoten.dataset['richtung'] !== zustand.richtung;
  }
  for (const knoten of form.querySelectorAll<HTMLElement>('[data-vermoegensart]')) {
    knoten.hidden = knoten.dataset['vermoegensart'] !== zustand.vermoegensart;
  }

  richtungHinweis.textContent =
    zustand.richtung === 'anlagebetrag'
      ? 'Sie geben Ihr Wunsch-Einkommen vor und erhalten den dafür nötigen Anlagebetrag.'
      : 'Sie geben Ihren Anlagebetrag vor und erhalten das daraus mögliche Monatseinkommen.';

  fsaModusHinweis.textContent =
    zustand.steuer.freistellungsauftragModus === 'nach_teilfreistellung'
      ? 'Gesetzliche Reihenfolge: Der Sparer-Pauschbetrag wird vom bereits teilfreigestellten Ertrag abgezogen.'
      : 'Vereinfachung des Original-Rechners: Der Freistellungsauftrag geht vom Bruttoertrag ab, die Teilfreistellung greift erst danach. Das erhöht die Steuer.';

  const fonds = zustand.fonds;
  const frequenzText = { 1: 'jährlich', 2: 'halbjährlich', 4: 'quartalsweise', 12: 'monatlich' }[
    fonds.frequenz
  ];
  fondsInfo.innerHTML =
    `<strong>${formatProzent(ausschuettungsrendite(fonds))} Ausschüttungsrendite p. a.</strong> · ` +
    `${escape(frequenzText)} ${formatEuroGenau(fonds.ausschuettungJeAnteil)} je Anteil · ` +
    `Anteilwert ${formatEuro(fonds.anteilwert)} · ISIN ${escape(fonds.isin)}<br />` +
    `${escape(FONDSTYP_LABEL[fonds.typ])} → Teilfreistellung ` +
    `${formatProzent(teilfreistellungssatz(fonds.typ, zustand.vermoegensart), 0)} im ` +
    `${zustand.vermoegensart === 'privat' ? 'Privatvermögen' : 'Betriebsvermögen'}<br />` +
    `<span class="dezent">${escape(fonds.beschreibung)}</span>`;
}

/* ------------------------------------------------------------- Darstellung */

function zeile(bezeichnung: string, wert: string, klasse = ''): string {
  return `<div class="zeile ${klasse}"><dt>${bezeichnung}</dt><dd>${wert}</dd></div>`;
}

function trenner(titel: string): string {
  return `<div class="zeile zeile--trenner"><dt>${escape(titel)}</dt><dd></dd></div>`;
}

/** Die beiden Abzugszeilen in der Reihenfolge, in der sie tatsaechlich greifen. */
function steuerzeilen(e: Ergebnis): string {
  const teilfreistellung = zeile(
    `Teilfreistellung ${formatProzent(e.teilfreistellungssatz, 0)}`,
    `− ${formatEuro(e.teilfreistellungsbetrag)}`,
  );
  const freistellungsauftrag = zeile(
    'genutzter Freistellungsauftrag',
    `− ${formatEuro(e.freistellungsauftragGenutzt)}`,
  );
  const zwischenstand = zeile('Zwischenstand', formatEuro(e.betragNachErstemAbzug));

  return e.freistellungsauftragModus === 'nach_teilfreistellung'
    ? `${teilfreistellung}${zwischenstand}${freistellungsauftrag}`
    : `${freistellungsauftrag}${zwischenstand}${teilfreistellung}`;
}

function detailtabelle(e: Ergebnis, zustand: Formularzustand): string {
  const artText = zustand.vermoegensart === 'privat' ? 'Privatvermögen' : 'Betriebsvermögen';

  return `<dl class="details">
    ${trenner('Kapitaleinsatz')}
    ${zeile('Anlagebetrag inkl. Ausgabeaufschlag', formatEuro(e.anlagebetragBrutto), 'zeile--stark')}
    ${zeile('davon Ausgabeaufschlag', `− ${formatEuro(e.ausgabeaufschlagBetrag)}`)}
    ${zeile('in Fondsanteilen investiert', formatEuro(e.investiertesKapital))}
    ${zeile('erworbene Anteile', `${formatAnteile(e.anteile)} Stück à ${formatEuro(e.fonds.anteilwert)}`)}

    ${trenner('Ausschüttung vor Steuern')}
    ${zeile('Ausschüttungsrendite p. a.', formatProzent(e.ausschuettungsrendite))}
    ${zeile('Bruttoausschüttung p. a.', formatEuro(e.ausschuettungBruttoJahr))}
    ${zeile('Bruttoausschüttung pro Monat', formatEuro(e.ausschuettungBruttoMonat), 'zeile--stark')}

    ${trenner(`Steuern (${artText})`)}
    ${steuerzeilen(e)}
    ${zeile('Bemessungsgrundlage', formatEuro(e.bemessungsgrundlage))}
    ${zeile('Steuersatz', formatProzent(e.steuersatz, 4))}
    ${zeile('Steuer p. a.', `− ${formatEuro(e.steuerJahr)}`)}

    ${trenner('Ergebnis')}
    ${zeile('Nettoausschüttung p. a.', formatEuro(e.ausschuettungNettoJahr))}
    ${zeile('Nettoausschüttung pro Monat', formatEuro(e.ausschuettungNettoMonat), 'zeile--stark')}
    ${zeile('effektive Steuerquote', formatProzent(e.effektiveSteuerquote))}
    ${zeile('Nettorendite auf den Anlagebetrag', formatProzent(e.nettorenditeAufAnlagebetrag))}
  </dl>`;
}

function ergebniskopf(titel: string, wert: string, zusatz: string): string {
  return `<div class="ergebnis__kopf">
      <p class="ergebnis__titel">${escape(titel)}</p>
      <p class="ergebnis__wert">${wert}</p>
      <p class="ergebnis__zusatz">${zusatz}</p>
    </div>`;
}

/* --------------------------------------------------------------- Rechenweg */

function schritt(titel: string, formel: string, ergebnis: string): string {
  return `<li>
    <p class="schritt__titel">${escape(titel)}</p>
    <p class="schritt__formel">${formel}</p>
    <p class="schritt__ergebnis">${ergebnis}</p>
  </li>`;
}

function rechenwegEinkommen(e: Ergebnis, zustand: Formularzustand): string {
  const a = zustand.ausgabeaufschlag ?? 0;
  const aufschlagFormel =
    zustand.aufschlagModus === 'auf_anteilwert'
      ? `K = A ÷ (1 + a) = ${formatEuro(e.anlagebetragBrutto)} ÷ ${formatZahl(1 + a, 4)}`
      : `K = A × (1 − a) = ${formatEuro(e.anlagebetragBrutto)} × ${formatZahl(1 - a, 4)}`;

  const schritte = [
    schritt('Ausgabeaufschlag herausrechnen', aufschlagFormel, `K = ${formatEuro(e.investiertesKapital)}`),
    schritt(
      'Anteile ermitteln',
      `n = K ÷ Anteilwert = ${formatEuro(e.investiertesKapital)} ÷ ${formatEuro(e.fonds.anteilwert)}`,
      `n = ${formatAnteile(e.anteile)} Anteile`,
    ),
    schritt(
      'Bruttoausschüttung pro Jahr',
      `D = n × Ausschüttung je Anteil × Termine = ${formatAnteile(e.anteile)} × ${formatEuroGenau(
        e.fonds.ausschuettungJeAnteil,
      )} × ${e.fonds.frequenz}`,
      `D = ${formatEuro(e.ausschuettungBruttoJahr)} p. a. = ${formatEuro(
        e.ausschuettungBruttoMonat,
      )} pro Monat`,
    ),
    ...(e.freistellungsauftragModus === 'nach_teilfreistellung'
      ? [
          schritt(
            'Teilfreistellung abziehen',
            `D × (1 − tf) = ${formatEuro(e.ausschuettungBruttoJahr)} × (1 − ${formatProzent(
              e.teilfreistellungssatz,
              0,
            )})`,
            `steuerpflichtig: ${formatEuro(e.betragNachErstemAbzug)}`,
          ),
          schritt(
            'Freistellungsauftrag anrechnen',
            `BMG = max(0; ${formatEuro(e.betragNachErstemAbzug)} − ${formatEuro(
              e.freistellungsauftragGenutzt,
            )})`,
            `BMG = ${formatEuro(e.bemessungsgrundlage)}`,
          ),
        ]
      : [
          schritt(
            'Freistellungsauftrag vom Bruttoertrag abziehen',
            `D − f = ${formatEuro(e.ausschuettungBruttoJahr)} − ${formatEuro(
              e.freistellungsauftragGenutzt,
            )}`,
            `verbleiben: ${formatEuro(e.betragNachErstemAbzug)}`,
          ),
          schritt(
            'Teilfreistellung auf den Rest',
            `BMG = ${formatEuro(e.betragNachErstemAbzug)} × (1 − ${formatProzent(
              e.teilfreistellungssatz,
              0,
            )})`,
            `BMG = ${formatEuro(e.bemessungsgrundlage)}`,
          ),
        ]),
    schritt(
      'Steuer berechnen',
      `St = BMG × s = ${formatEuro(e.bemessungsgrundlage)} × ${formatProzent(e.steuersatz, 4)}`,
      `St = ${formatEuro(e.steuerJahr)} p. a.`,
    ),
    schritt(
      'Nettoausschüttung',
      `N = D − St = ${formatEuro(e.ausschuettungBruttoJahr)} − ${formatEuro(e.steuerJahr)}`,
      `N = ${formatEuro(e.ausschuettungNettoJahr)} p. a. = ${formatEuro(
        e.ausschuettungNettoMonat,
      )} pro Monat`,
    ),
  ];

  return `<h2>Rechenweg</h2><ol class="schritte">${schritte.join('')}</ol>`;
}

function rechenwegAnlagebetrag(e: Ergebnis, zustand: Formularzustand, mitSteuer: boolean): string {
  const a = zustand.ausgabeaufschlag ?? 0;
  const q = 1 - e.teilfreistellungssatz;
  const t = e.steuersatz;
  const fsa = zustand.steuer.vermoegensart === 'privat' ? zustand.steuer.freistellungsauftrag : 0;
  const ziel = mitSteuer ? e.ausschuettungNettoJahr : e.ausschuettungBruttoJahr;

  const aufschlagFormel =
    zustand.aufschlagModus === 'auf_anteilwert'
      ? `A = K × (1 + a) = ${formatEuro(e.investiertesKapital)} × ${formatZahl(1 + a, 4)}`
      : `A = K ÷ (1 − a) = ${formatEuro(e.investiertesKapital)} ÷ ${formatZahl(1 - a, 4)}`;

  const schritte: string[] = [
    schritt(
      'Jahresziel bestimmen',
      `Ziel × 12 = ${formatEuro(ziel / 12)} × 12`,
      `${formatEuro(ziel)} ${mitSteuer ? 'netto' : 'brutto'} pro Jahr`,
    ),
  ];

  if (mitSteuer) {
    schritte.push(
      e.steuerJahr > 0
        ? schritt(
            'Nettoziel auf Brutto hochrechnen',
            e.freistellungsauftragModus === 'nach_teilfreistellung'
              ? `D = (N − f × t) ÷ (1 − q × t) = (${formatEuro(ziel)} − ${formatEuro(
                  fsa,
                )} × ${formatProzent(t, 4)}) ÷ (1 − ${formatZahl(q, 2)} × ${formatProzent(t, 4)})`
              : `D = (N − f × q × t) ÷ (1 − q × t) = (${formatEuro(ziel)} − ${formatEuro(
                  fsa,
                )} × ${formatZahl(q, 2)} × ${formatProzent(t, 4)}) ÷ (1 − ${formatZahl(
                  q,
                  2,
                )} × ${formatProzent(t, 4)})`,
            `D = ${formatEuro(e.ausschuettungBruttoJahr)} brutto p. a.`,
          )
        : schritt(
            'Nettoziel auf Brutto hochrechnen',
            `Der steuerpflichtige Anteil bleibt unter dem Freistellungsauftrag – es fällt keine Steuer an.`,
            `D = N = ${formatEuro(e.ausschuettungBruttoJahr)} brutto p. a.`,
          ),
    );
  } else {
    schritte.push(
      schritt(
        'Steuern bleiben unberücksichtigt',
        'Das Ziel wird direkt als Bruttoausschüttung interpretiert.',
        `D = ${formatEuro(e.ausschuettungBruttoJahr)} brutto p. a.`,
      ),
    );
  }

  schritte.push(
    schritt(
      'Benötigtes Kapital',
      `K = D ÷ r = ${formatEuro(e.ausschuettungBruttoJahr)} ÷ ${formatProzent(
        e.ausschuettungsrendite,
      )}`,
      `K = ${formatEuro(e.investiertesKapital)}`,
    ),
    schritt('Ausgabeaufschlag aufschlagen', aufschlagFormel, `A = ${formatEuro(e.anlagebetragBrutto)}`),
  );

  return `<h2>Rechenweg</h2><ol class="schritte">${schritte.join('')}</ol>`;
}

/* ------------------------------------------------------------ Hauptrender */

function zeigeFehler(nachricht: string): void {
  ergebnisKnoten.innerHTML = `<p class="fehler">${escape(nachricht)}</p>`;
  rechenwegKnoten.innerHTML = '';
}

function render(): void {
  const zustand = leseFormular();
  aktualisiereSichtbarkeit(zustand);

  if (zustand.betrag === null) {
    zeigeFehler('Bitte einen gültigen Betrag eingeben (z. B. 250,00).');
    return;
  }
  if (zustand.ausgabeaufschlag === null) {
    zeigeFehler('Bitte einen gültigen Ausgabeaufschlag eingeben (z. B. 4,00).');
    return;
  }

  const eingaben: Eingaben = {
    fonds: zustand.fonds,
    ausgabeaufschlag: zustand.ausgabeaufschlag,
    aufschlagModus: zustand.aufschlagModus,
    steuer: zustand.steuer,
  };

  try {
    if (zustand.richtung === 'anlagebetrag') {
      const beide = berechneAnlagebetrag(zustand.betrag, eingaben);
      const aktiv = zustand.steuernBeruecksichtigen
        ? beide.mitSteuerbetrachtung
        : beide.ohneSteuerbetrachtung;

      ergebnisKnoten.innerHTML =
        ergebniskopf(
          'Ihr Anlagebetrag',
          formatEuro(aktiv.anlagebetragBrutto),
          `für ${formatEuro(zustand.betrag)} pro Monat ${
            zustand.steuernBeruecksichtigen ? 'nach Steuern' : 'vor Steuern'
          }`,
        ) +
        `<div class="vergleich">
          <div class="vergleich__spalte ${zustand.steuernBeruecksichtigen ? '' : 'ist-aktiv'}">
            <p class="vergleich__label">Steuern unberücksichtigt</p>
            <p class="vergleich__wert">${formatEuro(beide.ohneSteuerbetrachtung.anlagebetragBrutto)}</p>
          </div>
          <div class="vergleich__spalte ${zustand.steuernBeruecksichtigen ? 'ist-aktiv' : ''}">
            <p class="vergleich__label">Steuern berücksichtigt</p>
            <p class="vergleich__wert">${formatEuro(beide.mitSteuerbetrachtung.anlagebetragBrutto)}</p>
          </div>
        </div>` +
        detailtabelle(aktiv, zustand);

      rechenwegKnoten.innerHTML = rechenwegAnlagebetrag(
        aktiv,
        zustand,
        zustand.steuernBeruecksichtigen,
      );
    } else {
      const e = berechneEinkommen(zustand.betrag, eingaben);

      ergebnisKnoten.innerHTML =
        ergebniskopf(
          'Ihr monatliches Extra-Einkommen',
          formatEuro(
            zustand.steuernBeruecksichtigen ? e.ausschuettungNettoMonat : e.ausschuettungBruttoMonat,
          ),
          `aus ${formatEuro(zustand.betrag)} Anlagebetrag ${
            zustand.steuernBeruecksichtigen ? 'nach Steuern' : 'vor Steuern'
          }`,
        ) +
        `<div class="vergleich">
          <div class="vergleich__spalte ${zustand.steuernBeruecksichtigen ? '' : 'ist-aktiv'}">
            <p class="vergleich__label">Steuern unberücksichtigt</p>
            <p class="vergleich__wert">${formatEuro(e.ausschuettungBruttoMonat)}</p>
          </div>
          <div class="vergleich__spalte ${zustand.steuernBeruecksichtigen ? 'ist-aktiv' : ''}">
            <p class="vergleich__label">Steuern berücksichtigt</p>
            <p class="vergleich__wert">${formatEuro(e.ausschuettungNettoMonat)}</p>
          </div>
        </div>` +
        detailtabelle(e, zustand);

      rechenwegKnoten.innerHTML = rechenwegEinkommen(e, zustand);
    }

    ergaenzeFreistellungshinweis(eingaben, zustand);
  } catch (fehler) {
    zeigeFehler(fehler instanceof Error ? fehler.message : 'Unbekannter Fehler.');
  }
}

/** Zeigt an, ab welchem Anlagebetrag der Freistellungsauftrag ausgeschoepft ist. */
function ergaenzeFreistellungshinweis(eingaben: Eingaben, zustand: Formularzustand): void {
  if (zustand.vermoegensart !== 'privat') return;
  if (zustand.steuer.freistellungsauftrag <= 0) return;
  if (effektiverSteuersatz(zustand.steuer) <= 0) return;

  const grenze = anlagebetragFreistellungsauftragAusgeschoepft(eingaben);
  if (!(grenze > 0)) return;

  const hinweis = document.createElement('p');
  hinweis.className = 'hinweis hinweis--panel';
  hinweis.textContent =
    `Bis zu einem Anlagebetrag von ${formatEuro(grenze)} deckt Ihr Freistellungsauftrag ` +
    `die gesamte Ausschüttung dieses Fonds ab – bis dahin ist brutto gleich netto.`;
  ergebnisKnoten.append(hinweis);
}

/* ------------------------------------------------------------- Initialisierung */

function fuelleFondsauswahl(): void {
  fondsSelect.innerHTML = FONDS.map(
    (f) =>
      `<option value="${escape(f.id)}">${escape(f.name)} – ${formatProzent(
        ausschuettungsrendite(f),
      )} p. a.</option>`,
  ).join('');
  fondsSelect.value = 'meridian-multi-asset-50-am';
}

function ladeBeispiel(beispiel: Beispiel): void {
  const eingaben = eingabenAusBeispiel(beispiel);

  for (const radio of form.querySelectorAll<HTMLInputElement>('input[name="richtung"]')) {
    radio.checked = radio.value === beispiel.richtung;
  }
  for (const radio of form.querySelectorAll<HTMLInputElement>('input[name="vermoegensart"]')) {
    radio.checked = radio.value === beispiel.steuer.vermoegensart;
  }

  if (beispiel.richtung === 'anlagebetrag') {
    zielInput.value = formatZahl(beispiel.betrag, 2);
  } else {
    anlageInput.value = formatZahl(beispiel.betrag, 2);
  }

  fsaInput.value = formatZahl(beispiel.steuer.freistellungsauftrag, 2);
  fsaModusSelect.value = beispiel.steuer.freistellungsauftragModus;
  kirchensteuerSelect.value = String(beispiel.steuer.kirchensteuersatz);
  steuersatzInput.value = formatZahl(beispiel.steuer.persoenlicherSteuersatz * 100, 2);
  fondsSelect.value = eingaben.fonds.id;
  aufschlagInput.value = formatZahl(beispiel.ausgabeaufschlag * 100, 2);
  modusSelect.value = beispiel.aufschlagModus;
  steuernCheckbox.checked = beispiel.steuernBeruecksichtigen;

  render();
}

function baueBeispielbuttons(): void {
  for (const beispiel of BEISPIELE) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'beispiel';
    button.innerHTML = `<span class="beispiel__titel">${escape(beispiel.titel)}</span>
      <span class="beispiel__frage">${escape(beispiel.frage)}</span>`;
    button.addEventListener('click', () => ladeBeispiel(beispiel));
    beispieleKnoten.append(button);
  }
}

fuelleFondsauswahl();
baueBeispielbuttons();

form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', (event) => event.preventDefault());

// Beim Wechsel des Fonds den typischen Ausgabeaufschlag vorschlagen.
fondsSelect.addEventListener('change', () => {
  aufschlagInput.value = formatZahl(findeFonds(fondsSelect.value).ausgabeaufschlagStandard * 100, 2);
  render();
});

render();
