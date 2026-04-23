/**
 * Branding-Patch für die E-Mail-Primärfarbe (Link- und Button-Farbe).
 *
 * WOZU:
 *   In Ocelot v3.15.1 ist der Dockerfile-COPY für Email-Branding defekt:
 *   `ONBUILD COPY ./branding/email/ src/middleware/helpers/email/` zeigt auf
 *   einen toten Pfad, der nach der Pug-Umstellung (PR #8435) nicht mehr
 *   gelesen wird. Die neuen Pug-Templates liegen in `src/emails/templates/`
 *   und haben die Farbe `#17b53e` in `includes/webflow.css` hardcoded.
 *   Dieses Branding-Middleware-File wird dagegen vom Dockerfile korrekt
 *   nach `src/middleware/branding/` kopiert und beim Server-Start aufgerufen
 *   (siehe `src/middleware/index.ts`). Es patched die CSS-Datei zur Laufzeit.
 *
 * WO KOPIEREN:
 *   Diese Datei gehört in dein Branding-Repo unter:
 *     branding/middlewares/brandingMiddlewares.ts
 *
 * NACH DEM UPDATE ENTFERNEN:
 *   Sobald dein Backend auf einer Version läuft, die PR #9515 enthält
 *   ("fix(backend): allow to brand emails in backend"), ist dieser Hack
 *   überflüssig. Dann:
 *     1. Diese Datei aus deinem Branding löschen (bzw. wieder durch die
 *        Default-Variante mit nur `addMiddleware`-Kommentaren ersetzen).
 *     2. Stattdessen die Pug-Templates komplett überschreiben via
 *        `branding/emails/templates/includes/webflow.css` (ggf. nur die
 *        geänderten Zeilen). Ab PR #9515 kopiert das Dockerfile diesen
 *        Pfad korrekt nach `src/emails/templates/`.
 *
 * HOW IT WORKS:
 *   - Läuft einmalig beim Server-Start (aufgerufen aus `middleware/index.ts`).
 *   - Liest `build/src/emails/templates/includes/webflow.css`, ersetzt die
 *     Default-Farbe `#17b53e` durch `BRAND_PRIMARY` und schreibt zurück.
 *   - Idempotent: wenn die Default-Farbe nicht mehr drin steht, passiert nichts.
 *   - `email-templates` liest Templates bei jedem `send()` frisch vom FS,
 *     daher greift der Patch ohne Neustart der Rendering-Pipeline.
 *   - Synchrones I/O ist Absicht: der Patch muss fertig sein, bevor der
 *     Server den ersten Request handled (middleware/index.ts ruft uns
 *     synchron während createServer auf).
 */

/* eslint-disable no-console */
import fs from 'node:fs'
import path from 'node:path'

// Deine Brand-Primärfarbe hier eintragen (hex oder rgb/rgba).
// Sollte mit `THEME_COLOR` aus branding/constants/metadata.js übereinstimmen.
const BRAND_PRIMARY = '#004E80'

const DEFAULT_COLOR = '#17b53e'

function patchEmailCss(): void {
  // __dirname zur Laufzeit: /app/build/src/middleware/branding/
  // Zielpfad:               /app/build/src/emails/templates/includes/webflow.css
  const cssPath = path.resolve(__dirname, '../../emails/templates/includes/webflow.css')

  let css: string
  try {
    // eslint-disable-next-line n/no-sync -- siehe Datei-Kommentar
    css = fs.readFileSync(cssPath, 'utf8')
    // eslint-disable-next-line no-catch-all/no-catch-all -- Patch darf Server-Start nicht kippen
  } catch (err) {
    console.warn('[branding] cannot read email css, skipping patch:', err)
    return
  }

  if (!css.includes(DEFAULT_COLOR)) {
    // schon gepatched oder Template hat sich geändert – nichts tun
    return
  }

  const patched = css.replace(new RegExp(DEFAULT_COLOR, 'g'), BRAND_PRIMARY)

  try {
    // eslint-disable-next-line n/no-sync -- siehe Datei-Kommentar
    fs.writeFileSync(cssPath, patched)
    console.log(`[branding] email primary color patched: ${DEFAULT_COLOR} -> ${BRAND_PRIMARY}`)
    // eslint-disable-next-line no-catch-all/no-catch-all -- Patch darf Server-Start nicht kippen
  } catch (err) {
    console.warn('[branding] cannot write email css, skipping patch:', err)
  }
}

export default () => {
  patchEmailCss()
  // Platz für weitere Branding-GraphQL-Middlewares, z. B.:
  // addMiddleware({ name: 'myMW', middleware: myMW, position: { } })
}
