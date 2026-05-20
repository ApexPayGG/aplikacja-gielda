import fs from "node:fs";
import path from "node:path";

const pagesDir = path.resolve("src/pages");
const skip = new Set([
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
]);

const patterns = [
  [
    / className="([^"]*)" style=\{\{\s*borderColor:\s*colors\.border,\s*backgroundColor:\s*colors\.bgPrimary\s*\}\}/g,
    ' className="$1 glass-section"',
  ],
  [
    / className="([^"]*)" style=\{\{\s*borderColor:\s*colors\.border,\s*backgroundColor:\s*colors\.bgSecondary\s*\}\}/g,
    ' className="$1 glass-panel"',
  ],
  [
    / className="([^"]*)" style=\{\{\s*borderColor:\s*colors\.borderStrong,\s*backgroundColor:\s*colors\.bgSecondary\s*\}\}/g,
    ' className="$1 glass-panel"',
  ],
  [
    / style=\{\{\s*backgroundColor:\s*colors\.bgPrimary,\s*color:\s*colors\.textPrimary\s*\}\}/g,
    "",
  ],
];

for (const file of fs.readdirSync(pagesDir)) {
  if (!file.endsWith(".tsx") || skip.has(file)) continue;
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, "utf8");
  const original = content;
  for (const [re, rep] of patterns) content = content.replace(re, rep);
  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log("stripped", file);
  }
}
