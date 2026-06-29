import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.SITE_URL || "https://strikepath.example.com";
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/app/", "/api/"] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
