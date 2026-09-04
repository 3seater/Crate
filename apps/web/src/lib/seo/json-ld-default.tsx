import { APP_DESCRIPTION, APP_TITLE, BASE_URL } from "@/config/app";

/**
 * Site-wide WebSite + Organization JSON-LD (see Next.js json-ld guide).
 * Sanitizes output per Next recommendation (`<` → `\u003c`).
 */
export function JsonLdDefault() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${BASE_URL}/#website`,
        name: APP_TITLE,
        url: BASE_URL,
        description: APP_DESCRIPTION,
        publisher: { "@id": `${BASE_URL}/#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${BASE_URL}/#organization`,
        name: APP_TITLE,
        url: BASE_URL,
      },
    ],
  };

  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD payload is built from app constants, sanitized per Next.js json-ld guide
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
      }}
      type="application/ld+json"
    />
  );
}
