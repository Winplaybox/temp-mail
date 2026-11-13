import { Hero, SiteContent } from "@/components/Chrome";
import { TempMailApp } from "@/components/TempMailApp";
import { dictionaries } from "@/lib/i18n";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://temp-mail.winplaybox.in";

export default function Home() {
  const en = dictionaries.en;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "WinPlayBox Temp Mail",
      url: SITE,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Any",
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
      publisher: { "@type": "Organization", name: "WinPlayBox", url: "https://winplaybox.in" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: en.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];

  return (
    <>
      <Hero />
      <TempMailApp />
      <SiteContent />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
