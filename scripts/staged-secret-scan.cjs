// Commit öncesi gizli anahtar taraması (TB-001). Yalnız kayda girecek (staged) EKLENEN satırlar taranır.
// Tarama kuralları ortak standartlardan gelir (SNN-Standartlar quality/secret-scan.js); burada kopyası
// tutulmaz ki iki yer ayrışmasın. GitHub'da her PR'da aynı tarayıcı ayrıca çalışır (.github/workflows/anahtar-tarama.yml).
// Standart kopyası bu bilgisayarda yoksa commit durdurulmaz, uyarı yazılır (GitHub taraması yine kapıdır).
"use strict";
const { execFileSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const { homedir } = require("node:os");
const path = require("node:path");

const scannerPath =
  process.env.SNN_SECRET_SCAN ??
  path.join(homedir(), ".claude", "standartlar-canli", "quality", "secret-scan.js");

if (!existsSync(scannerPath)) {
  console.warn(
    `⚠ Anahtar tarayıcısı bulunamadı (${scannerPath}); yerel tarama atlandı, GitHub taraması çalışır.`,
  );
  process.exit(0);
}

const { scanDiff, report } = require(scannerPath);
const diff = execFileSync("git", ["diff", "--cached", "-U0", "--no-color", "--no-ext-diff"], {
  encoding: "utf8",
  maxBuffer: 1e9,
});
const findings = scanDiff(diff);
if (findings.length > 0) {
  console.error(report(findings));
  process.exit(1);
}
