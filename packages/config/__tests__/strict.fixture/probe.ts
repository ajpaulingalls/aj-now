// Regression guard for noUncheckedIndexedAccess. Driven by run.sh via tsconfig.json (which extends @aj-now/config/tsconfig.base).
const a: number[] = [1];
const x = a[0];
export const y: string = x.toFixed();
