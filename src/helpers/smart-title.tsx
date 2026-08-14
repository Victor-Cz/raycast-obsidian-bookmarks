import getPublisher from "./get-publisher";

/**
 * Segment separators commonly used by sites to append their name to page
 * titles. Only matched with surrounding whitespace, so hyphens or colons
 * inside a real title survive.
 */
const SEPARATOR = /(\s+(?:\||–|—|·|»|›|::|-)\s+)/;

/** Lowercases and strips accents and punctuation, for fuzzy name comparison. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Names the site could go by in a title, derived from the URL's hostname. */
function siteCandidates(url: string): Set<string> {
  const candidates = new Set<string>();
  const host = getPublisher(url);
  if (!host) return candidates;

  const bare = host.replace(/^www\./, "");
  candidates.add(normalize(bare));

  const labels = bare.split(".");
  if (labels.length > 1) {
    candidates.add(normalize(labels.slice(0, -1).join("")));
    // The registrable label ("stripe" in docs.stripe.com), skipping two-letter
    // second levels like .co.uk.
    let index = labels.length - 2;
    if (labels[index].length <= 2 && index > 0) index--;
    candidates.add(normalize(labels[index]));
  }

  candidates.delete("");
  return candidates;
}

/**
 * Normalizes a page title to "Site | Title": site-name segments are moved
 * from wherever the page put them ("Mon projet | Figma", "GitHub -
 * user/repo") to a consistent prefix, and one is added when the title lacks
 * it but the site is known (og:site_name). Titles that already start with the
 * site's name — landing-page taglines, "Redux: …" — are left unprefixed.
 */
export function smartTitle(rawTitle: string, url: string, siteName?: string | null): string {
  const title = rawTitle.trim().replace(/\s+/g, " ");
  if (!title) return title;

  const candidates = siteCandidates(url);
  if (siteName?.trim()) candidates.add(normalize(siteName));

  const isSite = (segment: string) => {
    const name = normalize(segment);
    return !name || candidates.has(name);
  };

  const tokens = title.split(SEPARATOR);
  const segments = tokens.filter((_, i) => i % 2 === 0);
  const separators = tokens.filter((_, i) => i % 2 === 1);

  // Peel site-name segments off both edges, remembering the first one found:
  // written by the site itself, it beats anything derived from the hostname.
  let strippedSite: string | null = null;
  let start = 0;
  let end = segments.length - 1;
  while (start < end && isSite(segments[start])) {
    strippedSite = strippedSite ?? segments[start];
    start++;
  }
  while (end > start && isSite(segments[end])) {
    strippedSite = strippedSite ?? segments[end];
    end--;
  }

  let core = segments[start];
  for (let i = start + 1; i <= end; i++) {
    core += separators[i - 1] + segments[i];
  }
  core = core.trim() || title;

  const site = siteName?.trim() || strippedSite?.trim() || "";
  if (!site || normalize(core).startsWith(normalize(site))) return core;

  return `${site} | ${core}`;
}

export type PageMeta = {
  /** The page's og:title (or twitter:title), usually cleaner than the tab title. */
  title: string | null;
  /** The page's og:site_name, feeding smartTitle's notion of the site. */
  siteName: string | null;
};

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&[a-z]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? entity);
}

function metaContent(html: string, key: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]*(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const content = match?.[1]?.trim();
    if (content) return decodeEntities(content);
  }
  return null;
}

/** Reads the page's Open Graph metadata; both fields null when unreachable. */
export async function fetchPageMeta(url: string): Promise<PageMeta> {
  const nothing: PageMeta = { title: null, siteName: null };
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      headers: { accept: "text/html,application/xhtml+xml" },
    });
    if (!response.ok || !(response.headers.get("content-type") ?? "").includes("html")) return nothing;

    // Meta tags live in <head>; a slice keeps huge pages cheap to scan.
    const html = (await response.text()).slice(0, 200_000);
    return {
      title: metaContent(html, "og:title") ?? metaContent(html, "twitter:title"),
      siteName: metaContent(html, "og:site_name"),
    };
  } catch {
    return nothing;
  }
}
