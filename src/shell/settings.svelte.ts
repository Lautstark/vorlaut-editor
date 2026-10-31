// What this installation is set to, as opposed to what is in a Sammlung: the
// Azure key and region, which symbol source is in force, the METACOM rendering
// preference, the colour scheme. None of it is in layout.json, because none
// of it travels with the content.
//
// This is the lower half of the settings sheet. The opener is in
// voices.svelte.ts and the sheet itself is SettingsSheet.svelte.
//
// **What changed on 2026-09-16 is where the drawing went, not what is drawn.**
// Every function here whose name began with `render` or `paint` wrote text into
// an element it had found by id, and the sheet's markup was a template in
// another file - so which sentence went where was a fact spread across two
// files and held together by nobody. The sentences are answers now, held as
// runes, and shell/SettingsSheet.svelte draws them. What is left in this file
// is what it was always about: what this installation is set to, how to change
// it, and the one-errand-at-a-time queue at the foot. adr/0025.
import { status } from "./dom.js";
/* The lookup with the note attached, because what this module answers with is
 * drawn: a panel's state line, the sentence under a field, the word on a
 * button. Every one of those has to move when the page changes language, and
 * `t` out of core/texts.ts is the same table without the subscription. See the
 * head of shell/live.svelte.ts. */
import { t } from "./live.svelte.js";
import { confirmDialog, openDialog } from "./dialog.js";
import { reason } from "../core/errors.js";
import type { AzureAsk, AzureState, Settings, WantedSettings } from "../core/types.js";
import { readSettings, writeSettings, azureState, listCollections }
  from "../backend/index.js";
import { readTheme, type Theme } from "@lautstark/design/theme";
import { load } from "../core/save.js";
import { paintCollections } from "./collections.js";
import * as symbols from "../data/symbols.js";
import { exportEverything, importBackup, isBackup, TOO_NEW } from "../data/backup.js";
import { boardTotals, wipeEverything } from "../data/store.js";
import { adopt, adopted, refusal } from "./adopt.js";
import { ablage, folderName, wipeReaches } from "../data/folder.js";
import { adoptFolder } from "../data/store.js";
import type { Ablage } from "@lautstark/sicherung/ablage";
import type { Sicherung } from "@lautstark/sicherung";
import { downloadJson } from "@lautstark/werkzeuge/download";

/* $state.raw, and every record out of the backend below is the same. These
   come back from readSettings() and writeSettings() whole and are replaced
   whole; a deep proxy would buy nothing and would cost the thing wochenwerk's
   pilot found out the hard way - a proxied record is refused by
   structuredClone() and by IndexedDB, and this one is handed straight back to
   writeSettings(). */
let settings = $state.raw<Settings>({
  azureKey: { set: false, hint: "" }, azureRegion: "",
  metacom: { path: "", ok: false, count: 0, fixed: false } });

/** What this installation is set to, as the sheet reads it. */
export const installed = (): Settings => settings;

/** The lines the two errand panels report into. Their own rather than the page
 *  status line, because they are the outcome of something pressed inside a
 *  panel and belong beside the button that was pressed. */
let dataLine = $state("");
let boardLine = $state("");
export const dataState = (): string => dataLine;
export const boardState = (): string => boardLine;
export const sayData = (line: string): void => { dataLine = line; };

/** The colour scheme, which is localStorage's rather than this record's - see
 *  the note at THEME_KEY. Held here so the three buttons and the panel's state
 *  line are drawn from one answer. */
let theme = $state<Theme>("system");
export const themeNow = (): Theme => theme;

/* Bumped whenever the METACOM provider says something arrived or went. The
 * rendering list, whether METACOM can be chosen at all and the folder's own
 * summary are all derived from the provider rather than from `settings`, and a
 * provider is not a rune - so this is the note that it moved. */
let folderMoved = $state(0);
export const folderState = (): number => folderMoved;

/* Three of the sheet's panels are the packages' components -
 * @lautstark/sicherung's `DatenPanel`, @lautstark/bildquelle's `SymbolePanel`
 * and @lautstark/stimmquelle's `AzureConnection` - drawn by
 * SettingsSheet.svelte. What is left in this file is what a product owes
 * them: the objects they are about, the words this page says about what they
 * did, and which symbol source is in force. conventions.md §6.8. */

/** The store this browser files its work in, as the panel's own subject. */
export const dataStore = (): Ablage => ablage;

/** What the store panel does once a folder is settled on. */
export const adoptDataFolder = adoptFolder;

/** Everything on screen is about to be wrong. The store panel says so and
 *  this is the whole of what this page can do about it. */
export const dataFolderChanged = (): void => { location.reload(); };

/** The standing backup, handed in by app.ts and held so the panel can be
 *  about it. Null until wireData() runs, which is before any sheet opens -
 *  `$state.raw` because it is replaced whole and never mutated. */
let standing = $state.raw<Sicherung | null>(null);
export const standingBackup = (): Sicherung | null => standing;

/* The rendering preference. METACOM ships the same symbols several times
 * over - with and without a frame, with and without the word printed on the
 * picture - as parallel folders holding identical file names. A preference
 * orders the search and filters nothing out. The list of renderings, and
 * whether there is anything to choose between at all, are SymbolePanel's: it
 * offers them in METACOM's ⋯ where the folder holds two or more. */

/** Told to the provider and written down, in that order: the provider ranks
 *  the next search by it, and without the second half the choice lasted
 *  exactly as long as the tab did. */
export function chooseRendering(chosen: string | null): void {
  symbols.preferRendering(chosen);
  /* The provider already ranks by it, so a write that fails costs only the
     remembering - said on the status line, where it used to be an unhandled
     rejection and a choice that quietly lasted as long as the tab. */
  saveSettings({ metacomRendering: chosen }).catch((error: unknown) => {
    status(t("ui.data_failed", { error: reason(error) }));
  });
  folderMoved += 1;
}

export const preferredRendering = (): string | null => {
  folderState();
  return symbols.preferredRendering() || null;
};

/* Which collection the picker offers, and the one control that changes it.
 *
 * SymbolePanel asks the question - ARASAAC or METACOM - and calls useSource()
 * with the answer: when somebody taps a card, when a folder has just been read
 * in, and when a folder that was the answer is forgotten. METACOM cannot be
 * the answer without a folder that reads; the panel does not offer it as one,
 * and readSettings() refuses the value. */
export const activeSource = (): string => settings.activeProvider || "arasaac";
export const metacomOffered = (): boolean => {
  folderState();
  return symbols.metacomReady();
};

/** Switches the collection a search offers. Nothing on any board moves.
 *
 *  Nothing to repaint afterwards either: the field that names the collection
 *  and the line that credits it are read as a sheet is built - see
 *  picker.ts's searchPlaceholder() and creditLine() - so the next sheet to
 *  open is already right and there is no open one to correct. */
export async function useSource(source: "arasaac" | "metacom"): Promise<void> {
  if (activeSource() === source) return;
  symbols.setActiveSource(source);
  await saveSettings({ activeProvider: source });
}

/* ------------------------------------------------------------ the scheme ---
 *
 * localStorage rather than the settings this module otherwise reads and writes,
 * and the reason is timing rather than taste: the scheme has to be readable
 * before the first paint or the page comes up in the OS's answer and corrects
 * itself a frame later, which is a white flash on exactly the setup somebody
 * chose dark to avoid. readSettings() is asynchronous. The inline script in
 * index.html is the half that runs before this module exists;
 * @lautstark/design/theme carries the rest, and both siblings share it.
 *
 * It is not written into the board either. A board travels - it is exported,
 * imported and flashed onto a device - and how bright this browser is on this
 * tablet is not a property of the board.
 */
export const THEME_KEY = "vorlaut.theme";

export const themeLabel = (one: Theme): string => t(`ui.theme_${one}`);

/** Somebody pressed one of the three, and this is the half of it that is
 *  still here.
 *
 *  Writing the choice down and putting it in force are
 *  @lautstark/design/svelte/ThemePicker's now (conventions.md §6.10) - it is
 *  handed THEME_KEY and calls saveTheme() and applyTheme() itself, which is
 *  the whole of what this function used to do first. What is left is the one
 *  thing that is this product's: the answer the panel's state line is drawn
 *  from, so that the three buttons and the heading above them go on reading
 *  from one place.
 *
 *  This control and its heading, and nothing else: the tokens carry the scheme
 *  to everything else on the page, which is what tokens are for. */
export function chooseTheme(one: Theme): void {
  theme = one;
}

/** Read back off localStorage. Called when the sheet opens and after a
 *  language switch, which is the one that matters: a heading that keeps its old
 *  language while the body changes is worse than one that never changed. */
export function readThemeNow(): void {
  theme = readTheme(THEME_KEY);
}

/** The state line of every panel, re-read rather than remembered. Called when
 *  the sheet opens and after a language switch.
 *
 *  Only the scheme is left to read here. The shared panels redraw themselves
 *  on a language switch because `lang` is a prop (conventions.md §6.8), and
 *  the Azure connection asks Azure itself whenever the stored key or region
 *  moves - so there is no heading line left for this file to keep. */
export function paintStates(): void {
  readThemeNow();
}

/** Whether Azure answers, asked about a pairing.
 *
 * **The seam stays wordless and the words are the sheet's.** azureState()
 * hands back a code; SettingsSheet.svelte turns it into the connection's
 * answer and boot_data.ts holds the sentences. §6.9 calls that the better half
 * of the arrangement, and it is why the panel takes a probe rather than owning
 * one - a panel that brought its own would have to bring German with it. */
export const askAzure = (ask: AzureAsk): Promise<AzureState> => azureState(ask);

/** What a read or a write leaves behind: the note that the METACOM provider
 *  may have moved, and the symbols panel unfolded where a folder that was set
 *  cannot be read - somebody meant to set this up and it is not working.
 *
 *  Nothing describes the Azure key from here any more: AzureConnection asks
 *  on arrival and whenever the stored key or region moves. */
function renderSettings(): void {
  if (settings.metacom.path && !settings.metacom.ok) unfoldSymbols();
  folderMoved += 1;
}

/* The one panel this file asks to be opened, and the one thing it needs the
 * component for. A slot rather than an import, because the component imports
 * this module and a cycle that happens to work is one nobody can reason
 * about. */
let unfold: () => void = () => {};
export function useUnfoldSymbols(fn: () => void): void { unfold = fn; }
const unfoldSymbols = (): void => { unfold(); };

/* ------------------------------------------ a Sammlung as a document ---
 *
 * Open Board Format, which is what other AAC software reads. Only the way *in*
 * is here: exporting is in the work head's ⋯, beside the Sammlung it would
 * export, because that is an act on one particular Sammlung and this is not.
 *
 * **It adds; it never replaces.** A file arriving joins the Sammlungen already
 * here, as a new one, named after the file it came from. Replacing was the old
 * behaviour and the argument for it was thin: the two acts are asked for in
 * different words - "open this" and "put my machine back" - and only the second
 * is destructive. conventions.md §1.10.
 *
 * There is nothing to confirm, which is the other half of adding: nothing is
 * lost, so nothing has to be agreed to first.
 */

/* The hidden file input lives in the frame rather than in the sheet - it is a
 * way to open a file dialog with no visible control, and it belongs to no
 * panel. The button that presses it is in the sheet, which is why the node is
 * handed over here rather than held by whichever component draws it. */
let boardFile: HTMLInputElement | null = null;
export function useBoardFile(node: HTMLInputElement): void { boardFile = node; }

// One way in, and it is here rather than in the sidebar: the sidebar holds
// the list, the way to make one, and the way out of the page. Importing is
// rare, and it belongs beside the prose that says what the format is.
export function pickBoardFile(): void { boardFile?.click(); }

export async function takeBoardFile(): Promise<void> {
  const file = boardFile?.files?.[0];
  if (boardFile) boardFile.value = "";
  if (!file) return;
  boardLine = "";
  try {
    // The same path ?sammlung= takes - see shell/adopt.ts for why the two
    // must not each have their own.
    boardLine = adopted(await adopt(file, file.name.replace(/\.[^.]+$/, "")));
  } catch (error) {
    boardLine = refusal(error);
  }
}

/** The Daten panel: the standing backup, and the one-file Sicherung under it.
 *
 * Separate from the board panel above, and the separation is the point. That
 * panel hands out an .obz - a board, in the format other AAC software reads.
 * This one is about this browser's whole state, in a shape only vorlaut reads,
 * and the two would blur into "export" if they shared a panel. */
export function wireData(backup: Sicherung): void {
  /* The dated copies go into the store's folder when there is one - the
     panel hands it over when a folder is chosen, app.ts at start - so there
     is no second folder to offer and nothing to decide here. */
  standing = backup;
}

/* Delete everything, which this editor was the only one in the family without.
   Same shape as its three siblings: its own panel last in the column, a
   confirmation that counts what goes and says how far it reaches, a refusal
   where the folder is out of reach, and the one typed word in the product. */
export async function wipeAll(): Promise<void> {
  const reach = wipeReaches();
  const where = folderName();

  if (reach === "unreachable") {
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "btn primary";
    ok.textContent = t("ui.understood");
    const sheet = openDialog({
      title: t("ui.danger_blocked_title"),
      body: [t("ui.danger_blocked", { folder: where })],
      footer: [ok],
    });
    ok.addEventListener("click", () => sheet.close());
    return;
  }

  const totals = await boardTotals();
  if (!await confirmDialog({
    title: t("ui.danger_wipe"),
    body: t(reach === "folder" ? "ui.danger_ask_folder" : "ui.danger_ask_browser",
      { ...totals, folder: where }),
    confirmLabel: t("ui.danger_do"),
    danger: true,
    /* The one act here that asks for a word: it empties the boards on every
       device the household has. design.md §4.3 says spending this anywhere
       else is what breaks it. */
    requireTyping: t("ui.danger_word"),
    typingLabel: t("ui.danger_type"),
  })) return;

  await wipeEverything();
  dataLine = t("ui.danger_done");
  location.reload();
}

export async function exportData(): Promise<void> {
  dataLine = "";
  try {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJson(await exportEverything(t("ui.data_notice")),
                 `vorlaut-sicherung-${stamp}.json`);
    dataLine = t("ui.data_exported");
  } catch (error) {
    dataLine = t("ui.data_failed", { error: reason(error) });
  }
}

export async function importData(file: File): Promise<void> {
  dataLine = "";
  try {
    const parsed = JSON.parse(await file.text());
    if (!isBackup(parsed)) throw new Error(t("ui.data_failed", { error: file.name }));
    /* Read first, ask second: a file that turns out to be unreadable should
     * not have cost anybody a question, and this restore replaces every
     * Sammlung here rather than merging into them - a merge would have to
     * decide what an arriving Sammlung and a stored one with the same id
     * are, and every answer to that is a rule the person holding the file
     * cannot see. data/backup.ts argues it at length. conventions.md §1.10
     * allows the replacement; it is the one act that is a whole-library
     * restore rather than an import.
     *
     * The question is a <dialog>, not window.confirm (§3.4). This was the
     * last native one in the family and it was on the most destructive path
     * in the product - the one surface no token reaches, asking about
     * everything somebody has.
     *
     * And it counts what goes (§1.7). "Fortfahren?" named nothing: a person
     * with one Sammlung and a person with nine were asked the same question,
     * and the number is the only thing in it that could change a mind. Two
     * keys rather than a plural rule, the way the delete question does it -
     * the singular differs by more than an ending in both languages. */
    const here = (await listCollections()).collections.length;
    const one = here === 1 ? "_one" : "";
    if (!await confirmDialog({
      title: t("ui.data_replace"),
      body: t(`ui.data_replace_ask${one}`, { n: here }),
      confirmLabel: t(`ui.data_replace_go${one}`, { n: here }),
      // Never the same word as the button beside it: two dismissals sharing
      // an accessible name is ambiguous to anyone navigating by it.
      danger: true,
    })) return;
    const done = await importBackup(parsed);
    // The store has them; this page is still holding the board it had.
    // load() re-reads whichever board the file says was open, adopts its
    // language and resets the stamp this page writes against.
    // replaceLayout() was here and is wrong on both counts now: it would
    // write the restored board straight back under the version from before
    // the restore, which is this tab conflicting with itself.
    await load();
    await paintCollections();
    dataLine = t("ui.data_imported", { boards: done.boards, symbols: done.symbols });
  } catch (error) {
    // The data layer has no language and answers with a code; this is where
    // the code becomes a sentence.
    dataLine = error instanceof Error && error.message === TOO_NEW
      ? t("ui.data_too_new")
      : t("ui.data_failed", { error: reason(error) });
  }
}

export function wireSymbolFolder(): void {
  // The provider says when a folder arrives or goes; nothing here polls.
  //
  // The whole sheet and not just this panel. A folder arriving changes more
  // than the line that names it: whether METACOM can be the active source is
  // derived from whether it answers, and readSettings() is what says so.
  symbols.subscribeMetacom(() => void loadSettings());
}

/* One settings errand at a time, in the order they were asked for.
 *
 * Reading and writing both end by putting a value into `settings` and into
 * symbols.setActiveSource(), and both are asynchronous. The provider's
 * subscription fires a read the moment a folder finishes indexing, and
 * SymbolePanel picks METACOM on the back of that same arrival - so a read that
 * started before the write resolved after it and put the source it had found
 * back over the one that had just been chosen. What that looked like: the
 * folder installed, the switch announced in the header, and the picker still
 * searching ARASAAC. Nothing was wrong in storage, which is
 * why it survived a reload and only showed on the visit that did it.
 *
 * Same shape as saveChain in core/save.ts, and for the same reason: the caller
 * has to be able to wait for its own errand to have actually happened. */
let errands: Promise<unknown> = Promise.resolve();

function inTurn<T>(job: () => Promise<T>): Promise<T> {
  const mine = errands.then(job, job);
  // The chain must not stay rejected, or every errand after a failed one would
  // be skipped. Each caller still sees its own rejection through `mine`.
  errands = mine.catch(() => {});
  return mine;
}

export async function loadSettings(): Promise<void> {
  return inTurn(async () => {
    try {
      settings = await readSettings();
      // Before anything draws: the provider ranks its search results by this,
      // so a preference that arrives after the first search would silently not
      // have applied to it.
      symbols.preferRendering(settings.metacomRendering ?? null);
      // readSettings() has already refused "metacom" when no folder answers, so
      // this is the source the picker can actually search.
      symbols.setActiveSource(settings.activeProvider || "arasaac");
      renderSettings();
    } catch (error) {
      status(t("ui.voice_failed", { error: reason(error) }));
    }
  });
}

/** Writes whatever was asked, and nothing else.
 *
 * The rendering preference is a menu that acts on change, the source is a
 * card, the Azure pairing is a form that hands back what it was told to keep.
 * Absent is "leave the stored one alone" for every field in writeSettings(),
 * so a caller saying nothing about a setting leaves it alone.
 *
 * The METACOM path field that used to ride along on every save has gone: the
 * folder is the one this browser reads, readSettings() names it from the
 * provider, and writeSettings() never stored what was typed. */
export async function saveSettings(
  extra: Partial<WantedSettings> = {},
): Promise<{ azureChanged: boolean }> {
  return inTurn(async () => {
    const wanted: WantedSettings = { ...extra };
    const azureChanged = wanted.azureKey !== undefined
      || (wanted.azureRegion !== undefined
          && wanted.azureRegion !== (settings.azureRegion || ""));
    settings = await writeSettings(wanted);
    renderSettings();
    return { azureChanged };
  });
}

/** Keeps the pairing the Azure panel was told to keep.
 *
 * `key` absent means "the stored one stands", which is what an untouched field
 * means on a page whose key lives in a placeholder - and this page can never
 * mean anything else by it, because the secret is not readable from here. So
 * the absence goes straight through to writeSettings(), where absent leaves
 * the stored key alone and `null` is the one explicit way to clear it. That
 * three-state seam is this repository's own and is what `forgetKey()` below
 * is the third state of. */
export const keepAzure = (next: AzureAsk): Promise<{ azureChanged: boolean }> =>
  saveSettings({
    azureRegion: next.region,
    ...(next.key ? { azureKey: next.key } : {}),
  });

/** Drops the stored key, as its own act.
 *
 * The empty field already means "leave the key alone" - the rule above - so
 * the field cannot double as the way to remove one. Until this existed it did
 * not merely fail to: there was no way to remove a key at all, because
 * writeSettings only ever set it. The region is left alone rather than
 * re-written, for the reason saveSettings() gives. */
export async function forgetKey(): Promise<void> {
  await saveSettings({ azureKey: null });
}
