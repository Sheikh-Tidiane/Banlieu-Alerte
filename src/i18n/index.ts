import { fr, type Dictionary, type PartialDictionary } from './fr';
import { wo } from './wo';

export const locales = ['fr', 'wo'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'fr';

const dictionaries: Record<Locale, PartialDictionary> = { fr, wo };

/** Chemins « a.b.c » vers les feuilles texte du dictionnaire. */
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TranslationKey = Leaves<Dictionary>;

function lookup(dictionary: PartialDictionary, key: string): string | undefined {
  let node: unknown = dictionary;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Traduit une clé ; retombe sur le français si la langue demandée n'a pas la clé. */
export function translate(key: TranslationKey, locale: Locale = defaultLocale): string {
  return lookup(dictionaries[locale], key) ?? lookup(fr, key) ?? key;
}

/** Fonction de traduction liée à une langue, pour les composants. */
export function getTranslator(locale: Locale = defaultLocale) {
  return (key: TranslationKey) => translate(key, locale);
}

/** Liste toutes les clés d'un dictionnaire (utilisé par les tests de couverture). */
export function listKeys(dictionary: PartialDictionary, prefix = ''): string[] {
  return Object.entries(dictionary).flatMap(([key, value]) =>
    typeof value === 'string'
      ? [`${prefix}${key}`]
      : listKeys(value as PartialDictionary, `${prefix}${key}.`),
  );
}

/** Remplace les {variables} d'un texte traduit. */
export function interpolate(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}
