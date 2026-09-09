const SUFFIX_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function slugify(name: string): string {
  const lowered = name.toLowerCase().trim();
  const replaced = lowered.replace(/\s+/g, '-');
  const cleaned = replaced.replace(/[^a-z0-9가-힣-]/g, '');
  const collapsed = cleaned.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return collapsed.length > 0 ? collapsed : 'form';
}

export function randomSuffix(n = 4): string {
  let out = '';
  for (let i = 0; i < n; i++) {
    out += SUFFIX_ALPHABET[Math.floor(Math.random() * SUFFIX_ALPHABET.length)];
  }
  return out;
}
