// Best-guess extraction of a verification code (OTP) from an email.
// Prefers codes that appear near words like "code", "OTP", "verification".

const KEYWORDS =
  /(code|otp|one[-\s]?time|verification|verify|passcode|pin|security|confirm|login|sign[-\s]?in|कोड|ओटीपी)/i;

const CANDIDATE = /\b([0-9]{4,8}|[A-Z0-9]{3,4}-[A-Z0-9]{3,4}|(?=[A-Z0-9]*[0-9])(?=[A-Z0-9]*[A-Z])[A-Z0-9]{6,8})\b/g;

const YEAR = /^(19|20)\d{2}$/;

export function extractOtp(subject: string | null | undefined, text: string | null | undefined): string | null {
  const sources = [subject ?? "", (text ?? "").slice(0, 5000)];
  let fallback: string | null = null;

  for (const src of sources) {
    // Split into small windows so "keyword ... 123456" stays together.
    const lines = src.split(/\r?\n|(?<=[.!?])\s+/);
    for (let i = 0; i < lines.length; i++) {
      const window = [lines[i - 1] ?? "", lines[i], lines[i + 1] ?? ""].join(" ");
      const hasKeyword = KEYWORDS.test(window);
      for (const m of lines[i].matchAll(CANDIDATE)) {
        const code = m[1];
        if (YEAR.test(code)) continue;
        if (hasKeyword) return code;
        if (!fallback && /^[0-9]{6}$/.test(code)) fallback = code;
      }
    }
  }
  return fallback;
}
