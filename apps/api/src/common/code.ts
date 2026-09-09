const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function generateCode(len = 8): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += BASE62[Math.floor(Math.random() * BASE62.length)];
  }
  return out;
}
