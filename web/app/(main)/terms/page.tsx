import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of use", alternates: { canonical: "/terms" } };

export default function Terms() {
  return (
    <article className="prose">
      <h1>Terms of use</h1>
      <p>By using WinPlayBox Temp Mail you agree to these terms.</p>
      <h2>Allowed use</h2>
      <p>Use temporary addresses to protect your privacy: trying a service, downloading a file, joining Wi-Fi, or avoiding newsletters.</p>
      <h2>Not allowed</h2>
      <ul>
        <li>Fraud, impersonation, or creating fake accounts to abuse promotions, reviews or votes.</li>
        <li>Harassment, or receiving illegal content.</li>
        <li>Automated mass creation of addresses outside the published rate limits.</li>
      </ul>
      <p>We may block addresses, IP ranges or domains that are used for abuse.</p>
      <h2>No guarantees</h2>
      <p>The service is free and provided as-is. Some senders block disposable domains, mail can be delayed, and everything is deleted on expiry. Don't use temporary addresses for banking, government services or accounts you need to recover.</p>
    </article>
  );
}
