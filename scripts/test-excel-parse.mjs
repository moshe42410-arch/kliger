import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Use compiled-like approach: dynamically import after transpile isn't available.
// Inline a quick call via next isn't needed — use xlsx + replicate parser by requiring ts via jiti if available.
// Simpler: spawn through tsx if present, else duplicate minimal check.

const XLSX = require("xlsx");
const buf = fs.readFileSync("./סיכום שיחה ברגר יעקב מנחם.xlsx");

function cellStr(v) {
  if (v == null) return "";
  return String(v).trim();
}
function cellNum(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).replace(/[₪,\s]/g, "").replace(/[^\d.-]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const wb = XLSX.read(buf, { type: "buffer" });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
  header: 1,
  defval: "",
  raw: true,
});

let incomeHeader = -1;
let liabilityHeader = -1;
for (let i = 0; i < rows.length; i++) {
  const j = rows[i].map(cellStr).join("|");
  if (incomeHeader < 0 && j.includes("סכום") && j.includes("הערות")) incomeHeader = i;
  if (liabilityHeader < 0 && j.includes("החזר") && j.includes("היכן")) liabilityHeader = i;
}
console.log({ incomeHeader, liabilityHeader });

const incomes = [];
for (let r = incomeHeader + 1; r < (liabilityHeader > 0 ? liabilityHeader : rows.length); r++) {
  const row = rows[r];
  const amount = cellNum(row[5]);
  const notes = cellStr(row[6]);
  const status = cellStr(row[3]);
  const joined = row.map(cellStr).join(" ");
  if (joined.includes("סה") && joined.includes("הכנסות")) {
    console.log("total income", amount);
    continue;
  }
  if (!amount) continue;
  if (!status && !notes) continue;
  incomes.push({ status, person: cellStr(row[4]), amount, notes });
}
console.log("incomes", incomes.length, incomes.slice(0, 5));

const liabilities = [];
for (let r = liabilityHeader + 1; r < rows.length; r++) {
  const row = rows[r];
  const kind = cellStr(row[3]);
  const monthly = cellNum(row[5]);
  const joined = row.map(cellStr).join(" ");
  if (joined.includes("סה") && joined.includes("התחייב")) {
    console.log("total liab", monthly);
    break;
  }
  if (!kind || monthly == null) continue;
  liabilities.push({ kind, where: cellStr(row[4]), monthly, balance: cellNum(row[6]) });
}
console.log("liabilities", liabilities.length, liabilities);
