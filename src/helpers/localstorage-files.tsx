import { LocalStorage } from "@raycast/api";
import { File, isFile, unique } from "../types";

type SafelyRunFunc<Args extends unknown[], Return> = (...args: Args) => Return;

function safelyRun<Args extends unknown[], Return>(
  func: SafelyRunFunc<Args, Return>,
  defaultValue: Return
): SafelyRunFunc<Args, Return> {
  return (...args: Args) => {
    try {
      return func(...args);
    } catch (err) {
      console.error(`Could not safely ${func.prototype.name ? `run ${func.prototype.name}` : "handle files"}`, err);
      return defaultValue;
    }
  };
}

function isFileArray(v: unknown): v is File[] {
  if (v == null) return false;
  return Array.isArray(v) && v.every((val) => isFile(val));
}

/**
 * Version of the cached files' shape. Files are only re-read when their mtime
 * changes, so a cache written before the parser learned a new frontmatter
 * field keeps serving bookmarks without it. Bump this whenever
 * `extractFrontMatter` reads something new: a cache from another version is
 * discarded and every note is parsed again.
 */
const CACHE_VERSION = 1;
const CACHE_VERSION_KEY = "obsidian-files-version";

async function getLocalStorageFilesInternal(): Promise<File[]> {
  const version = await LocalStorage.getItem<number>(CACHE_VERSION_KEY);
  if (version !== CACHE_VERSION) return [];

  const stored = await LocalStorage.getItem<string>("obsidian-files");
  if (!stored) return [];

  try {
    const json = JSON.parse(stored);
    if (isFileArray(json)) {
      return json.map((file) => ({
        ...file,
        attributes: {
          ...file.attributes,
          saved: new Date(file.attributes.saved),
        },
        mtime: Number(file.mtime),
      }));
    } else {
      throw new Error(`Unexpected format for obsidian files in Local Storage: ${stored}`);
    }
  } catch (error) {
    console.error("Error parsing stored files:", error);
    return [];
  }
}

interface SerializedFile {
  attributes: {
    source: string;
    publisher: string | null;
    favicon: string | null;
    title: string;
    tags: string[];
    saved: string;
    read: boolean;
  };
  mtime: number;
  frontmatter: string | null;
  bodyBegin: number | null;
  fileName: string;
  fullPath: string;
}

async function replaceLocalStorageFilesInternal(files: File[]): Promise<void> {
  const sanitizedFiles = files.map((file) => ({
    ...file,
    attributes: {
      ...file.attributes,
      source: file.attributes.source || "",
      publisher: file.attributes.publisher || null,
      favicon: file.attributes.favicon || null,
      title: file.attributes.title || "",
      tags: file.attributes.tags || [],
      saved: file.attributes.saved.toISOString(),
      read: !!file.attributes.read,
    },
    mtime: Number(file.mtime),
    frontmatter: file.frontmatter || null,
    bodyBegin: file.bodyBegin || null,
  }));

  try {
    const json = JSON.stringify(sanitizedFiles);
    const parsed = JSON.parse(json) as SerializedFile[];
    if (!parsed.every((f) => typeof f.mtime === "number" && f.mtime > 0)) {
      console.error("Validation failed: some files have invalid mtime");
    }
    await LocalStorage.setItem("obsidian-files", json);
    await LocalStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
  } catch (error) {
    console.error("Failed to serialize files:", error);
    throw error;
  }
}

async function addToLocalStorageFilesInternal(files: File[]): Promise<void> {
  const existing = await getLocalStorageFilesInternal();
  const newSet = unique([...existing, ...files]);
  await replaceLocalStorageFiles(newSet);
}

export const getLocalStorageFiles = safelyRun(getLocalStorageFilesInternal, Promise.resolve([]));
export const replaceLocalStorageFiles = safelyRun(replaceLocalStorageFilesInternal, Promise.resolve(undefined));
export const addToLocalStorageFiles = safelyRun(addToLocalStorageFilesInternal, Promise.resolve(undefined));
