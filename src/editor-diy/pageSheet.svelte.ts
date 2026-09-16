/**
 * The page itself: what it is called, and deleting it.
 *
 * Reached from the ⋯ on the current tab, and only from there. It was also behind
 * the set key on the board, which was the one cell that did not open the thing
 * under it; that cell opens its own key now like the other four, and what is left
 * here is what belongs to the page rather than to any of them.
 *
 * editor-diy/PageRows.svelte carries the one field and the argument for what is
 * no longer beside it.
 */
import { t } from "../core/texts.js";
import { openSheet } from "../shell/sheet.svelte.js";
import PageRows from "./PageRows.svelte";
import { askDelete } from "./editor.js";
import { commit, set } from "./standing.svelte.js";

export interface PageSheet {
  draft: { name: string };
}

export function openPageSheet(): Promise<void> {
  const entry = set();
  const draft = $state({ name: entry.name });
  const sheet: PageSheet = { draft };

  return openSheet<PageSheet>({
    title: t("ui.set_title"),
    rows: PageRows,
    state: sheet,
    remove: {
      label: t("ui.remove_set"),
      // The question is askDelete's, and it draws a dialog of its own over this
      // one. Only a yes closes this sheet, because a no leaves somebody exactly
      // where they were.
      onPress: (settle) => {
        void askDelete().then((gone) => { if (gone) settle(); });
      },
    },
    done: {
      label: t("ui.done"),
      onPress: () => {
        entry.name = sheet.draft.name;
        commit();
      },
    },
  }).then(() => undefined);
}
