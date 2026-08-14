import * as path from "node:path";

import { File } from "../types";

/** The note name (file name without extension) that wikilinks refer to. */
export function noteName(file: File): string {
  return path.basename(file.fileName, path.extname(file.fileName));
}

const WIKILINK = /^\[\[([^\]]+)\]\]$/;

/**
 * The parent's note name from a `parent` frontmatter value, accepting either a
 * `[[wikilink]]` (possibly with an `|alias` or `#heading`) or a bare name.
 */
export function parentNameOf(file: File): string | null {
  const raw = file.attributes.parent?.trim();
  if (!raw) return null;

  const match = raw.match(WIKILINK);
  const name = (match ? match[1] : raw).split(/[|#]/)[0].trim();
  return name || null;
}

/** The frontmatter value to store for a parent note name — a wikilink. */
export function asParentValue(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  return trimmed ? `[[${trimmed}]]` : null;
}

export function getSubBookmarks(files: File[], parent: File): File[] {
  const name = noteName(parent);
  return files.filter((file) => parentNameOf(file) === name);
}

/** How many sub-bookmarks each note name has, for list accessories. */
export function countSubBookmarks(files: File[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const file of files) {
    const name = parentNameOf(file);
    if (name != null) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

/**
 * True when the file belongs under another bookmark of the list. A dangling
 * parent link (note renamed or deleted) doesn't count, so the bookmark stays
 * reachable at the top level.
 */
export function isSubBookmark(parentNames: Set<string>, file: File): boolean {
  const name = parentNameOf(file);
  return name != null && parentNames.has(name);
}

/** True when making `parent` the parent of `file` would loop back to `file`. */
export function wouldCreateCycle(files: File[], parent: File, file: File): boolean {
  const byName = new Map(files.map((candidate) => [noteName(candidate), candidate]));
  const seen = new Set<string>();
  let current: File | undefined = parent;
  while (current) {
    if (current.fullPath === file.fullPath) return true;
    const name = parentNameOf(current);
    if (name == null || seen.has(name)) return false;
    seen.add(name);
    current = byName.get(name);
  }
  return false;
}
