import { Icon, Image } from "@raycast/api";
import { getFavicon } from "@raycast/utils";
import { URL } from "node:url";
import { FrontMatter } from "../types";

const IMAGE_PATH = /\.(png|jpe?g|gif|svg|webp|ico|bmp|avif)$/i;
const MASK = Image.Mask.RoundedRectangle;

/**
 * Parses an http(s) URL, defaulting to https:// when no scheme is given, so
 * that an override can be written as either "example.com" or
 * "https://example.com".
 */
function parseUrl(value: string, allowMissingScheme: boolean): URL | null {
  let url: URL;
  try {
    url = new URL(allowMissingScheme && !/^[a-z][a-z\d+\-.]*:/i.test(value) ? `https://${value}` : value);
  } catch {
    // Invalid URLs aren't treated as invalid bookmarks, so we don't want to
    // break here — the caller falls back to the generic icon instead.
    return null;
  }

  // Anything else (obsidian://, file://, mailto:, ...) has no favicon to show.
  return url.protocol === "http:" || url.protocol === "https:" ? url : null;
}

/**
 * Returns the favicon of the bookmarked website, falling back to the generic
 * link icon when no favicon can be found.
 *
 * The `favicon` attribute — read from the frontmatter field named by the
 * `faviconField` preference — takes precedence over `source`. It can either
 * point at an image (used as-is) or at another website (whose favicon is used).
 */
export default function getFaviconIcon({ source, favicon }: Pick<FrontMatter, "source" | "favicon">): Image.ImageLike {
  const override = favicon?.trim();
  if (override) {
    const url = parseUrl(override, true);
    if (url) {
      return IMAGE_PATH.test(url.pathname)
        ? { source: url.toString(), fallback: Icon.Link, mask: MASK }
        : getFavicon(url, { fallback: Icon.Link, mask: MASK });
    }
  }

  const url = source ? parseUrl(source, false) : null;
  if (!url) return { source: Icon.Link, mask: MASK };

  return getFavicon(url, { fallback: Icon.Link, mask: MASK });
}
