const RTL_PRIMARY_SUBTAGS: ReadonlySet<string> = new Set(['ar', 'he', 'fa', 'ur']);

type Direction = 'left' | 'right';

export function isRTL(lang: string): boolean {
  const [primary = ''] = lang.toLowerCase().split('-');
  return RTL_PRIMARY_SUBTAGS.has(primary);
}

export function start(lang: string): Direction {
  return isRTL(lang) ? 'right' : 'left';
}

export function end(lang: string): Direction {
  return isRTL(lang) ? 'left' : 'right';
}
