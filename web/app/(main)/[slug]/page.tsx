import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Hero } from "@/components/Chrome";
import { LandingContent } from "@/components/LandingContent";
import { TempMailApp } from "@/components/TempMailApp";
import { LANDINGS, landingBySlug } from "@/lib/landing";
import { appSchema, breadcrumbSchema, faqSchema, jsonLd, SITE } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return LANDINGS.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = landingBySlug((await params).slug);
  if (!page) return {};
  return {
    title: { absolute: `${page.title} | WinPlayBox` },
    description: page.description,
    alternates: { canonical: `/${page.slug}` },
    openGraph: { url: `${SITE}/${page.slug}`, title: page.title, description: page.description },
    twitter: { title: page.title, description: page.description },
  };
}

export default async function LandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const page = landingBySlug((await params).slug);
  if (!page) notFound();
  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href="/">Temp Mail</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{page.title.split(" — ")[0]}</span>
      </nav>
      <Hero h1={page.h1} lead={page.lead} />
      <TempMailApp initialTtl={page.ttl} />
      <LandingContent page={page} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd([
          { ...appSchema, url: `${SITE}/${page.slug}`, name: page.title.split(" — ")[0] },
          faqSchema(page.faq),
          breadcrumbSchema([
            { name: "Temp Mail", path: "/" },
            { name: page.title.split(" — ")[0], path: `/${page.slug}` },
          ]),
        ])}
      />
    </>
  );
}
