// Messages d'erreur journalisés sans donnée personnelle (EXG-37, CDC §11).

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const PHONE = /\+?\d[\d\s.-]{7,}\d/g;
const TOKEN = /\b[A-Za-z0-9_-]{32,}\b/g;
const COORDINATE = /-?\d{1,3}\.\d{4,}/g;

export function sanitizeErrorMessage(message: string, max = 300): string {
  return message
    .replace(EMAIL, '[e-mail]')
    .replace(TOKEN, '[jeton]')
    .replace(COORDINATE, '[position]')
    .replace(PHONE, '[numéro]')
    .slice(0, max);
}
