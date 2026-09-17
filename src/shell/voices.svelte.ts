// The chosen voice stands in layout.json next to the language and is saved
// with everything else. What can be spoken with here is a different question,
// answered on every open: a key entered in the meantime, or a model that has
// arrived, should show up without reloading the page.
//
// **Those two questions are on two different sheets.** Which voice this
// Sammlung speaks in is behind that Sammlung's own ⋯, beside the language of
// the device it is built for; which voices this machine has at all - the Azure
// key, the offer to fetch the offline ones - stayed in Einstellungen. The
// argument is docs/sammlung-settings.md, and the short version is that a
// download installs a voice for every Sammlung there is while a choice binds
// exactly one, so a single panel was two scopes wearing one heading.
//
// This file still owns both openers, and that is not a leftover. The voice
// catalogue is the one thing both sheets need loaded before they can say
// anything true - the Sammlung's to draw the list, Einstellungen to count what
// is here - so the module that fetches it is the one that opens them. The
// Azure and METACOM panels inside Einstellungen are settings.svelte.ts, which
// this calls into.
//
// **What moved on 2026-09-16 is the drawing.** Every render* and paint* below
// wrote into an element it had found by id, in markup that lived in a template
// two directories away. What is left is the state and the errands; the sheets
// are shell/SettingsSheet.svelte and shell/CollectionSheet.svelte, and each
// panel's words are read where the panel is drawn. adr/0025.
import type { OfferedVoice, VoiceList } from "../core/types.js";
import { status } from "./dom.js";
import { languagePicker, type LanguagePicker } from "@lautstark/design/language";
import type { Pickable } from "@lautstark/stimmquelle/voice-picker";
import { reason } from "../core/errors.js";
import { listVoices, voiceFetchState, startVoiceFetch } from "../backend/index.js";
import { LANG, LANGUAGE_NAMES, LANGUAGES, rememberLanguage, setLanguage }
  from "../core/boot.js";
import { DEFAULT_LANGUAGE } from "../core/boot_data.js";
import { state } from "../core/state.js";
import { isApp } from "../core/types.js";
import { applyTexts } from "../core/texts.js";
import { save } from "../core/save.js";
import * as symbols from "../data/symbols.js";
import { offeredSource } from "./picker.js";
import { editor } from "../core/editor.js";
import { speak } from "./speech.js";
/* `t` from here rather than from core/texts.ts, for the reason
 * settings.svelte.ts gives at its own import: what this module answers with is
 * drawn, and a state line has to move when the page changes language. */
import { layout as live, relanguaged, t, touched, words } from "./live.svelte.js";
import { forgetKey, loadSettings, paintStates, saveSettings } from "./settings.svelte.js";
import type { Component } from "svelte";

/** Every panel in the settings sheet, in the order SettingsSheet.svelte writes
 *  them. Used to fold them all on open - see openSettings() - and exported so
 *  tests/unit/settings_panels.test.ts can hold it against the markup, which is
 *  the drift that made this list necessary. */
export const PANELS = [
  "languagePanel", "themePanel", "voicesHerePanel", "azurePanel",
  "arasaacPanel", "symbolsPanel", "boardPanel", "dataPanel", "dangerPanel",
] as const;

/** The one panel the sheet loads with open - SettingsSheet.svelte marks it so.
 *  Reopened after the fold below, because "folded again on every open" means
 *  back to how the sheet loads and not all-closed: e2e/theme.spec.ts leans on
 *  Sprache being open to show the accordion working at all. */
export const OPENS_WITH = "languagePanel";

/* $state.raw for the same reason settings.svelte.ts's record is: this comes
   back from the seam whole and is replaced whole, and a deep proxy would cost
   the one thing wochenwerk's pilot warned the next product about. */
let voices = $state.raw<VoiceList>({
  voices: [], active: "", chosen: "", chosenLabel: "", backend: "",
});
// Nothing is "pending" on this sheet any more. What is ticked IS what stands
// in layout.json, because choosing writes - so voices.chosen is the single
// answer to "which voice", and the gap that used to be held open between
// opening the sheet and pressing Save no longer exists.

// About 130 MB, so the server downloads in the background and is asked how far
// it has got. Polling rather than a held-open request: this server answers one
// request per thread, and the interface should stay usable meanwhile.
let fetching = $state.raw({ running: false, done: 0, total: 0, name: "", error: "",
                            missing: 0 });
let fetchDone = $state(false);   // finished in this dialog - worth saying so

// One loop at a time: closing the dialog does not stop it, so opening it again
// would otherwise leave two of them polling and rendering over each other.
let polling = false;

/* The list itself is @lautstark/stimmquelle/svelte/VoicePicker, drawn by
 * CollectionSheet.svelte.
 *
 * How the list narrows is the component's - the search field, the language
 * pills, and what a row matches on. So is where the keyboard is standing,
 * which is the half this repository never had: with an Azure key the list runs
 * to several hundred plain buttons, and Tab walked every one of them to reach
 * the panel underneath, which is the very thing the search field was added to
 * prevent. The `refresh()` and `dispose()` calls that used to be spread over
 * this file went with the builder - the repaint follows `voices` because it is
 * a rune, and the teardown is the component's own §6.8 `$effect`.
 *
 * False until openCollectionSettings() has a catalogue, and back to false on
 * the way into every open rather than left standing. Two things ride on that
 * and both were the node's job before: the list must not show the last
 * Sammlung's tick while this one's catalogue is still arriving, and the search
 * text and the language pill are the component's own state with no way in from
 * out here - so this sheet narrows itself back on every open for the reason its
 * panels fold back. A fresh mount is the whole of that reset.
 */
let pickerUp = $state(false);
export const voiceListShown = (): boolean => pickerUp;

/** The catalogue, in the shape the picker reads it in. Read on every paint
 *  rather than handed over once, which is what lets a key saved in
 *  Einstellungen, or a download that has just finished, show up here without
 *  the sheet being closed and opened again. */
export const pickableVoices = (): Pickable[] => voices.voices.map(pickable);

/** Which one is ticked. An empty entry in layout.json means "whatever works
 *  here", and that is the normal case for a fresh Sammlung. It is not offered
 *  as a row of its own - "Automatic" tells nobody anything - so the voice it
 *  comes out as stands marked instead, and voiceNotes() says nobody picked it. */
export const tickedVoice = (): string => voices.chosen || voices.active;

/** The name for a voice the layout still holds and this machine cannot offer.
 *  Worked out by the backend, because that is where the naming rules are;
 *  without it the row would be labelled with the id, and an id is
 *  `azure:de-DE-KatjaNeural`. */
export const chosenVoiceName = (): string => voices.chosenLabel;

/** The one thing this product has to say about a row that the catalogue does
 *  not: a voice that is in force without anybody having chosen it. Only this
 *  Sammlung's storage makes that distinction, which is why it is a hook rather
 *  than something the component could work out. */
export const voiceNotes = (voice: Pickable): string[] =>
  (!voices.chosen && voice.id === voices.active ? [t("ui.voice_auto_note")] : []);

/** A sample, in the voice the row is about.
 *
 * No progress to report: synthesise() answers with a finished blob and says
 * nothing on the way, so the button stays on the component's "…" for as long
 * as this takes. No button handed over either: the component owns this one and
 * is already labelling and disabling it, and two writers of one label is how a
 * button ends up stuck saying "…". */
export const hearVoice = (voice: Pickable): Promise<void> =>
  speak(sampleText(), null, voice.id);

async function loadVoices(): Promise<void> {
  try {
    voices = await listVoices();
  } catch (error) {
    status(t("ui.voice_failed", { error: reason(error) }));
  }
}

// What a voice is tried out on: a sentence off the board being worked on, so
// one hears the actual content rather than a specimen. Which sentence is the
// editor's answer - it is the one that knows where somebody is standing - and
// only if it has none does the specimen step in.
function sampleText(): string {
  return editor().sample() || t("ui.voice_sample");
}

/* One offered voice, in the shape the picker reads it in.
 *
 * A mapping rather than a rename of OfferedVoice, because the disagreement is
 * only in spelling and the seam's spelling is the one the backend answers in:
 * `label` where the package says `name`, `language` where it says `locale`.
 *
 * `quality` is the one field that is not a rename. This repository's seam
 * publishes it as a string and writes the empty one wherever a backend names
 * no tier at all, which is every cloud voice; the package's `Quality` is the
 * four codes with *absent* standing for the same thing. An empty string is not
 * one of the four, so it becomes undefined here - otherwise labelOf() would
 * see a tier where there is none and print "Katja ()" the moment a second
 * Katja arrived.
 */
function pickable(voice: OfferedVoice): Pickable {
  return {
    id: voice.id,
    name: voice.label,
    locale: voice.language,
    gender: voice.gender,
    quality: (voice.quality || undefined) as Pickable["quality"],
    source: voice.source,
    downloadBytes: voice.downloadBytes,
    needsKey: voice.needsKey,
    rushesFragments: voice.rushesFragments,
  };
}

/* Who renders it. Not the model's name or the vendor's product name: what
 * somebody choosing is deciding is whether it is already here or has to be
 * fetched from a company. */
function sourceOf(source: string): string {
  // Empty is not a backend, and the one row that has none is the voice that
  // is chosen but not here: it must not claim to be bundled while saying in
  // the same line that it cannot be found.
  if (!source) return "";
  return t(source === "azure" ? "ui.source_azure"
         : source === "system" ? "ui.source_system" : "ui.source_piper");
}

/* What it speaks, named in the language of whoever is reading.
 *
 * Still here after the rows went, because the panel's folded heading says it
 * too and that line is this repository's own. The module has the same
 * expression for the rows it draws; two copies of one Intl call is cheaper
 * than a package exporting its furniture so a summary can borrow a word. */
function speaks(code: string): string {
  const tag = (code || "").replaceAll("_", "-");
  if (!tag) return "";
  try {
    return new Intl.DisplayNames([LANG], { type: "language" }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}

/* --- what the two sheets read ------------------------------------------- */

/** Whether anything at all can speak here. The list is hidden rather than left
 *  to say "no voice matches that": a search field above an empty list is an
 *  invitation to type at a machine that has nothing to find. The module draws
 *  that sentence for a filter that matched nothing, which is a different fact
 *  and the only one it can know. */
export const haveVoices = (): boolean => voices.voices.length > 0;

/** The voice panel's heading, folded: which voice, and the two facts that say
 *  what kind of thing it is. Folded up this line is the whole answer to what
 *  the panel is asked nine times out of ten - not "which voices are there" but
 *  "which one is it speaking in". */
export function voiceState(): string {
  const id = voices.chosen || voices.active;
  const voice = voices.voices.find((v) => v.id === id);
  // The same name the row below uses when the voice is not here. Falling back
  // to the id put `azure:de-DE-KatjaNeural` in the one line that is the whole
  // answer nine times out of ten.
  return voice
    ? [voice.label, sourceOf(voice.source), speaks(voice.language)].filter(Boolean).join(" · ")
    : voices.chosenLabel || id || t("ui.voice_state_none");
}

/** The standing rule, whether or not anything was just ticked: a voice is part
 *  of what every sentence is spoken with, so changing it re-records all of them
 *  rather than only the ones edited afterwards. With nothing to choose between,
 *  where to go instead - which is the whole of the round trip the split costs. */
export const voiceHint = (): string =>
  haveVoices() ? t("ui.voice_rebuild") : t("ui.voice_none_where");

/** Not the module's "no voice matches that": this is a machine with nothing to
 *  choose between at all, and what to do about it is this product's. */
export const voiceEmpty = (): string => haveVoices() ? "" : t("ui.voice_none");

/* The Einstellungen half: what this machine can speak with at all.
 *
 * Three lines and no choosing. The count in the heading is what somebody
 * opening this panel is asking - "is there anything here" - and it is the
 * number of rows the other sheet would draw, so the two cannot disagree about
 * how many voices exist. The offer below it appears only when something is
 * actually missing. */
export const voicesHereState = (): string => voices.voices.length
  ? t("ui.voices_here_count", { n: voices.voices.length })
  : t("ui.voices_here_none");

/** Whether there is anything left to fetch. A button offering to fetch nothing
 *  is worse than no button. */
export const somethingMissing = (): boolean => fetching.missing > 0;
export const fetchRunning = (): boolean => fetching.running;

// What the hint line says while a download runs, or "" when it has nothing
// to add and the usual note applies.
export function fetchNote(): string {
  if (fetching.error) return fetching.error;
  if (fetching.running) {
    return t("ui.voice_fetching", {
      name: fetching.name,
      done: fetching.done + 1,
      total: fetching.total,
    });
  }
  return fetchDone ? t("ui.voice_fetch_done") : "";
}

async function readFetch(): Promise<void> {
  try {
    fetching = await voiceFetchState();
  } catch (error) {
    fetching = { running: false, done: 0, total: 0, name: "",
                 error: reason(error), missing: 0 };
  }
}

export async function startFetch(): Promise<void> {
  fetchDone = false;
  try {
    await startVoiceFetch();
  } catch (error) {
    fetching = { ...fetching, error: reason(error) };
    return;
  }
  await readFetch();
  pollFetch();
}

// Stops by itself when the download is over. Two seconds is plenty: this is
// minutes of downloading, not milliseconds.
function pollFetch(): void {
  if (polling) return;
  polling = true;
  setTimeout(async () => {
    polling = false;
    await readFetch();
    if (fetching.running) {
      pollFetch();
      return;
    }
    fetchDone = !fetching.error;
    // The voices themselves have to be asked for again - the list was empty
    // when the dialog opened.
    await loadVoices();
  }, 2000);
}

// Ticks a row and writes it. There is no Save on this sheet any more, and a
// voice is no more dangerous than the text on a key - both are edits to the
// same layout, and that layout has been saving itself on a debounce for as
// long as it has existed. What a voice change costs is said where it is
// decided rather than guarded by a button: the hint under the list is the
// standing note that every recording is spoken again on the next release.
//
// An arrow key reaches this too, now that the list is a radio group somebody
// can walk. That is the same act as a click and is written the same way: in a
// group of radios the arrows move the answer rather than only the focus, and a
// keyboard that ticked without writing would be the one input on this sheet
// whose choice did not survive closing it.
export async function chooseVoice(id: string): Promise<void> {
  if (id === voices.chosen) return;
  state.layout.voice = id;
  voices = { ...voices, chosen: id };
  await save();
}

/* The one Save left, and it belongs to the Azure panel rather than the sheet.
 *
 * A key is the one field here that cannot be written as it is typed: half a
 * key is not a key, and the empty field has to keep meaning "leave the stored
 * one alone" rather than "drop it" - dropping it is the button beside this.
 *
 * The sheet stays open afterwards, and that was true before this was a panel
 * button: the whole point of the errand is to change where voices come from,
 * so the refreshed list and the panel's own state line are the answer, and
 * they are on the screen the question was asked from. */
export async function saveAzure(): Promise<void> {
  let azureChanged = false;
  try {
    ({ azureChanged } = await saveSettings());
  } catch (error) {
    status(t("ui.save_failed", { error: reason(error) }));
    return;                       // stay open, the message is in the header
  }
  // A key that has just arrived can mean Azure voices that were not there
  // when the sheet opened - and one that has just been corrected can mean
  // rows that were missing come back.
  if (azureChanged) await loadVoices();
  // No paintStates() here: saveSettings() has already run its own repaint,
  // which sets the Azure line and starts the probe that replaces it. Painting
  // again would put "stored" back on top of the probe's answer.
  status(t("ui.settings_saved"));
}

// Removing the key is the same shape of errand as saving one: the list it
// feeds is on this sheet, so the sheet stays open and the Azure rows leave
// in front of the person who asked.
export async function forgetAzureKey(): Promise<void> {
  try {
    await forgetKey();
  } catch (error) {
    status(t("ui.save_failed", { error: reason(error) }));
    return;                       // stay open, the message is in the header
  }
  await loadVoices();
  status(t("ui.azure_key_removed"));
}

/* Switching this page's language in place, which is what lets this sheet have
 * no Save.
 *
 * It used to be a reload, and the reload was the reason for the Save: a page
 * that reloads on `change` throws away whatever is half-typed in the Azure
 * field two panels down. Nothing has to reload now - boot.ts holds both
 * tables, setLanguage() moves the two live bindings every label is read
 * through, and everything below re-reads them.
 *
 * This language is the reader's and this installation's. It used to write
 * `state.layout.language` on the same keystroke, and that one line was two
 * choices held in one hand: a carer whose page is German could not build an
 * English talker without turning their own page English, and opening a
 * Sammlung built for an English device re-languaged the editor around them.
 * The device's language is chooseCollectionLanguage() below, and nothing here
 * touches the layout - so there is nothing to save either. */
async function chooseLanguage(code: string): Promise<void> {
  if (!code || code === LANG) return;
  setLanguage(code);
  document.documentElement.lang = code;
  // Kept for the next visit. In localStorage beside the scheme rather than in
  // the layout beside the voice, which is where it used to end up - see the
  // note on CHOICE in boot.ts.
  rememberLanguage(code);
  /* Every component that draws a word, told that the table underneath it has
     moved. This was applyTexts() naming a hundred elements; what is left of
     that function is the editor's own labels hook and the <html lang>, and one
     line here is the whole of the rest. */
  relanguaged();
  applyTexts();
  // The trigger names the language in force, and that name is ours to keep.
  languageRow?.refresh();
  paintStates();
  editor().render();
}

/* The other language: the one the device shows its own menu in.
 *
 * A property of this Sammlung rather than of this browser, so it is written to
 * the layout and saved the way every other edit to a layout is saved - it
 * travels in an export, layout_format.ts puts it in the byte the firmware
 * indexes its menu by, and on a tablet package it is what localeFor() falls
 * back to when the chosen voice does not name a language.
 *
 * Nothing on this page changes language here, which is the whole point of the
 * split: only the two controls that name this Sammlung's answer are redrawn. */
export async function chooseCollectionLanguage(code: string): Promise<void> {
  if (!code || code === state.layout.language) return;
  state.layout.language = code;
  paintCollectionLanguage();
  await save();
  // This language is what picks this Sammlung's voice while nobody has picked
  // one, so the answer to "which voice, if nothing was said" has just moved.
  // Asked again rather than worked out here: which voice a language starts on
  // is the catalogue's question and backend/local.js is where the catalogue
  // is. A voice somebody ticked does not move - that one is `chosen`, and only
  // `active` is a guess. After the save, because the answer is read off the
  // stored layout rather than off this one.
  await loadVoices();
}

/** The page's own language picker, built once and kept.
 *
 * It used to be rebuilt from scratch on every repaint, which a hand-written
 * row can afford; the module hands back the row plus a refresh() that moves
 * the pressed button, so what has to be held is the handle rather than the
 * element. */
let languageRow: LanguagePicker | null = null;
let languageNode = $state.raw<HTMLElement | null>(null);
export const languagePickerNode = (): HTMLElement | null => languageNode;

/** The two places the page's own language is named as a word: the state line
 *  in its panel, and - one sheet along - the Sammlung's. Read off LANG rather
 *  than remembered, and out of LANGUAGE_NAMES rather than the text table,
 *  because "Deutsch" is "Deutsch" whichever way the page is set. */
export function pageLanguageName(): string {
  // The one answer here that is not a lookup in the table and still has to move
  // when the page does: a language is named in its own word, so LANGUAGE_NAMES
  // is what is read and words() is the note that the page has changed.
  words();
  return LANGUAGE_NAMES[LANG] || LANG;
}

/** The same for the Sammlung's own language.
 *
 * Read off the layout on every call rather than remembered, because the layout
 * underneath it changes without anybody touching this panel - switching
 * Sammlung and importing a board both replace it, and save.ts calls
 * paintCollectionLanguage() for exactly that reason. A blank is a Sammlung
 * written before the field existed; it is shown as the page's default rather
 * than as an empty button, which is what layout_format.ts and localeFor() both
 * make of it. */
export function collectionLanguageName(): string {
  return LANGUAGE_NAMES[collectionLanguageCode()] || collectionLanguageCode();
}

/* Through shell/live.svelte.ts rather than straight off core/state.ts, and
 * every reader below does the same. They are the same object either way - what
 * the wrapper adds is that a component asking the question is redrawn when
 * paintCollectionLanguage() says the layout has moved, which is what
 * core/save.ts calls at every arrival. */
export const collectionLanguageCode = (): string =>
  live().language || DEFAULT_LANGUAGE;

/** A layout arrived, or its language moved. Called by core/save.ts at every
 *  arrival rather than only at load, because the sheet can be open while a
 *  layout is replaced - importing a board is a button inside it.
 *
 *  One line now: the two controls read the layout, and this is the note that
 *  the layout moved. */
export function paintCollectionLanguage(): void {
  touched();
}

export function wireLanguage(): void {
  /* Built here and handed to the component, which puts it in place through a
     `display: contents` host - the same arrangement the four shared vanilla
     panels get. It used to *replace* an empty <div id="langPick">, id and all,
     so that the row in the document was the module's element rather than
     something wrapped around it; the host makes that true without the swap,
     because a `display: contents` box is not in the layout at all. */
  languageRow = languagePicker({
    languages: LANGUAGES,
    // Read on every refresh() and never captured: LANG is a live binding and
    // a copy taken here would freeze the mark on whatever the page opened in.
    current: () => LANG,
    choose: (code) => void chooseLanguage(code),
    /* The one label on this page that is not translated, and the argument is
       the module's own argument for shipping endonyms: this is the control
       somebody reaches for when they cannot read the interface around it, so
       it must not depend on being able to read the interface around it. A
       group named "Language" is no use to a reader stranded in the German
       build, and one named the other way is no use in the English one. So the
       string is fixed and says both, and it is passed in from here because
       naming a group is the product's business. */
    label: "Sprache / Language",
    /* The product's table wins where it has an entry. The module ships the
       same two names today, so this changes nothing on screen; what it stops
       is the day boot_data.ts learns a third language and the row shows a
       two-letter code beside a heading that has the name. */
    names: LANGUAGE_NAMES,
  });
  /* The id goes on the module's own element rather than on anything around
     it. e2e/pickers.spec.ts asks `#langPick` for its tag name, its role and
     its accessible name, and all three are the segmented row's - a wrapper
     wearing the id would answer for a box instead of for the control. */
  languageRow.node.id = "langPick";
  languageNode = languageRow.node;
}

/** The languages a Sammlung's device menu can be built in, for the menu behind
 *  the button that names the one in force. The Sammlung's stays a button and a
 *  menu, and the difference from the page's segmented row is not oversight:
 *  this one is not a preference of whoever is reading. It is a property of the
 *  Sammlung, it travels in an export and it ends up in the byte the firmware
 *  indexes its menu by. Two controls that look identical would invite the
 *  reading that they are the same kind of choice. */
export const deviceLanguages = (): { code: string; name: string }[] =>
  LANGUAGES.map((code) => ({ code, name: LANGUAGE_NAMES[code] || code }));

/* --- the two sheets, opened ---------------------------------------------- */

let settingsUp = $state(false);
let collectionUp = $state(false);
/* Bumped on every open. The component folds its panels back when it moves -
 * see openSettings() for why that is the rule - and a counter rather than the
 * flag above because a sheet closed and opened again is two folds. */
let folds = $state(0);
/* The same, for the Sammlung's sheet, and it does more than fold: the panels an
 * editor registers are *destroyed and built again* on it. See
 * openCollectionSettings(). */
let opens = $state(0);

export const settingsOpen = (): boolean => settingsUp;
export const collectionSheetOpen = (): boolean => collectionUp;
export const foldEpoch = (): number => folds;
/** Bumped on every open of the Sammlung's sheet, and the components an editor
 *  registered are rebuilt on it - see openCollectionSettings(). */
export const collectionEpoch = (): number => opens;
export const closeSettings = (): void => { settingsUp = false; };
export const closeCollectionSettings = (): void => { collectionUp = false; };

/** Einstellungen, at the foot of the sidebar: what this browser and this
 *  installation are set to, and nothing that belongs to one Sammlung.
 *
 * It still asks for the voices, which is the one thing that looks left over
 * and is not: the panel that says how many can speak here counts them, and
 * saving an Azure key is judged by whether the list changed.
 */
export async function openSettings(): Promise<void> {
  fetchDone = false;
  // Folded again on every open. Somebody who unfolded one last time was after
  // a single thing in it, not after a preference. The headings say what is
  // inside, so nothing is hidden by folding them - and loadSettings() below
  // unfolds the symbols panel again if what is in there is broken.
  folds += 1;
  settingsUp = true;
  await Promise.all([loadVoices(), readFetch(), loadSettings()]);
  languageRow?.refresh();
  paintStates();
  // A download started before this dialog was opened - in another tab, or
  // before a reload - still has something to report.
  if (fetching.running) pollFetch();
}

/** The panel in that sheet which is the editor on screen's, if it has one.
 *
 * The tablet's grid is a setting of one Sammlung by every test this sheet
 * applies - it is written to layout.json, it travels in an export, and its
 * answer changes when a different row in the list is clicked - so it belongs
 * on this sheet. What kept it out was the layer: counting the buttons a
 * smaller grid would throw away is editor-app/pages.ts's work, and the shell
 * may not import an editor (tests/unit/layers.test.ts). So the editor hands
 * its panel in, the same way it hands entries to the menu beside the name
 * through collectionMenuExtras().
 *
 * **A component and two questions, where it used to be a build function and a
 * callback to write the heading with.** The build was called afresh on every
 * open so that a pending choice never survived a close and the words were read
 * out of the current language; a component mounted when the sheet opens and
 * unmounted when it closes is that, said once. The heading is two functions
 * rather than a callback for the same reason it was a callback: only the
 * editor can say what its panel is called and what it is set to - both are
 * read off the layout, which is why they are questions and not strings.
 *
 * Registered by an editor's wire() and taken back by its teardown, for the
 * reason collectionMenuExtras() gives: the shell outlives every editor, and a
 * panel left behind would offer a talker Sammlung a grid to resize.
 *
 * A list rather than one, since 1.3.0 gave the tablet a second thing to say
 * about a whole Sammlung - how long a press has to be held - and it does not
 * belong under the grid's heading. `name` is what the four ids are made from,
 * so a panel keeps one name across the markup, the tests and this file.
 */
export interface SheetPanel {
  /** Base for this panel's two ids: `<name>Panel` and `<name>State`.
   *
   *  It was four. `<name>Section` and `<name>Body` were on elements this
   *  component drew and the folded panel is @lautstark/design/svelte/Panel's
   *  now, which offers an id for the `<details>` and one for the state span and
   *  none for the heading or the body - see conventions.md §6.2's markup. The
   *  two that went were read by one e2e locator each and by nothing in src/. */
  name: string;
  /** What the panel is called, and what it is set to - the two halves of a
   *  folded heading. Read off the layout on every draw. */
  section: () => string;
  state: () => string;
  body: Component<Record<string, never>>;
}

let panels = $state.raw<SheetPanel[]>([]);

export function collectionSheetPanel(list: SheetPanel[] | null): void {
  panels = list ?? [];
}

export const editorPanels = (): SheetPanel[] => panels;

/** Whether the talker's language panel is drawn at all.
 *
 * On a tablet package localeFor() reads the locale off the *voice* first -
 * somebody chose that voice for these sentences, which is better evidence than
 * a field nobody has looked at - and only falls back to this one when the
 * voice name carries no usable tag. So the panel is hidden rather than offered
 * and ignored. */
export const deviceLanguageShown = (): boolean => !isApp(live());

/**
 * Which symbol collection this Sammlung's pictures come from.
 *
 * **The Sammlung's own fact, not this browser's.** exchange/SPEC.md §5.1 makes
 * one source per package a rule of the format, so it was always the Sammlung
 * that decided - picker.ts's offeredSource() read it off the pictures already
 * on the board. What derivation could not hold is a Sammlung with no pictures
 * yet: it followed whatever this machine was set to, so switching the machine
 * between two presses built a mixed board out of them. This is where the
 * intention is said instead, and the machine's setting is what a new Sammlung
 * starts from - the same shape bildhaft uses, and the voice one panel down.
 *
 * METACOM is offered only where a folder answers. It is a per-person licence
 * living in a folder on this computer, so choosing it on a machine that has
 * none would be choosing a source that can find nothing.
 */
export function symbolSourceChosen(): "arasaac" | "metacom" {
  /* The read that puts the panel on the list, and then picker.ts's answer.
   *
   * offeredSource() goes to core/state.ts directly, and it stays that way: it is
   * a seam the picker and three unit tests reach through, and none of them is a
   * component. What a component needs on top of it is the note that the layout
   * moved, which is this line. */
  live();
  return offeredSource();
}

/** Writes the choice onto the Sammlung. Nothing on any board moves: the source
 *  binds what the picker offers next, never what a button already holds. */
export async function chooseSymbolSource(source: "arasaac" | "metacom"): Promise<void> {
  if (state.layout.symbolSource === source) return;
  state.layout.symbolSource = source;
  touched();
  await save();
}

/** Whether the way back in is worth offering: the folder is remembered and the
 *  browser wants a click. Only then - with no folder at all there is nothing to
 *  re-grant, and the panel's own sentence already says to go and connect one. */
export function symbolSourceSleeping(): boolean {
  const how = symbols.metacomStatus();
  return !symbols.metacomReady() && how.kind === "needs-setup"
    && how.code === "permission-needed"
    && live().symbolSource === "metacom";
}

/** The browser's own prompt needs the gesture, so this is called straight from
 *  the handler. A refusal leaves everything as it was. */
export async function reconnectSymbolFolder(): Promise<void> {
  if (await symbols.reconnectMetacom()) touched();
}

export async function openCollectionSettings(): Promise<void> {
  // Taken down on the way in, not left standing while the catalogue is
  // fetched: what was there is the last Sammlung's answer, and a list that
  // shows one voice ticked and then another is a list that looked wrong for a
  // moment. Unmounting it is also what puts the search text and the language
  // pill back to nothing - see voiceListShown().
  pickerUp = false;
  /* Built from scratch on every open rather than left standing.
   *
   * Two reasons, and the second is the one that bites. An editor may have been
   * swapped since the last open, and a panel belonging to the editor that is
   * gone would otherwise still be here. And the grid panel holds a pending
   * choice - a size, a colour, two switches - which is deliberately nowhere but
   * inside it, so that closing the sheet is how the choice is declined; a
   * component that outlived the close would carry that choice into the next
   * open, showing a notice counting buttons against a size nobody had picked
   * this time. That is what the sheet's own `<dialog>` hides rather than
   * destroys, and what a `{#key}` on this number puts right. */
  opens += 1;
  collectionUp = true;
  await Promise.all([loadVoices(), readFetch()]);
  // Read off the layout rather than out of LANG. It is deliberately not in
  // paintStates() with the settings sheet's state lines: those are redrawn
  // after a language switch because they are translated, and this one names a
  // language in that language's own word.
  paintCollectionLanguage();
  // After the catalogue has arrived, not before: the component draws as soon
  // as it is mounted, and mounting it with the panel would have drawn the list
  // this sheet was holding the last time it was open.
  pickerUp = true;
  if (fetching.running) pollFetch();
}
