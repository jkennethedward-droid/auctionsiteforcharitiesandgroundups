export function cleanEnv(value: string | undefined): string {
  const v = (value ?? "").trim();
  // Remove accidental wrapping quotes from copy/paste (common in Vercel env UI).
  const unwrapped =
    (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))
      ? v.slice(1, -1)
      : v;
  // Remove stray leading/trailing quotes.
  return unwrapped.replace(/^["']+|["']+$/g, "").trim();
}

export function mustGetEnv(name: string): string {
  const raw = process.env[name];
  const value = cleanEnv(raw);
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

