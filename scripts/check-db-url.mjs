import fs from "fs";
const t = fs.readFileSync(".env.local", "utf8");
const lines = t.split(/\r?\n/).filter((l) => /^DATABASE_URL=/.test(l));
console.log("count", lines.length);
for (const l of lines) {
  const v = l.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
  console.log("scheme", v.split(":")[0], "len", v.length);
}
