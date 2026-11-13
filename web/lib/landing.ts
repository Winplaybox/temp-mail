// Keyword landing pages. Each has its own intent, copy and questions so they are not duplicates.
export type Landing = {
  slug: string;
  title: string; // <title>
  description: string; // meta description (≤ 160 chars)
  h1: string;
  lead: string;
  ttl?: number; // lifetime of the first address created on this page
  sections: { h: string; p: string[] }[];
  faq: { q: string; a: string }[];
};

export const LANDINGS: Landing[] = [
  {
    slug: "10-minute-mail",
    title: "10 Minute Mail — Free 10-Minute Temporary Email",
    description:
      "Get a 10 minute email address instantly. Receive verification codes in seconds, add time if you need it, and let the inbox delete itself. Free, no sign-up.",
    h1: "10 minute mail, ready the moment you land",
    lead: "Your address below lasts 10 minutes. Need longer? Add 10 minutes, an hour or a day before it runs out.",
    ttl: 10,
    sections: [
      {
        h: "When 10 minutes is enough",
        p: [
          "Most sign-ups only need one confirmation mail: a download link, a Wi-Fi portal code, or a one-time password. A 10 minute mailbox covers that and then disappears, so nothing is left behind for spammers to reuse.",
          "Copy the address, paste it into the form, and keep this tab open. New mail appears on its own and verification codes are pulled out for one-tap copy.",
        ],
      },
      {
        h: "Running out of time?",
        p: [
          "The postmark on the address card counts down. Press +10 min, +1 hour or +1 day to extend it — the same address keeps working and your mail stays.",
        ],
      },
    ],
    faq: [
      { q: "Can I get more than 10 minutes?", a: "Yes. Add 10 minutes, 1 hour or 1 day at any time before the address expires, up to 7 days in total." },
      { q: "What happens after 10 minutes?", a: "The address stops accepting mail and its messages and attachments are deleted within minutes." },
      { q: "Do I need to refresh the page?", a: "No. New mail shows up automatically while the tab is open." },
    ],
  },
  {
    slug: "fake-email-generator",
    title: "Fake Email Generator — Working Disposable Address",
    description:
      "Generate a fake email address that actually receives mail. Pick your own name or a random one, read messages instantly, and delete it when you're done.",
    h1: "Fake email generator that really receives mail",
    lead: "A random address is ready below. Press “Choose name” to make your own, like shop.deals@ — it's still disposable.",
    sections: [
      {
        h: "Fake address, real inbox",
        p: [
          "Many “fake email generators” only make up a string that looks like an address. This one creates a working inbox, so confirmation links and codes reach you and the account you're creating actually gets verified.",
          "Your real email stays private. When you're done, delete the address or let it expire on its own.",
        ],
      },
      {
        h: "Choose a name you'll remember",
        p: [
          "Random names like quick.zebra526 are fine for one-off sign-ups. For something you'll check again tomorrow, choose a custom name and a lifetime of up to a day.",
        ],
      },
    ],
    faq: [
      { q: "Is a fake email address legal?", a: "Using a disposable address to protect your privacy is legal. Using it for fraud or to abuse a service's terms is not, and such use is blocked here." },
      { q: "Can I send email from it?", a: "No. Addresses only receive, which keeps the service from being used for spam." },
      { q: "Can someone else open my inbox?", a: "Only the browser that created the address holds its secret key, so nobody else can read the messages." },
    ],
  },
  {
    slug: "disposable-email",
    title: "Disposable Email Address — Free & Private",
    description:
      "A free disposable email address for sign-ups, downloads and trials. Blocks tracking pixels, auto-deletes every message, and needs no registration.",
    h1: "Disposable email that cleans up after itself",
    lead: "Use the address below anywhere you don't want your real email. Everything is erased when it expires.",
    sections: [
      {
        h: "Why use a disposable address",
        p: [
          "Every site you give your real email to can sell it, leak it in a breach, or fill it with newsletters. A disposable address breaks that chain: the site gets a working inbox, and you walk away when you're done.",
          "Remote images in mail are blocked until you choose to load them, so senders can't see when you open their message.",
        ],
      },
      {
        h: "What gets deleted, and when",
        p: [
          "When the address expires — or the moment you press Delete — its messages, attachments and the address record are removed from our database.",
        ],
      },
    ],
    faq: [
      { q: "Is disposable email safe?", a: "It's safe for low-stakes sign-ups. Don't use it for banking, government services or accounts you need to recover later." },
      { q: "Why do some sites reject disposable addresses?", a: "Some services block known temporary domains. If that happens, use your real email for that site." },
      { q: "Do you keep logs of my mail?", a: "Mail is kept only until the address expires. We store a hashed IP for rate limits, never your name or real email." },
    ],
  },
  {
    slug: "temp-mail-for-otp",
    title: "Temp Mail for OTP & Verification Codes",
    description:
      "Receive OTP and email verification codes on a temporary address. Codes are detected automatically with one-tap copy. Works for app and website sign-ups.",
    h1: "Temp mail for OTP and verification codes",
    lead: "Paste the address below where the code should go. When the mail lands, the code appears in yellow — tap to copy.",
    sections: [
      {
        h: "Codes, found for you",
        p: [
          "Verification mails bury the code in a long template. We scan each new message for the one-time password and show it right in the inbox list and at the top of the mail, so you can copy it without opening anything.",
        ],
      },
      {
        h: "Fast enough for OTP timers",
        p: [
          "Mail is pushed to this tab the instant it arrives — no refresh button needed — so you can finish a sign-up before a 5-minute code expires.",
        ],
      },
    ],
    faq: [
      { q: "Will I get OTPs from Instagram, Facebook or Google?", a: "Many services send codes to any working inbox, but some block temporary domains. If a code never arrives, the service is likely blocking it." },
      { q: "How fast do codes arrive?", a: "Usually within a few seconds of the service sending them." },
      { q: "Can I get SMS OTPs here?", a: "No — this is email only." },
    ],
  },
  {
    slug: "burner-email",
    title: "Burner Email — Throwaway Inbox in One Click",
    description:
      "Get a burner email in one click. Keep several throwaway inboxes, switch between them, and burn each one when you're done. Free and private.",
    h1: "Burner email in one click",
    lead: "Your first burner is ready below. Make more with “New address” and switch between them anytime.",
    sections: [
      {
        h: "Keep a few burners going",
        p: [
          "Each address you create is saved in this browser, so you can run one for a trial, another for a forum and a third for a giveaway — and switch between them from the list above the inbox.",
        ],
      },
      {
        h: "Burn it when you're done",
        p: [
          "Press Delete and the address, its mail and its attachments are gone immediately. Otherwise each burner expires on its own at the time you chose.",
        ],
      },
    ],
    faq: [
      { q: "How many burner emails can I have?", a: "Up to 10 are kept in your browser at a time, with a limit of 15 new addresses per hour." },
      { q: "Do burners work on my phone?", a: "Yes. The site works in any mobile browser, and you can scan the QR code to move an address to your phone." },
      { q: "Is it really free?", a: "Yes, every feature is free with no account." },
    ],
  },
];

export const landingBySlug = (slug: string) => LANDINGS.find((l) => l.slug === slug);
