import { Icon, List } from "@raycast/api";
import { Dispatch, SetStateAction } from "react";
import DetailsActions from "../actions/DetailsActions";
import getFaviconIcon from "../helpers/get-favicon-icon";
import { File } from "../types";
import FileItemDetail from "./FileItemDetail";

type Props = {
  file: File;
  files: File[];
  loading: boolean;
  showDetail: boolean;
  setShowDetail: Dispatch<SetStateAction<boolean>>;
  onFileUpdated?: (file: File) => void;
  /** Off inside a bookmark's own sub-bookmarks view, where Enter re-opening it would loop. */
  openSubBookmarksByDefault?: boolean;
  /** Number of bookmarks saved under this one, shown as an accessory. */
  subCount?: number;
};
export default function FileListItem({ file, files, loading, subCount, ...actionProps }: Props): React.JSX.Element {
  const favorite = file.attributes.favorite;
  const tags = (file.attributes.tags || []).map((tag) => ({ text: tag }));
  // The chevron marks rows where Enter drills into the sub-bookmarks; where
  // Enter opens the link instead (the pinned parent of its own view), it goes.
  const entersSubView = actionProps.openSubBookmarksByDefault ?? true;
  const accessories = [
    ...tags,
    ...(favorite == null ? [] : [{ icon: Icon.Star }]),
    ...(subCount && entersSubView
      ? [
          {
            text: String(subCount),
            icon: Icon.Bookmark,
            tooltip: `${subCount} sub-bookmark${subCount > 1 ? "s" : ""}`,
          },
          { icon: Icon.ChevronRight },
        ]
      : []),
  ];

  return (
    <List.Item
      id={file.fullPath}
      title={file.attributes.title}
      subtitle={file.attributes.publisher ?? file.attributes.source}
      accessories={accessories}
      icon={getFaviconIcon(file.attributes)}
      actions={<DetailsActions file={file} files={files} {...actionProps} />}
      detail={<FileItemDetail file={file} loading={loading} />}
    />
  );
}
