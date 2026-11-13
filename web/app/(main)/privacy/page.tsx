import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy", alternates: { canonical: "/privacy" } };

export default function Privacy() {
  return (
    <article className="prose">
      <h1>Privacy</h1>
      <p>WinPlayBox Temp Mail gives you receive-only inboxes that delete themselves. This page explains what we keep and for how long.</p>
      <h2>What we store</h2>
      <ul>
        <li>The mail sent to your temporary address: sender, subject, body and attachments.</li>
        <li>A one-way hash of the secret key that unlocks your inbox. The key itself stays in your browser.</li>
        <li>A salted hash of your IP address, used only to stop people creating thousands of addresses.</li>
      </ul>
      <h2>How long we keep it</h2>
      <p>Everything tied to an address — mail, attachments and the address record — is deleted within about 15 minutes after the address expires, or right away when you press Delete.</p>
      <h2>What we don't do</h2>
      <ul>
        <li>We don't ask for your name, phone or real email.</li>
        <li>We don't read or sell your mail.</li>
        <li>Remote images in mail stay blocked until you choose to load them, so senders can't track when you open a message.</li>
      </ul>
      <h2>Ads and cookies</h2>
      <p>The site may show Google ads. Google can use cookies to serve them; see Google's ad settings to control this. Your inbox list, language and theme are saved in your browser's local storage.</p>
      <h2>Contact</h2>
      <p>Questions or abuse reports: use the contact form on <a href="https://winplaybox.in">winplaybox.in</a>.</p>
    </article>
  );
}
