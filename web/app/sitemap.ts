import type { MetadataRoute } from "next";
import { LANDINGS } from "@/lib/landing";
import { SITE } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: `${SITE}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
      alternates: { languages: { en: `${SITE}/`, hi: `${SITE}/hi` } },
    },
    {
      url: `${SITE}/hi`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
      alternates: { languages: { en: `${SITE}/`, hi: `${SITE}/hi` } },
    },
    ...LANDINGS.map((l) => ({
      url: `${SITE}/${l.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    { url: `${SITE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
