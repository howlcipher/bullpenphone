/** Folds text to a comparable form: lowercase, no diacritics, no punctuation. */
export function normalizeText(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[‘’ʼ]/g, "'")
    .toLowerCase()
    .replace(/\ba's\b/g, 'athletics')
    .replace(/\b([a-z])\.\s*([a-z])\.\s*/g, '$1$2 ')
    .replace(/'s\b/g, '')
    .replace(/'/g, '')
    .replace(/[^a-z0-9$.]+/g, ' ')
    .replace(/(?<![0-9])\.|\.(?![0-9])/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SUFFIX = /\s(jr|sr|ii|iii|iv)$/;

export function nameKey(name: string): string {
  return normalizeText(name).replace(SUFFIX, '');
}

export function slug(input: string): string {
  return normalizeText(input).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
