import { List } from "@raycast/api";
import { useMemo, useState } from "react";
import { countSubBookmarks, getSubBookmarks, noteName } from "../helpers/sub-bookmarks";
import { File } from "../types";
import FileListItem from "./FileListItem";

type Props = {
  parent: File;
  files: File[];
  onFileUpdated?: (file: File) => void;
};

/** The bookmarks saved under a parent bookmark, with the parent pinned on top. */
export default function SubBookmarks({ parent, files, onFileUpdated }: Props): React.JSX.Element {
  const [showDetail, setShowDetail] = useState(false);

  const subBookmarks = useMemo(() => getSubBookmarks(files, parent), [files, parent]);
  const subCounts = useMemo(() => countSubBookmarks(files), [files]);

  const itemProps = { files, loading: false, showDetail, setShowDetail, onFileUpdated };

  return (
    <List
      navigationTitle={parent.attributes.title}
      searchBarPlaceholder="Search sub-bookmarks"
      isShowingDetail={showDetail}
    >
      <List.Section title="Bookmark">
        <FileListItem file={parent} subCount={subBookmarks.length} openSubBookmarksByDefault={false} {...itemProps} />
      </List.Section>
      <List.Section title="Sub-bookmarks">
        {subBookmarks.map((file) => (
          <FileListItem file={file} subCount={subCounts.get(noteName(file)) ?? 0} key={file.fullPath} {...itemProps} />
        ))}
      </List.Section>
    </List>
  );
}
