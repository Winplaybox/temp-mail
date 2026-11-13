export const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://temp-mail.winplaybox.in").replace(/\/$/, "");

export function jsonLd(objects: object[]) {
  return { __html: JSON.stringify(objects).replace(/</g, "\\u003c") };
}

export function faqSchema(faq: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${SITE}${it.path}` })),
  };
}

export const appSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "WinPlayBox Temp Mail",
  url: SITE,
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Any",
  inLanguage: ["en", "hi"],
  offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
  publisher: { "@type": "Organization", name: "WinPlayBox", url: "https://winplaybox.in", logo: `${SITE}/icon.svg` },
};
