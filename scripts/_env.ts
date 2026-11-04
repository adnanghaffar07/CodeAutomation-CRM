// Tiny .env loader for scripts (tsx does not read .env files). Never overrides variables already set.
import fs from "node:fs";
import path from "node:path";

export function loadEnv(): void {
  for (const f of [".env.local", ".env"]) {
    const p = path.join(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m || process.env[m[1]] !== undefined) continue;
      process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
    }
  }
}

/** Rewrite KEY=value lines in .env and .env.local (values are written quoted). */
export function setEnvVars(vars: Record<string, string>): void {
  for (const f of [".env.local", ".env"]) {
    const p = path.join(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    let s = fs.readFileSync(p, "utf8");
    for (const [k, v] of Object.entries(vars)) {
      const line = `${k}="${v}"`;
      s = new RegExp(`^${k}=.*$`, "m").test(s) ? s.replace(new RegExp(`^${k}=.*$`, "m"), () => line) : `${s.trimEnd()}\n${line}\n`;
    }
    fs.writeFileSync(p, s);
  }
}
