import { Action, ActionPanel, Alert, confirmAlert, Icon, List, showToast, Toast } from "@raycast/api";
import { useEffect, useMemo, useRef, useState } from "react";
import getFaviconIcon from "../helpers/get-favicon-icon";
import getPublisher from "../helpers/get-publisher";
import readBookmarkBody from "../helpers/read-bookmark-body";
import saveToObsidian, { retitleBody } from "../helpers/save-to-obsidian";
import { fetchPageMeta, smartTitle } from "../helpers/smart-title";
import useFiles from "../hooks/use-files";
import { File } from "../types";

const FETCH_CONCURRENCY = 6;

type Proposal = {
  file: File;
  title: string;
  siteName: string | null;
};

/**
 * The stored publisher only counts as a human site name when someone set it to
 * one — a value equal to the URL's hostname is just the old default.
 */
function humanSiteName(file: File): string | null {
  const publisher = file.attributes.publisher?.trim();
  if (!publisher || publisher === getPublisher(file.attributes.source)) return null;
  return publisher;
}

/**
 * Previews every existing bookmark whose title Smart Titles would change, and
 * applies the renames on demand. The stored title stays the base — this
 * normalizes its shape, it doesn't re-title notes — and the network is only
 * used to look up missing site names (og:site_name).
 */
export default function NormalizeTitles(): React.JSX.Element {
  const { files, loading, backgroundLoading, updateFile } = useFiles();
  const [siteNameByPath, setSiteNameByPath] = useState<Map<string, string>>(new Map());
  const [pendingFetches, setPendingFetches] = useState(0);
  const [applying, setApplying] = useState(false);
  const scheduled = useRef(new Set<string>());

  // Look up og:site_name for bookmarks whose publisher is just the hostname,
  // a few pages at a time. Every result immediately refreshes the previews.
  useEffect(() => {
    if (backgroundLoading) return;
    const targets = files.filter(
      (file) => file.attributes.source && humanSiteName(file) == null && !scheduled.current.has(file.fullPath)
    );
    if (targets.length === 0) return;

    targets.forEach((file) => scheduled.current.add(file.fullPath));
    setPendingFetches((count) => count + targets.length);

    let cancelled = false;
    const queue = [...targets];
    const workers = Array.from({ length: FETCH_CONCURRENCY }, async () => {
      for (let file = queue.shift(); file && !cancelled; file = queue.shift()) {
        const meta = await fetchPageMeta(file.attributes.source);
        if (cancelled) return;
        const { fullPath } = file;
        if (meta.siteName) {
          const siteName = meta.siteName;
          setSiteNameByPath((previous) => new Map(previous).set(fullPath, siteName));
        }
        setPendingFetches((count) => count - 1);
      }
    });
    Promise.all(workers);

    return () => {
      cancelled = true;
    };
  }, [files, backgroundLoading]);

  const proposals = useMemo(() => {
    return files.flatMap((file) => {
      const siteName = siteNameByPath.get(file.fullPath) ?? humanSiteName(file);
      const title = smartTitle(file.attributes.title, file.attributes.source, siteName);
      if (!title || title === file.attributes.title) return [];
      return [{ file, title, siteName }];
    });
  }, [files, siteNameByPath]);

  async function apply(proposal: Proposal): Promise<File> {
    const body = await readBookmarkBody(proposal.file.fullPath);
    const updated: File = {
      ...proposal.file,
      body: retitleBody(body, proposal.title, proposal.file.attributes.source),
      attributes: {
        ...proposal.file.attributes,
        title: proposal.title,
        publisher: proposal.siteName ?? proposal.file.attributes.publisher,
      },
    };
    await saveToObsidian(updated);
    updateFile(updated);
    return updated;
  }

  async function applyOne(proposal: Proposal) {
    try {
      await apply(proposal);
      await showToast({ style: Toast.Style.Success, title: "Title normalized" });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Couldn't update this bookmark",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function applyAll() {
    const confirmed = await confirmAlert({
      icon: Icon.Pencil,
      title: `Normalize ${proposals.length} title${proposals.length > 1 ? "s" : ""}?`,
      message: "This rewrites the title and heading of these notes in your vault. Filenames are left untouched.",
      primaryAction: { title: "Normalize", style: Alert.ActionStyle.Default },
      dismissAction: { title: "Nevermind" },
    });
    if (!confirmed) return;

    setApplying(true);
    const toast = await showToast({ style: Toast.Style.Animated, title: "Normalizing titles…" });
    let done = 0;
    let failed = 0;
    for (const proposal of proposals) {
      try {
        await apply(proposal);
        done++;
      } catch (error) {
        console.error(`Couldn't update ${proposal.file.fullPath}:`, error);
        failed++;
      }
      toast.message = `${done + failed} / ${proposals.length}`;
    }
    setApplying(false);

    toast.style = failed ? Toast.Style.Failure : Toast.Style.Success;
    toast.title = failed ? `Normalized ${done}, ${failed} failed` : `Normalized ${done} title${done > 1 ? "s" : ""}`;
    toast.message = undefined;
  }

  const actions = (proposal: Proposal) => (
    <ActionPanel>
      <Action title="Apply This Change" icon={Icon.Check} onAction={() => applyOne(proposal)} />
      <Action
        title="Apply All Changes"
        icon={Icon.CheckCircle}
        shortcut={{ modifiers: ["cmd", "shift"], key: "enter" }}
        onAction={applyAll}
      />
    </ActionPanel>
  );

  return (
    <List
      isLoading={loading || backgroundLoading || pendingFetches > 0 || applying}
      navigationTitle="Normalize Bookmark Titles"
      searchBarPlaceholder="Filter proposed changes"
    >
      <List.EmptyView
        icon={Icon.CheckRosette}
        title="Nothing to normalize"
        description="Every bookmark title already matches the Site | Title format."
      />
      <List.Section title={`Proposed Changes (${proposals.length})`}>
        {proposals.map((proposal) => (
          <List.Item
            key={proposal.file.fullPath}
            icon={getFaviconIcon(proposal.file.attributes)}
            title={proposal.title}
            subtitle={`was: ${proposal.file.attributes.title}`}
            accessories={proposal.siteName ? [{ tag: proposal.siteName }] : []}
            actions={actions(proposal)}
          />
        ))}
      </List.Section>
    </List>
  );
}
