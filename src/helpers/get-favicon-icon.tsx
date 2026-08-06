import { Icon, Image } from "@raycast/api";
import { getFavicon } from "@raycast/utils";
import { URL } from "node:url";

/**
 * Returns the favicon of the bookmarked website, falling back to the generic
 * link icon when the source isn't an http(s) URL or when no favicon is found.
 */
export default function getFaviconIcon(source: string | null | undefined): Image.ImageLike {
  if (!source) return Icon.Link;

  let url: URL;
  try {
    url = new URL(source);
  } catch {
    // Invalid URLs aren't treated as invalid bookmarks, so we just show the
    // generic icon instead of breaking the list item.
    return Icon.Link;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return Icon.Link;

  return getFavicon(url, { fallback: Icon.Link, mask: Image.Mask.RoundedRectangle });
}
