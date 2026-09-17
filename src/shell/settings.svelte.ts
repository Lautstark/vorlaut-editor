// The Azure key and the METACOM folder live in .env, not in layout.json: they
// belong to this installation, not to the content. So they save through their
// own endpoint - and the key only from the machine itself, see the server.
//
// This is the lower half of the settings sheet. The sheet itself, and its one
// Save, are in voices.svelte.ts.
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
import type { Settings, WantedSettings } from "../core/types.js";
import { readSettings, writeSettings, azureState, listCollections }
  from "../backend/index.js";
import { applyTheme, readTheme, saveTheme, type Theme }
  from "@lautstark/design/theme";

import { LANG } from "../core/boot.js";
import { load } from "../core/save.js";
import { paintCollections } from "./collections.js";
import * as symbols from "../data/symbols.js";
import { exportEverything, importBackup, isBackup, TOO_NEW } from "../data/backup.js";
import { boardTotals, wipeEverything } from "../data/store.js";
import { adopt, adopted, refusal } from "./adopt.js";
import { backupPanel, type BackupPanel } from "@lautstark/sicherung/backup-panel";
import { wherePanel } from "@lautstark/sicherung/ablage-panel";
import { metacomPanel, type MetacomPanel } from "@lautstark/bildquelle/metacom-panel";
import { ablage, folderName, isStore, wipeReaches } from "../data/folder.js";
import { adoptFolder } from "../data/store.js";
import type { Sicherung } from "@lautstark/sicherung";
import { downloadJson } from "@lautstark/werkzeuge/download";

/* Held so a language switch can repaint it: the panel paints its own words and
   carries no data-i18n, so nothing that redraws the components can reach it. */
let keeping: BackupPanel | null = null;

/* $state.raw, and every record out of the backend below is the same. These
   come back from readSettings() and writeSettings() whole and are replaced
   whole; a deep proxy would buy nothing and would cost the thing wochenwerk's
   pilot found out the hard way - a proxied record is refused by
   structuredClone() and by IndexedDB, and this one is handed straight back to
   writeSettings(). */
let settings = $state.raw<Settings>({
  azureKey: { set: false, hint: "" }, azureRegion: "",
  metacom: { path: "", ok: false, count: 0, fixed: false },
  local: true });

/** What this installation is set to, as the sheet reads it. */
export const installed = (): Settings => settings;

/* --- what the three fields hold -------------------------------------------
 *
 * The sheet's two Azure fields and its METACOM path used to be read back off
 * the elements - `byId("azureRegion").value.trim()` inside the write - which
 * is the one place this file genuinely needed the DOM rather than merely using
 * it as a store. They are `bind:value` in the component and runes here, and
 * saveSettings() reads them at the moment the write happens exactly as it read
 * the elements at that moment. */
let region = $state("");
let key = $state("");
let path = $state("");

export const azureRegionField = (): string => region;
export const setAzureRegion = (value: string): void => { region = value; };
export const azureKeyField = (): string => key;
export const setAzureKey = (value: string): void => { key = value; };
export const metacomPathField = (): string => path;
export const setMetacomPath = (value: string): void => { path = value; };

// What a stored key looks like in the field: the four characters it ends in,
// behind enough dots to read as a secret. It is the placeholder and not the
// value, which is the point - the field stays empty, so it still means "leave
// the key alone" and there is nothing here to submit, copy or mistake for the
// key itself. Typing replaces it the way typing replaces any placeholder.
const MASK = "••••";

export function keyPlaceholder(): string {
  if (!settings.azureKey.set) return t("ui.azure_key_placeholder");
  // Away from the machine itself the last four are not handed over - see
  // settings_state() in app.py. Then the dots alone say a key is there.
  return MASK + (settings.azureKey.hint || MASK);
}

/* --- the sentences the sheet draws ---------------------------------------- */

/** The Azure panel's state line. Two answers in one place: "stored" describes
 *  this database, and the probe's answer describes whether Azure answers. The
 *  second replaces the first when it arrives - see probeAzure(). */
let azureLine = $state("");
export const azureState$ = (): string => azureLine;

/** The lines the two errand panels report into. Their own rather than the page
 *  status line, because they are the outcome of something pressed inside a
 *  panel and belong beside the button that was pressed. */
let dataLine = $state("");
let boardLine = $state("");
export const dataState = (): string => dataLine;
export const boardState = (): string => boardLine;
export const sayData = (line: string): void => { dataLine = line; };

/** What the shared METACOM panel last put in the symbols panel's summary.
 *
 * Held rather than read back off the element, because which source is being
 * searched wins that same line - and the two have to be able to swap back and
 * forth without either losing what the other knows. */
let folderHead = $state("");

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

/* The three shared panels, as the nodes they are. Vanilla by design - the
 * family's panels are built once and put in place by
 * @lautstark/design/svelte/Vanilla, a `display: contents` host - so what is
 * reactive is which node, never what is inside one. */
let storeNode = $state.raw<HTMLElement | null>(null);
let keepNode = $state.raw<HTMLElement | null>(null);
let metacomNode = $state.raw<HTMLElement | null>(null);
export const ablagePanel = (): HTMLElement | null => storeNode;
export const keepPanel = (): HTMLElement | null => keepNode;
export const symbolPanelNode = (): HTMLElement | null => metacomNode;
/** Only where there is no store folder: with one, the copies already go beside
 *  the work, and a second picker would be the same offer under a name that
 *  reads almost the same. */
let keepOffered = $state(true);
export const keepShown = (): boolean => keepOffered;

/* The rendering chooser. METACOM ships the same symbols several times over -
 * with and without a frame, with and without the word printed on the picture -
 * as parallel folders holding identical file names, and bildquelle derives the
 * list from the index rather than from any list of known folder names, because
 * a user's copy is theirs.
 *
 * Ordering only: nothing is filtered out, so a symbol that lives in just one
 * of them stays reachable, and a key that already holds a picture keeps it.
 * Only shown when the folder holds more than one - a copy pointed straight at
 * a single rendering has nothing to choose between, and an empty dropdown is
 * a question with one answer. */
export function renderings(): { segment: string; count: number }[] {
  folderState();
  return symbols.metacomReady() ? symbols.metacomRenderings() : [];
}

/** What one rendering is called, on the trigger and in the list. */
export function renderingLabel(segment: string | null): string {
  return segment === null
    ? t("ui.rendering_none")
    : t("ui.rendering_option",
        { segment, count: renderings().find((e) => e.segment === segment)?.count ?? 0 });
}

/** Told to the provider and written down, in that order: the provider ranks
 *  the next search by it, and without the second half the choice lasted
 *  exactly as long as the tab did. */
export function chooseRendering(chosen: string | null): void {
  symbols.preferRendering(chosen);
  void saveSettings({ metacomRendering: chosen });
  folderMoved += 1;
}

export const preferredRendering = (): string | null => {
  folderState();
  return symbols.preferredRendering() || null;
};

/* Which collection the picker offers, and the one control that changes it.
 *
 * Marked on both panels rather than only on the active one: a heading saying
 * "Aktive Quelle" tells you which is on, and a heading that says nothing tells
 * you the other is off only if you already knew that is what silence meant.
 * The button appears on the panel that is NOT active, because a button saying
 * "use this" on the thing already in use is a no-op somebody has to read
 * twice.
 *
 * METACOM cannot be chosen without a folder, so its button is absent then -
 * the panel above already says why, and readSettings() refuses the value.
 *
 * "Diese Quelle verwenden" survives adopting, and its job is narrower than it
 * was. It is no longer how a folder becomes the source - installing one does
 * that - and what is left is the move back: somebody with both set up who has
 * gone to ARASAAC for a symbol METACOM does not have, and wants METACOM again
 * without re-picking the folder. bildhaft's button stayed for the same case.
 * The ARASAAC one is the other half of it and never had another job. */
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

/* A folder that has just been installed becomes the source it is searched
 * through.
 *
 * Choosing a folder and then pressing "Diese Quelle verwenden" was two steps
 * for one intention: nobody goes and finds their licensed METACOM collection
 * in order to carry on rendering ARASAAC. bildhaft settled this the same way
 * and for the same reason.
 *
 * **metacomReady() and not merely "nothing was thrown".** A pick that produced
 * no usable index would switch the whole app onto an empty source, which
 * blanks every search result and reads as the collection having gone missing
 * rather than as the pick not having worked.
 *
 * **Adopting is asked for, never a side effect of a folder appearing.** This
 * is called from the two handlers where somebody went and found a folder, and
 * from nowhere else. Not from picker.ts's restoreMetacom(), which re-attaches
 * at boot to a folder chosen on an earlier visit: somebody may have a folder
 * set up and be deliberately using ARASAAC, and a page load must not overrule
 * that. Not from the permission re-confirm inside metacomChoose either - the
 * same folder coming back is a restore that Chromium happens to want a gesture
 * for, not a new answer to which source is active.
 *
 * Nothing here changes what a METACOM reference is. The folder is read where
 * it lies, no byte of it is copied or uploaded, and only one source is ever
 * active. See docs/symbol-search.md.
 */
async function adoptMetacom(): Promise<boolean> {
  if (!symbols.metacomReady()) return false;
  // Behind whatever the folder's arrival already set going. The provider's own
  // subscription fires a read on that same event, so `settings` here is still
  // the answer from before the folder existed - and it is read below to decide
  // whether there is anything to switch. Awaiting a read of our own is what
  // drains the queue: see inTurn().
  await loadSettings();
  if (activeSource() === "metacom") return false;
  await useSource("metacom");
  // Said out loud rather than left to be noticed: switching source changes
  // what every search from now on answers with, and the panel that would show
  // it is the one somebody is looking at rather than the sheet they will open
  // next. bildhaft says it through its own notifier for the same reason.
  //
  // Answered rather than only said, because the panel has a quieter sentence
  // of its own for the same press - see the say() it is passed. Both in the
  // one status line, so whichever is the bigger news has to win rather than
  // arrive first and be overwritten.
  status(t("ui.metacom_now_active"));
  return true;
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
const THEME_KEY = "vorlaut.theme";

export const themeLabel = (one: Theme): string => t(`ui.theme_${one}`);

/** Somebody pressed one of the three. This control and its heading, and
 *  nothing else: the tokens carry the scheme to everything else on the page,
 *  which is what tokens are for. */
export function chooseTheme(one: Theme): void {
  saveTheme(THEME_KEY, one);
  applyTheme(one);
  theme = one;
}

/** Read back off localStorage. Called when the sheet opens and after a
 *  language switch, which is the one that matters: a heading that keeps its old
 *  language while the body changes is worse than one that never changed. */
export function readThemeNow(): void {
  theme = readTheme(THEME_KEY);
}

/** The state line of every panel, re-read rather than remembered. Called when
 *  the sheet opens, after a save, and after a language switch. */
export function paintStates(): void {
  readThemeNow();
  // Base line first, then ask Azure - the same pair renderSettings() draws,
  // and in the same order. Setting only the base here is what broke the two
  // Azure tests: "stored" describes this database and would sit on top of the
  // probe's answer, which is the only line that describes whether the key
  // works. That answer is the whole reason azureState() exists.
  azureLine = settings.azureKey.set ? t("ui.azure_key_stored") : t("ui.azure_key_none");
  probeAzure();
  /* The two panels drawn by the module that owns their folder rather than from
     here. Neither carries a data-i18n, so nothing that redraws the components
     can reach either, and each paints its own words in whichever language it is
     asked for on the way past. There used to be one of these; §4.9's two folder
     questions are both packaged now. */
  keeping?.refresh();
  folder?.refresh();
  /* There was a second one, and the hook it registered through has gone with
   * it. onPaintPanels() let a panel wired outside this file ask to be redrawn
   * on a language switch, and existed because the Device panel belonged to
   * editor-diy while the shell may not import that. The Device panel is gone -
   * the transfer dialog grants a port where it needs one - so the list had no
   * registrant left, and a registry nothing registers with is an extension
   * point that reads as working code. */
}

/* --------------------------------------- the folder this browser can read ---
 *
 * Two folders, briefly, and the panel says so rather than pretending
 * otherwise. Searching happens in the browser now and reads the folder chosen
 * here; the build still runs in Python and reads the path in the field above.
 * They are the same collection in every sane setup - a metacom: reference is
 * a file name, so the two agree as long as both point at a METACOM - and when
 * the build moves into the browser the field above goes and this is all that
 * is left.
 *
 * Nothing here uploads, copies or stores a symbol. The folder is read where it
 * lies; see docs/symbol-search.md.
 */

/** The shared block, held so a language switch can repaint it. */
let folder: MetacomPanel | null = null;

/* Whether the press now running was a re-confirm rather than a pick.
 *
 * The module merges "choose a folder" and "confirm access" into one button -
 * one press, three labels - and tells `after()` only that a `choose` happened.
 * This repository has to keep the two apart, because adoptMetacom() must not
 * fire on a re-confirm: the same folder coming back is a restore, not a new
 * answer to which source somebody wants searched.
 *
 * Sampled in the capture phase, before the module's own click handler runs,
 * because that handler is what changes the status this asks about - by the time
 * after() is called the answer has already moved. */
let reconfirming = false;

/** Whether after() has already put a sentence in the status line for this press.
 *
 * Read by the panel's say(), which runs straight afterwards and would otherwise
 * overwrite the louder of the two with the quieter one. */
let announced = false;

/** The summary line of the symbols panel.
 *
 * Two things want to say something there and only one can. Which source is
 * active wins, because that is the fact a reader of a folded sheet is looking
 * for; the folder's own state is what the panel says when METACOM is set up and
 * not being searched.
 *
 * The module leaves the heading blank where there is nothing to report - a
 * folder that was never chosen - and this page fills that with its own "not
 * set", because every other panel on this sheet states something in its
 * summary and a blank one reads as a panel that failed to draw. */
export function symbolsSummary(): string {
  return activeSource() === "metacom"
    ? t("ui.source_active")
    : (folderHead || t("ui.metacom_short_none"));
}

/* Where the symbols come from, for the one line that still asks: the note under
 * the build path. It used to answer twice over, once short for the panel's
 * summary, and that half is the shared panel's headline now.
 *
 * **The index kind has gone with it, and it was dead text rather than a
 * setting.** This line used to end with a second clause naming how the folder
 * had been indexed - with a keyword table, or by file name only - chosen from
 * `settings.metacom.keywords`. Every writer of that field wrote the literal
 * `false`, so one of the two answers could not be printed and the other was
 * printed unconditionally. bildquelle's shared panel leaves the whole item out
 * for the same reason and says so in its header; conventions.md §4.13 records
 * it as a hole rather than a decision. */
export function metacomWord(): string {
  // Handed in from outside - the container. The path in the field is the one
  // inside it, a host path typed here could not take effect, and the write
  // would land in the .env that the mount is read from.
  if (settings.metacom.fixed) return t("ui.metacom_fixed");
  const where = settings.metacom;
  // The folder is there and one click re-confirms it - a different sentence
  // from "not set" and from "unreadable", because the remedy is different.
  folderState();
  const state = symbols.metacomStatus();
  if (state.kind === "needs-setup" && state.code === "permission-needed") {
    return t("ui.metacom_needs_access");
  }
  if (!where.path) return t("ui.metacom_none");
  if (!where.ok) return t("ui.metacom_bad");
  return t("ui.metacom_ok", { count: where.count });
}

/** Replaces "stored" with whether the key actually works, asynchronously.
 *
 * "stored" is a statement about this database; the person who typed a key
 * wants to know whether Azure answers. A wrong region used to cost the Azure
 * rows in silence - the fetch fails before any status exists, listVoices()
 * keeps the piper voices alive by swallowing it, and nothing anywhere said
 * why the list looked exactly as if no key had been typed. */
function probeAzure(): void {
  if (!settings.azureKey.set || !settings.azureRegion) return;
  azureLine = t("ui.azure_checking");
  void azureState().then((state) => {
    if (!state.configured) return;
    azureLine = state.ok
      ? t("ui.azure_ok", { count: state.count })
      : t(state.code === "unreachable" ? "ui.azure_unreachable"
        : state.code === "refused" ? "ui.azure_refused" : "ui.azure_probe_failed");
  });
}

/** What a read or a write leaves on screen: the three fields put back to what
 *  is stored, and the sentences that describe it.
 *
 * The key is never sent back to the page, so the field starts empty and means
 * "leave it alone" until somebody types in it. */
function renderSettings(): void {
  region = settings.azureRegion || "";
  path = settings.metacom.path || "";
  key = "";
  azureLine = settings.azureKey.set ? t("ui.azure_key_stored") : t("ui.azure_key_none");
  probeAzure();
  // A folder that was set and cannot be read is the one state worth unfolding
  // for: somebody meant to configure this and it is not working.
  if (settings.metacom.path && !settings.metacom.ok) unfoldSymbols();
  folderMoved += 1;
  folder?.refresh();
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
  /* The store panel comes from the package, so every Lautstark programme shows
     the same one. What stays here is what vorlaut alone offers besides it. */
  const store = wherePanel({
    store: ablage,
    adopt: adoptFolder,
    changed: () => { location.reload(); },
    say: (line) => { dataLine = line; },
    lang: LANG === "en" ? "en" : "de",
  });
  storeNode = store.node;
  if (isStore()) {
    keepOffered = false;
  } else {
    /* The 170 lines this replaces are @lautstark/sicherung/backup-panel's now.
       `lang` is a function because LANG here is a live binding that moves when
       the page changes language without reloading. */
    keeping = backupPanel({
      backup,
      say: (message) => { dataLine = message; },
      lang: () => (LANG === "en" ? "en" : "de"),
    });
    keepNode = keeping ? keeping.node : null;
    keepOffered = !!keeping;
  }
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
  /* The 70 lines this replaces are @lautstark/bildquelle/metacom-panel's now:
     the licence paragraph, the link to the shop, the state line and its dot,
     and the four acts. What is left here is the three things the module leaves
     to a product on purpose - which source is now active, what a language
     switch has to repaint, and this page's own word for a folder nobody has
     chosen. See the module's header for why each of those stayed.

     `lang` is a function because LANG is a live binding that moves when the
     page changes language without reloading - the same reason backupPanel()
     above is passed one. */
  folder = metacomPanel({
    metacom: symbols.metacomProvider,
    /* All four, including the one this repository did not have. `readMetacomZip`
       had been sitting in data/symbols.ts since the search moved into the
       browser with no caller at all - the wiring was built and never hung on a
       button, which conventions.md §4.13 records as a hole rather than a
       decision. bildhaft and wochenwerk both offer it. */
    actions: ["choose", "zip", "reread", "forget"],
    lang: () => (LANG === "en" ? "en" : "de"),
    headline: (text) => { folderHead = text; },
    say: (line) => {
      /* The module's own sentence, unless after() has already put a bigger one
         in the same status line. Switching source is the bigger one: it changes
         what every search from now on answers with, where "folder read" only
         says the press worked. after() runs first and this would overwrite it,
         so it has to ask rather than assume - and when nothing was switched,
         which is every press on a folder that is already the active source,
         this is the only confirmation there is. */
      if (!announced) status(line);
    },
    after: async (action) => {
      announced = false;
      if (action === "forget") {
        // Forgetting the folder cannot leave METACOM as the source: the picker
        // would have nothing to search and would say so on every keystroke. The
        // fallback is written down rather than left to readSettings() to infer
        // on the next visit, so the answer is the same before and after a
        // reload.
        if (activeSource() === "metacom") {
          symbols.setActiveSource("arasaac");
          await saveSettings({ activeProvider: "arasaac" });
        }
        return;
      }
      // A re-confirm is a restore, and a restore does not decide which source
      // is active. See adoptMetacom() and `reconfirming` above.
      if (action === "choose" && reconfirming) return;
      if (action === "choose" || action === "zip") announced = await adoptMetacom();
    },
  });
  metacomNode = folder.node;
  folder.node.addEventListener("click", () => {
    const state = symbols.metacomStatus();
    reconfirming = state.kind === "needs-setup" && state.code === "permission-needed";
  }, true);

  // The provider says when a folder arrives or goes; nothing here polls.
  //
  // The whole sheet and not just this panel. A folder arriving changes more
  // than the line that names it: whether METACOM can be the active source is
  // derived from whether it answers, so the panel was still drawing the answer
  // from before - and the one control that chooses METACOM stayed hidden on the
  // panel that had just become choosable.
  symbols.subscribeMetacom(() => void loadSettings());
}

/* One settings errand at a time, in the order they were asked for.
 *
 * Reading and writing both end by putting a value into `settings` and into
 * symbols.setActiveSource(), and both are asynchronous. The provider's
 * subscription fires a read the moment a folder finishes indexing, and
 * adoptMetacom() writes on the back of that same arrival - so a read that
 * started before the write resolved after it and put the source it had found
 * back over the one that had just been chosen. What that looked like: the
 * folder installed, the switch announced in the header, the button gone, and
 * the picker still searching ARASAAC. Nothing was wrong in storage, which is
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

/** Writes what the sheet's fields hold.
 *
 * `extra` is for the settings that are not fields - the rendering preference
 * is a menu that acts on change, not something read back off the form when
 * some other panel is saved. It merges in last so a caller saying nothing
 * about a setting leaves it alone. */
export async function saveSettings(
  extra: Partial<WantedSettings> = {},
): Promise<{ azureChanged: boolean }> {
  return inTurn(async () => {
    // The fields are read inside the turn rather than as this is called, so
    // that what is written is what they hold when the write actually happens.
    const wanted: WantedSettings = {
      azureRegion: region.trim(),
      metacom: path.trim(),
      ...extra,
    };
    // Only when something was typed: an untouched field must not wipe the key.
    const typed = key.trim();
    if (typed) wanted.azureKey = typed;
    const azureChanged = !!typed || wanted.azureRegion !== (settings.azureRegion || "");
    settings = await writeSettings(wanted);
    renderSettings();
    return { azureChanged };
  });
}

/** Drops the stored key, as its own act.
 *
 * The empty field already means "leave the key alone" - the guard above - so
 * the field cannot double as the way to remove one. Until this existed it did
 * not merely fail to: there was no way to remove a key at all, because
 * writeSettings only ever set it. The region and the METACOM path ride along
 * exactly as a save would take them; the null is the whole difference. */
export async function forgetKey(): Promise<void> {
  return inTurn(async () => {
    settings = await writeSettings({
      azureRegion: region.trim(),
      metacom: path.trim(),
      azureKey: null,
    });
    renderSettings();
  });
}
