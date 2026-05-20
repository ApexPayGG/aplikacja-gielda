import fs from "node:fs";
import path from "node:path";

const pagesDir = path.resolve("src/pages");
const skipFiles = new Set([
  "LandingPage.tsx",
  "LoginPage.tsx",
  "RegisterPage.tsx",
  "WaitlistPage.tsx",
  "ForgotPasswordPage.tsx",
  "ResetPasswordPage.tsx",
  "VerifyEmailPage.tsx",
  "PaymentSuccessPage.tsx",
  "PaymentCancelPage.tsx",
  "NotFoundPage.tsx",
  "ErrorPage.tsx",
  "Home.tsx",
]);

const replacements = [
  [/rounded-3xl border border-border bg-bgPrimary/g, "glass-section rounded-3xl"],
  [/rounded-2xl border border-border bg-bgPrimary/g, "glass-section rounded-2xl"],
  [/rounded-xl border border-border bg-bgPrimary/g, "glass-panel rounded-xl"],
  [/border border-border bg-bgPrimary/g, "glass-panel border border-white/10"],
  [/border border-border bg-bgSecondary/g, "glass-panel border border-white/10 bg-white/5"],
  [/rounded-2xl border border-border bg-bgSecondary/g, "glass-panel rounded-2xl border border-white/10 bg-white/5"],
  [/rounded-xl border border-border bg-bgSecondary/g, "glass-panel rounded-xl border border-white/10 bg-white/5"],
  [/text-3xl font-bold text-brandDark/g, "glass-page-title text-3xl"],
  [/text-4xl font-bold text-brandDark/g, "glass-page-title text-4xl"],
  [/text-2xl font-bold text-brandDark/g, "text-2xl font-bold text-white"],
  [/text-xl font-bold text-brandDark/g, "text-xl font-bold text-white"],
  [/text-lg font-semibold text-brandDark/g, "text-lg font-semibold text-white"],
  [/text-sm text-textSecondary/g, "glass-muted text-sm"],
  [/text-textSecondary/g, "glass-muted"],
  [/text-textMuted/g, "text-white/50"],
  [/text-textPrimary/g, "text-white"],
  [/text-brandDark/g, "text-white"],
  [/bg-bgTertiary/g, "bg-white/10"],
  [/border-borderStrong/g, "border-white/20"],
  [/border-border/g, "border-white/10"],
  [/min-h-screen" style=\{\{ backgroundColor: colors\.bgPrimary[^}]+\}\}/g, 'min-h-screen"'],
  [/style=\{\{ backgroundColor: colors\.bgPrimary, color: colors\.textPrimary \}\}/g, ""],
];

function stripGlassPageShell(content) {
  return content
    .replace(/import \{ GlassPageShell \}[^\n]+\n/g, "")
    .replace(/import \{ GlassAmbient \}[^\n]+\n/g, "")
    .replace(/<GlassPageShell[^>]*>/g, "<div>")
    .replace(/<\/GlassPageShell>/g, "</div>")
    .replace(
      /<div className=\{`\$\{GLASS_PAGE_BG\}[^`]*`\}>[\s\S]*?<GlassAmbient \/>/g,
      "<div>",
    )
    .replace(/GLASS_PAGE_BG,\s*/g, "")
    .replace(/,\s*GLASS_PAGE_BG/g, "");
}

for (const file of fs.readdirSync(pagesDir)) {
  if (!file.endsWith(".tsx") || skipFiles.has(file)) continue;
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, "utf8");
  const original = content;
  content = stripGlassPageShell(content);
  for (const [pattern, replacement] of replacements) {
    content = content.replace(pattern, replacement);
  }
  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log("updated", file);
  }
}
