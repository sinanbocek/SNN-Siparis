import js from "@eslint/js";
import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";
import reactHooks from "eslint-plugin-react-hooks";
import eslintConfigPrettier from "eslint-config-prettier";
import abacus from "@snn/abacus-core/eslint";

/**
 * Zorlama haritası — ARCHITECTURE.md §3, ADR-0001 ve ADR-0002.
 * Tüm kurallar `error`. Build kırılırsa kural gevşetilmez, kod düzeltilir.
 */

/** Biçim ve hesap yalnız ABACUS ile (ADR-0001). */
const FORMAT_BANS = [
  { object: "Intl", property: "NumberFormat", message: "Biçim yalnız ABACUS (money)." },
  { object: "Intl", property: "DateTimeFormat", message: "Biçim yalnız ABACUS (date)." },
  { property: "toLocaleString", message: "Biçim yalnız ABACUS." },
  { property: "toLocaleDateString", message: "Biçim yalnız ABACUS (date)." },
  { property: "toLocaleTimeString", message: "Biçim yalnız ABACUS (date)." },
  { property: "toFixed", message: "Yuvarlama/biçim yalnız ABACUS." },
];

/** Tarayıcının onay/uyarı kutuları yasak: ortak onay penceresi ve bildirim (useFeedback). */
const DIALOG_BANS = ["confirm", "alert", "prompt"].map((property) => ({
  object: "window",
  property,
  message: "Tarayıcı kutusu yasak; presentation/parts/feedback.tsx useFeedback() kullanın.",
}));

const LOCAL_SYNTAX_BANS = [
  {
    selector: "MemberExpression[object.name='Math']",
    message: "Ham Math.* yasak; hesap yalnız ABACUS math ile (ADR-0001).",
  },
  {
    selector: "CallExpression[callee.name='parseFloat']",
    message: "Sayı ayrıştırma yalnız ABACUS (money.parseNumber).",
  },
];

/**
 * Katmanlar. Sıra önemli: ilk eşleşen tip kazanır.
 * Maliyet (costs) yalnız yönetim tarafına açıktır; satış ekranları onu hiç göremez (G2, ADR-0002).
 */
const ELEMENTS = [
  { type: "abacus", pattern: "src/domain/abacus/**" },
  { type: "costs", pattern: "src/domain/costs/**" },
  { type: "domain", pattern: "src/domain/**" },
  { type: "admin-app", pattern: "src/application/admin/**" },
  { type: "application", pattern: "src/application/**" },
  { type: "infrastructure", pattern: "src/infrastructure/**" },
  { type: "sales-ui", pattern: "src/presentation/sales/**" },
  { type: "admin-ui", pattern: "src/presentation/admin/**" },
  { type: "ui-parts", pattern: "src/presentation/parts/**" },
  { type: "shell", pattern: "src/presentation/app/**" },
  { type: "composition", pattern: "src/composition/**" },
  { type: "types", pattern: "src/types/**" },
].map((element) => ({ ...element, partialMatch: false }));

const INNER = ["abacus", "costs", "domain", "admin-app", "application", "types"];
const OUTER = ["infrastructure", "sales-ui", "admin-ui", "ui-parts", "shell", "composition"];

/** Bir katmanın hangi yerel katmanları import edebileceğini tanımlar. */
const allowLocal = (from, to) => ({
  from: { element: { type: from } },
  allow: { to: { element: { types: { anyOf: to } } } },
});

const CORE = ["domain", "abacus", "types"];

export default tseslint.config(
  { ignores: ["node_modules", "dist", "dev-dist", "coverage", ".claude"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...abacus.configs.strict,
  {
    files: ["scripts/**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        require: "readonly",
        process: "readonly",
        console: "readonly",
        __dirname: "readonly",
      },
    },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    plugins: { boundaries },
    settings: {
      "import/resolver": { typescript: { alwaysTryTypes: true } },
      "boundaries/include": ["src/**/*"],
      "boundaries/ignore": ["src/**/*.test.ts", "src/**/*.test.tsx"],
      "boundaries/elements": ELEMENTS,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-restricted-properties": [
        "error",
        ...abacus.minorUnitGates,
        ...abacus.formatGates,
        ...FORMAT_BANS,
        ...DIALOG_BANS,
      ],
      "no-restricted-globals": [
        "error",
        ...["confirm", "alert", "prompt"].map((name) => ({
          name,
          message: "Tarayıcı kutusu yasak; useFeedback() kullanın.",
        })),
      ],
      "no-restricted-syntax": [
        "error",
        abacus.intlGate,
        ...abacus.silentDefaultGates,
        ...abacus.manualCurrencyGates,
        ...LOCAL_SYNTAX_BANS,
      ],
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          checkAllOrigins: true,
          checkUnknownLocals: true,
          policies: [
            allowLocal("abacus", ["abacus", "types"]),
            allowLocal("domain", CORE),
            allowLocal("costs", ["costs", ...CORE]),
            allowLocal("application", ["application", ...CORE]),
            allowLocal("admin-app", ["admin-app", "application", "costs", ...CORE]),
            allowLocal("infrastructure", [
              "infrastructure",
              "admin-app",
              "application",
              "costs",
              ...CORE,
            ]),
            allowLocal("ui-parts", ["ui-parts", "application", ...CORE]),
            allowLocal("sales-ui", ["sales-ui", "ui-parts", "application", ...CORE]),
            allowLocal("admin-ui", [
              "admin-ui",
              "ui-parts",
              "admin-app",
              "application",
              "costs",
              ...CORE,
            ]),
            allowLocal("shell", [
              "shell",
              "sales-ui",
              "admin-ui",
              "ui-parts",
              "application",
              ...CORE,
            ]),
            allowLocal("composition", [
              "composition",
              "shell",
              "sales-ui",
              "admin-ui",
              "ui-parts",
              "infrastructure",
              "admin-app",
              "application",
              "costs",
              ...CORE,
            ]),
            allowLocal("types", ["types"]),
            // Dış paketler — iç katmanlarda yalnız @snn/abacus-core
            {
              from: { element: { types: { anyOf: INNER } } },
              allow: { to: { module: { origin: "external", source: "@snn/abacus-core" } } },
            },
            {
              from: { element: { types: { anyOf: OUTER } } },
              allow: { to: { module: { origin: "external" } } },
            },
            {
              from: { element: { types: { anyOf: OUTER } } },
              allow: { to: { module: { origin: "core" } } },
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/presentation/**/*.tsx"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  eslintConfigPrettier,
);
