/**
 * Erzeugt aus theorie.html eine Fassung, die sich als Artifact veroeffentlichen
 * laesst: ohne <!doctype>, <html>, <head> und <body>, weil diese Huelle beim
 * Veroeffentlichen ergaenzt wird.
 *
 * theorie.html bleibt die einzige Quelle - so koennen beide Fassungen nicht
 * auseinanderlaufen.
 *
 *   node scripts/artefakt.mjs
 *   -> build/theorie-artefakt.html
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const quelle = resolve(wurzel, 'theorie.html');
const ziel = resolve(wurzel, 'build/theorie-artefakt.html');

const roh = await readFile(quelle, 'utf8');

const zwischen = (start, ende) => {
  const a = roh.indexOf(start);
  const b = roh.indexOf(ende, a);
  if (a < 0 || b < 0) throw new Error(`Abschnitt ${start} … ${ende} nicht gefunden.`);
  return roh.slice(a, b + ende.length);
};

const titel = zwischen('<title>', '</title>');
const stil = zwischen('<style>', '</style>');

const koerperAnfang = roh.indexOf('>', roh.indexOf('<body')) + 1;
const koerper = roh.slice(koerperAnfang, roh.indexOf('</body>'));

// Der Rechner liegt im Repository und ist unter der Artifact-URL nicht
// erreichbar. Links dorthin werden zu einem Hinweis ohne Ziel.
const ohneRechnerLinks = koerper.replace(
  /<a class="link-button" href="\.\/index\.html">[^<]*<\/a>/g,
  '<p class="hinweis-rechner">Der interaktive Rechner gehört zum Repository ' +
    '<code>Dividend-Calculator</code> und läuft dort lokal mit <code>npm run dev</code>.</p>',
);

const zusatzStil = `
    <style>
      .hinweis-rechner {
        margin: 0;
        padding: 0.75rem 1rem;
        border: 1px dashed var(--linie);
        border-radius: 3px;
        background: var(--flaeche);
        color: var(--text-schwach);
        font-size: 0.85rem;
        line-height: 1.55;
      }
    </style>`;

const ausgabe = `${titel}
${stil}${zusatzStil}
${ohneRechnerLinks.trimEnd()}
`;

await mkdir(dirname(ziel), { recursive: true });
await writeFile(ziel, ausgabe, 'utf8');

// Achtung: schlichtes includes('<head') wuerde auch <header ... treffen.
const verboten = [/<!doctype/i, /<html[\s>]/i, /<head[\s>]/i, /<body[\s>]/i];
for (const marke of verboten) {
  if (marke.test(ausgabe)) {
    throw new Error(`Die Artefakt-Fassung enthaelt noch ${marke} – das darf sie nicht.`);
  }
}

console.log(`build/theorie-artefakt.html geschrieben (${(ausgabe.length / 1024).toFixed(1)} kB)`);
