import MiniSearch from "minisearch";
import { Conversation } from "./types";

interface SearchDocument {
  uid: string;
  title: string;
  preview: string;
  project: string;
}

let index: MiniSearch<SearchDocument> | null = null;
let indexedCount = 0;

/**
 * Builds the search index from a list of conversations.
 * Skips rebuilding if the conversation count hasn't changed.
 */
export function buildIndex(conversations: Conversation[]) {
  if (index && indexedCount === conversations.length) return;

  index = new MiniSearch<SearchDocument>({
    fields: ["title", "preview", "project"],
    storeFields: ["uid"],
    idField: "uid",
    searchOptions: {
      boost: { title: 2, preview: 1, project: 1 },
      fuzzy: 0.25,
      prefix: true,
    },
  });

  const docs: SearchDocument[] = conversations.map((c) => ({
    uid: `${c.source}-${c.id}`,
    title: c.title,
    preview: c.preview,
    project: c.project,
  }));

  index.addAll(docs);
  indexedCount = conversations.length;
}

/**
 * Searches the index and returns matching conversation UIDs.
 * Returns null if no search query (meaning "show all").
 */
export function search(query: string, conversations: Conversation[]): Set<string> | null {
  if (!query.trim()) return null;

  // Ensure index is built (handles HMR and first-call cases)
  buildIndex(conversations);

  const results = index!.search(query.trim());
  return new Set(results.map((r) => r.id as string));
}
