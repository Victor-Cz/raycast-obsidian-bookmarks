import { getPreferenceValues } from "@raycast/api";
import { useEffect, useReducer } from "react";
import { fetchPageMeta, smartTitle } from "../helpers/smart-title";
import { Preferences } from "../types";
import useFrontmostLink, { Link } from "./use-frontmost-link";

export interface LinkFormState {
  dirty: boolean;
  hasUpdatedWithLink: boolean;
  values: {
    title: string;
    url: string;
    favicon: string;
    /** Human name of the site ("GitHub"), saved as the `publisher` field. */
    siteName: string;
    /** Note name of the parent bookmark; empty for top-level bookmarks. */
    parent: string;
    tags: string[];
    description: string;
  };
}

function isEqual<T>(before: T, after: T) {
  if (before === after) return true;
  if (Array.isArray(before) && Array.isArray(after)) {
    if (before.length !== after.length) return false;
    if (before.length === 0) return true;
    return before.every((val, i) => after[i] === val);
  }
  return false;
}

type FormField = keyof LinkFormState["values"];
type LinkFormAction<Field extends FormField> =
  | { type: "changeField"; field: Field; value: LinkFormState["values"][Field] }
  | { type: "updateWithLink"; link: Link | null }
  | { type: "refineFromPage"; title: string; siteName: string | null }
  | { type: "setValues"; values: LinkFormState["values"] };

function reducer<Field extends FormField>(state: LinkFormState, action: LinkFormAction<Field>): LinkFormState {
  switch (action.type) {
    case "changeField": {
      return {
        ...state,
        dirty: !isEqual(action.value, state.values[action.field]),
        values: {
          ...state.values,
          [action.field]: action.value,
        },
      };
    }
    case "updateWithLink": {
      if (state.dirty) return state;
      return {
        ...state,
        hasUpdatedWithLink: true,
        values: {
          ...state.values,
          title: action.link?.title ?? state.values.title,
          url: action.link?.url ?? state.values.url,
        },
      };
    }
    case "refineFromPage": {
      // Better metadata arrived after the prefill (fetched from the page);
      // never overwrite anything the user already touched.
      if (state.dirty) return state;
      return {
        ...state,
        values: {
          ...state.values,
          title: action.title,
          siteName: action.siteName ?? state.values.siteName,
        },
      };
    }
    case "setValues": {
      return {
        ...state,
        dirty: true,
        values: action.values,
      };
    }
  }
}

export type LinkFormOptions = {
  detectFrontmostLink?: boolean;
};

export default function useLinkForm(
  initialValues: Partial<LinkFormState["values"]> = {},
  { detectFrontmostLink = true }: LinkFormOptions = {}
) {
  const initialState: LinkFormState = {
    dirty: false,
    hasUpdatedWithLink: !detectFrontmostLink,
    values: {
      description: "",
      favicon: "",
      parent: "",
      siteName: "",
      tags: [],
      title: "",
      url: "",
      ...initialValues,
    },
  };

  const { smartTitles } = getPreferenceValues<Preferences>();
  const { link, loading: linkLoading } = useFrontmostLink();
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (linkLoading || state.dirty || state.hasUpdatedWithLink || typeof link === "undefined") return;
    const cleaned = link && smartTitles ? { ...link, title: smartTitle(link.title, link.url) } : link;
    dispatch({ type: "updateWithLink", link: cleaned });
  }, [linkLoading, state, link, dispatch, smartTitles]);

  // The tab title is only a first guess: the page's Open Graph metadata holds
  // the clean, human-written title and the site's name, so fetch it and
  // upgrade the prefill when it arrives — unless the user started editing
  // meanwhile. Never runs when editing an existing bookmark: the frontmost
  // tab is unrelated to it.
  useEffect(() => {
    if (!smartTitles || !detectFrontmostLink || !state.hasUpdatedWithLink || state.dirty) return;
    if (linkLoading || link == null || !link.url) return;

    let cancelled = false;
    fetchPageMeta(link.url).then((meta) => {
      if (cancelled) return;
      const refined = smartTitle(meta.title ?? link.title, link.url, meta.siteName);
      if (refined && (refined !== state.values.title || meta.siteName)) {
        dispatch({ type: "refineFromPage", title: refined, siteName: meta.siteName });
      }
    });

    return () => {
      cancelled = true;
    };
    // Reruns only when the link lands, not on every keystroke of `state`.
  }, [link, linkLoading, smartTitles, detectFrontmostLink, state.hasUpdatedWithLink]);

  return {
    loading: linkLoading,
    values: state.values,
    setValues: (values: LinkFormState["values"]) => dispatch({ type: "setValues", values }),
    onChange:
      <Field extends FormField>(field: Field) =>
      (value: LinkFormState["values"][Field]) => {
        dispatch({ type: "changeField", field, value });
      },
  };
}
