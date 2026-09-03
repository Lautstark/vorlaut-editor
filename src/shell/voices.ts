// The chosen voice stands in layout.json next to the language and is saved
// with everything else. What can be spoken with here is a different question,
// answered on every open: a key entered in the meantime, or a model that has
// arrived, should show up without reloading the page.
//
// **Those two questions are on two different sheets now.** Which voice this
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
// Azure and METACOM panels inside Einstellungen are settings.js, which this
// calls into.
import type { OfferedVoice, VoiceList } from "../core/types.js";
import { byId, status } from "./dom.js";
import { menuOn } from "@lautstark/design/menu";
import { languagePicker, type LanguagePicker } from "@lautstark/design/language";
import { voicePicker, type Pickable, type VoicePicker }
  from "@lautstark/stimmquelle/voice-picker";
import { reason } from "../core/errors.js";
import { listVoices, voiceFetchState, startVoiceFetch } from "../backend/index.js";
import { LANG, LANGUAGE_NAMES, LANGUAGES, rememberLanguage, setLanguage }
  from "../core/boot.js";
import { DEFAULT_LANGUAGE } from "../core/boot_data.js";
import { state } from "../core/state.js";
import { isApp } from "../core/types.js";
import { applyTexts, t } from "../core/texts.js";
import { save } from "../core/save.js";
import * as symbols from "../data/symbols.js";
import { offeredSource } from "./picker.js";
import { editor } from "../core/editor.js";
import { speak } from "./speech.js";
import { forgetKey, loadSettings, paintStates, saveSettings } from "./settings.js";

/* Annotated because the empty list has no element type to infer, and every
   read of a voice below then asks for a property on `never`. This is what
   listVoices() answers with; the literal is only what stands in until it
   has. */
/** Every panel in the settings sheet, in the order settings_sheet.ts writes
 *  them. Used to fold them all on open - see openSettings() - and exported so
 *  tests/unit/settings_panels.test.ts can hold it against the markup, which is
 *  the drift that made this list necessary. */
export const PANELS = [
  "languagePanel", "themePanel", "voicesHerePanel", "azurePanel",
  "arasaacPanel", "symbolsPanel", "boardPanel", "dataPanel", "dangerPanel",
] as const;

/** The one panel the sheet loads with open - settings_sheet.ts marks it so.
 *  Reopened after the fold below, because "folded again on every open" means
 *  back to how the sheet loads and not all-closed: e2e/theme.spec.ts leans on
 *  Sprache being open to show the accordion working at all. */
export const OPENS_WITH = "languagePanel";

let voices: VoiceList = {
  voices: [], active: "", chosen: "", chosenLabel: "", backend: "",
};
// Nothing is "pending" on this sheet any more. What is ticked IS what stands
// in layout.json, because choosing writes - so voices.chosen is the single
// answer to "which voice", and the gap that used to be held open between
// opening the sheet and pressing Save no longer exists.

// About 130 MB, so the server downloads in the background and is asked how far
// it has got. Polling rather than a held-open request: this server answers one
// request per thread, and the interface should stay usable meanwhile.
let fetching = { running: false, done: 0, total: 0, name: "", error: "",
                 missing: 0 };
let fetchDone = false;   // finished in this dialog - worth saying so

// One loop at a time: closing the dialog does not stop it, so opening it again
// would otherwise leave two of them polling and rendering over each other.
let polling = false;

/* The list itself: @lautstark/stimmquelle/voice-picker, held so that a repaint
 * and a language switch can reach it.
 *
 * How the list narrows is the module's now - the search field, the language
 * pills, and what a row matches on. So is where the keyboard is standing,
 * which is the half this repository never had: with an Azure key the list runs
 * to several hundred plain buttons, and Tab walked every one of them to reach
 * the panel underneath, which is the very thing the search field was added to
 * prevent.
 *
 * Null until openCollectionSettings() builds one, and rebuilt on every open
 * rather than kept: the search text and the language pill are the module's own
 * state with no way in from out here, and this sheet narrows itself back on
 * every open for the reason its panels fold back - a filter left on hides
 * voices with no sign that it had. A fresh block is the whole of that reset.
 */
let picker: VoicePicker | null = null;

async function loadVoices() {
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
function sampleText() {
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

// The button that fetches what is missing. Under the voice section whether or
// not that section has anything in it - a machine that cannot speak at all
// should not have to be told about a command line.
//
// With the note under it, always: the button used to be the word "Fetch"
// beside a list of voices, which left what it would fetch, from where, and
// how long it would take to a hint at the bottom that only appeared when
// there were no voices at all.
function fetchRow() {
  const row = document.createElement("div");
  row.className = "offer";
  const button = document.createElement("button");
  button.textContent = t("ui.voice_fetch");
  button.disabled = fetching.running;
  button.onclick = startFetch;
  const note = document.createElement("p");
  note.className = "note";
  note.textContent = t("ui.voice_fetch_note");
  row.appendChild(button);
  row.appendChild(note);
  return row;
}

function renderVoices() {
  // Against whatever voices() and current() answer now - which is what the
  // module reads them on every paint for. Null until this sheet has been
  // opened once, and the two Azure buttons in Einstellungen come through here
  // as well, so a repaint has to be able to reach nothing at all.
  picker?.refresh();

  const nothing = !voices.voices.length;
  // Hidden rather than left to say "no voice matches that": a search field
  // above an empty list is an invitation to type at a machine that has nothing
  // to find. The module draws that sentence for a filter that matched nothing,
  // which is a different fact and the only one it can know.
  byId("voiceBox").hidden = nothing;
  byId("voiceEmpty").textContent = nothing ? t("ui.voice_none") : "";
  // The other sheet, kept in step from the same pass. Neither is expensive and
  // they are never both on screen, but a fetch that finishes while the
  // Sammlung's sheet is open adds voices to both answers at once - so one
  // render writes both rather than leaving whichever sheet is closed stale
  // until somebody notices.
  renderOffer();
  // The standing rule, whether or not anything was just ticked: a voice is
  // part of what every sentence is spoken with, so changing it re-records all
  // of them rather than only the ones edited afterwards. A download's progress
  // belongs to the panel that started it, which is on the other sheet.
  //
  // With nothing to choose between, where to go instead. This is the whole of
  // the round trip the split costs: the offer that would fix it installs a
  // voice for every Sammlung there is, so it is installation-scoped and lives
  // in Einstellungen.
  byId("voiceHint").textContent =
    nothing ? t("ui.voice_none_where") : t("ui.voice_rebuild");
  paintVoiceState();
}

/* The voice panel's heading, folded: which voice, and the two facts that say
 * what kind of thing it is. Folded up this line is the whole answer to what
 * the panel is asked nine times out of ten - not "which voices are there" but
 * "which one is it speaking in". */
function paintVoiceState() {
  const id = voices.chosen || voices.active;
  const voice = voices.voices.find((v) => v.id === id);
  // The same name the row below uses when the voice is not here. Falling back
  // to the id put `azure:de-DE-KatjaNeural` in the one line that is the whole
  // answer nine times out of ten.
  byId("voiceState").textContent = voice
    ? [voice.label, sourceOf(voice.source), speaks(voice.language)].filter(Boolean).join(" · ")
    : voices.chosenLabel || id || t("ui.voice_state_none");
}

/* The Einstellungen half: what this machine can speak with at all.
 *
 * Three lines and no choosing. The count in the heading is what somebody
 * opening this panel is asking - "is there anything here" - and it is the
 * number of rows the other sheet would draw, so the two cannot disagree about
 * how many voices exist. The offer below it appears only when something is
 * actually missing.
 */
function renderOffer() {
  const box = byId("voiceOffer");
  box.innerHTML = "";
  if (fetching.missing) box.appendChild(fetchRow());
  byId("voiceOfferHint").textContent = fetchNote();
  byId("voicesHereState").textContent = voices.voices.length
    ? t("ui.voices_here_count", { n: voices.voices.length })
    : t("ui.voices_here_none");
}

// What the hint line says while a download runs, or "" when it has nothing
// to add and the usual note applies.
function fetchNote() {
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

async function readFetch() {
  try {
    fetching = await voiceFetchState();
  } catch (error) {
    fetching = { running: false, done: 0, total: 0, name: "",
                 error: reason(error), missing: 0 };
  }
}

async function startFetch() {
  fetchDone = false;
  try {
    await startVoiceFetch();
  } catch (error) {
    fetching.error = reason(error);
    renderVoices();
    return;
  }
  await readFetch();
  renderVoices();
  pollFetch();
}

// Stops by itself when the download is over. Two seconds is plenty: this is
// minutes of downloading, not milliseconds.
function pollFetch() {
  if (polling) return;
  polling = true;
  setTimeout(async () => {
    polling = false;
    await readFetch();
    if (fetching.running) {
      renderVoices();
      pollFetch();
      return;
    }
    fetchDone = !fetching.error;
    // The voices themselves have to be asked for again - the list was empty
    // when the dialog opened.
    await loadVoices();
    renderVoices();
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
async function chooseVoice(id: string) {
  if (id === voices.chosen) return;
  state.layout.voice = id;
  voices.chosen = id;
  renderVoices();
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
export async function saveAzure() {
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
  renderVoices();
  // No paintStates() here: saveSettings() has already run renderSettings(),
  // which sets the Azure line and starts the probe that replaces it. Painting
  // again would put "stored" back on top of the probe's answer.
  status(t("ui.settings_saved"));
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
async function chooseLanguage(code: string) {
  if (!code || code === LANG) return;
  setLanguage(code);
  document.documentElement.lang = code;
  // Kept for the next visit. In localStorage beside the scheme rather than in
  // the layout beside the voice, which is where it used to end up - see the
  // note on CHOICE in boot.ts.
  rememberLanguage(code);
  // Every fixed label, then everything drawn from one: the board, the voice
  // list with its facts and filters, and the settings panels' own state lines.
  // The line naming the symbol source is not among them and does not need to
  // be: it is built with the sheet that shows it, so the next one to open is
  // already in the language chosen here.
  applyTexts();
  // The trigger names the language in force, and that name is ours to keep now.
  // A <select> showed its own selected option and this line was not needed;
  // the button is drawn from LANG and would otherwise sit there still saying
  // the language somebody just switched away from.
  paintLanguage();
  paintStates();
  renderVoices();
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
async function chooseCollectionLanguage(code: string) {
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
  renderVoices();
}

// Removing the key is the same shape of errand as saving one: the list it
// feeds is on this sheet, so the sheet stays open and the Azure rows leave
// in front of the person who asked.
export async function forgetAzureKey() {
  try {
    await forgetKey();
  } catch (error) {
    status(t("ui.save_failed", { error: reason(error) }));
    return;                       // stay open, the message is in the header
  }
  await loadVoices();
  renderVoices();
  status(t("ui.azure_key_removed"));
}

/* The page's own language picker, built once and kept.
 *
 * It used to be rebuilt from scratch on every repaint, which a hand-written
 * row can afford; the module hands back the row plus a refresh() that moves
 * the pressed button, so what has to be held is the handle rather than the
 * element. Null until wireLanguage() runs - openSettings() and a language
 * switch both repaint, and neither can happen before the page is wired. */
let languageRow: LanguagePicker | null = null;

/** Moves the mark to whichever language is now in force.
 *
 * Nothing else here reads it, so this is the whole cost of the control not
 * being a <select>: a select showed its own selected option, and anything that
 * replaces one has to be redrawn by us. The module reads current() on every
 * call rather than the value it was built with, which is what makes this a
 * one-liner across a live binding that moves. */
export function paintLanguage() {
  languageRow?.refresh();
}

/** The same pair for the Sammlung's own language: the button that names it and
 *  the state line in its heading.
 *
 * Read off the layout on every call rather than remembered, because the layout
 * underneath it changes without anybody touching this panel - switching
 * Sammlung and importing a board both replace it, and save.ts calls this for
 * exactly that reason. A blank is a Sammlung written before the field existed;
 * it is shown as the page's default rather than as an empty button, which is
 * what layout_format.ts and localeFor() both make of it. */
export function paintCollectionLanguage() {
  const code = state.layout.language || DEFAULT_LANGUAGE;
  byId("collectionLangPick").textContent = LANGUAGE_NAMES[code] || code;
  byId("collectionLanguageState").textContent = LANGUAGE_NAMES[code] || code;
}

export function wireLanguage() {
  /* Built here and put in the anchor's place, id and all, so that the row in
     the document is the module's element rather than something wrapped around
     it: settings_sheet.ts writes an empty <div id="langPick">, and what stands
     there afterwards is the .segmented the module drew. A wrapper would have
     been the cheaper edit and would have put the group's role and name one
     level away from the buttons they belong to. */
  const anchor = byId("langPick");
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
       naming a group is the product's business - the package could not know
       that this product answers the question this way. */
    label: "Sprache / Language",
    /* The product's table wins where it has an entry. The module ships the
       same two names today, so this changes nothing on screen; what it stops
       is the day boot_data.ts learns a third language and the row shows a
       two-letter code beside a heading that has the name. One table answers
       for every language control here - see LANGUAGE_NAMES in core/boot.ts,
       which the Sammlung's own two controls read as well. */
    names: LANGUAGE_NAMES,
  });
  languageRow.node.id = anchor.id;
  anchor.replaceWith(languageRow.node);

  // The Sammlung's stays a button and a menu, and the difference is not
  // oversight. This one is not a preference of whoever is reading: it is a
  // property of the Sammlung, it travels in an export and it ends up in the
  // byte the firmware indexes its menu by. Two controls that look identical
  // would invite the reading that they are the same kind of choice.
  const collection = byId("collectionLangPick");
  collection.onclick = () => menuOn(collection, (add) => {
    const live = state.layout.language || DEFAULT_LANGUAGE;
    for (const code of LANGUAGES)
      add(LANGUAGE_NAMES[code] || code, () => void chooseCollectionLanguage(code),
        { checked: code === live });
  });
}

/** Einstellungen, at the foot of the sidebar: what this browser and this
 *  installation are set to, and nothing that belongs to one Sammlung.
 *
 * It still asks for the voices, which is the one thing that looks left over
 * and is not: the panel that says how many can speak here counts them, and
 * saving an Azure key is judged by whether the list changed.
 */
export async function openSettings() {
  byId("voiceOffer").innerHTML = "";
  byId("voiceOfferHint").textContent = "";
  fetchDone = false;
  // Folded again on every open. Somebody who unfolded one last time was after
  // a single thing in it, not after a preference. The headings say what is
  // inside, so nothing is hidden by folding them - and loadSettings() below
  // unfolds the symbols panel again if what is in there is broken.
  //
  // Every panel, from the list. Three of the eight were named here and the
  // other five were not, so the sentence above was true of Stimmen, Azure and
  // Symbole and false of the rest: opening Erscheinungsbild and closing the
  // sheet left it open on the next visit, under a comment saying it would not
  // be. A list beside the markup is the smallest thing that cannot drift from
  // it the way five names left out of a line could.
  for (const id of PANELS) byId<HTMLDetailsElement>(id).open = false;
  byId<HTMLDetailsElement>(OPENS_WITH).open = true;
  byId<HTMLDialogElement>("voices").showModal();
  await Promise.all([loadVoices(), readFetch(), loadSettings()]);
  paintLanguage();
  renderOffer();
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
 * `build` is handed the panel's body and a way to write its heading, and is
 * called afresh every time the sheet opens - so a pending choice never
 * survives a close, and the words are read out of the current language rather
 * than out of whatever it was when the editor was wired.
 *
 * Registered by an editor's wire() and taken back by its teardown, for the
 * reason collectionMenuExtras() gives: the shell outlives every editor, and a
 * panel left behind would offer a talker Sammlung a grid to resize.
 *
 * A list rather than one, since 1.3.0 gave the tablet a second thing to say
 * about a whole Sammlung - how long a press has to be held - and it does not
 * belong under the grid's heading. The panels are built here rather than
 * declared in the sheet's markup because the shell cannot know how many an
 * editor has; `name` is what their ids are made from, so a panel keeps one
 * name across the markup, the tests and this file.
 */
export interface SheetPanel {
  /** Base for this panel's four ids: `<name>Panel`, `<name>Section`,
   *  `<name>State`, `<name>Body`. */
  name: string;
  build: (body: HTMLElement,
          heading: (section: string, state: string) => void) => void;
}

let panels: SheetPanel[] = [];

export function collectionSheetPanel(list: SheetPanel[] | null): void {
  panels = list ?? [];
}

/** The sheet behind the ⋯ beside the Sammlung's name: what is a fact about
 *  this Sammlung and travels with it.
 *
 * The language is the talker's alone. On a tablet package localeFor() reads
 * the locale off the *voice* first - somebody chose that voice for these
 * sentences, which is better evidence than a field nobody has looked at - and
 * only falls back to this one when the voice name carries no usable tag. So
 * the panel is hidden rather than offered and ignored.
 *
 * The editor's panel is the mirror of it and hidden the same way, by a test
 * that cannot get out of step with what is in it: it is drawn when an editor
 * registered one and not when none did. The tablet registers its grid; the
 * talker registers nothing.
 *
 * Whichever panel is first is open on arrival. A sheet of two, or of one,
 * opening entirely folded is a sheet that asks for a second click before it
 * says anything - which is the opposite of what the folding is for.
 */
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
 * none would be choosing a source that can find nothing; settings.ts hides its
 * "use this source" button on the same test.
 *
 * A Sammlung that already asks for METACOM keeps asking while the folder is
 * asleep - that is the whole reason the field is stored - and the way back in
 * is offered here rather than pointed at. The gear is two sheets away, and
 * somebody who is in the picker wanting a picture is not looking for settings.
 */
function paintSymbolSource(): void {
  const body = byId("symbolBody");
  body.replaceChildren();
  byId("symbolSection").textContent = t("ui.symbol_source_section");

  const chosen = offeredSource();
  byId("symbolState").textContent = t(chosen === "metacom" ? "ui.metacom" : "ui.arasaac");

  const note = document.createElement("p");
  note.className = "note";
  note.textContent = t("ui.symbol_source_note");
  body.appendChild(note);

  const ready = symbols.metacomReady();
  for (const source of ["arasaac", "metacom"] as const) {
    const pick = document.createElement("button");
    pick.type = "button";
    pick.className = "btn choice";
    pick.setAttribute("aria-pressed", String(chosen === source));
    const head = document.createElement("strong");
    head.textContent = t(source === "metacom" ? "ui.metacom" : "ui.arasaac");
    const says = document.createElement("span");
    says.textContent = source === "metacom" && !ready
      ? t("ui.symbol_source_needs_folder")
      : t(`ui.symbol_source_${source}_note`);
    pick.append(head, says);
    // Disabled rather than hidden: a source that is not on offer here is still
    // one of the two answers, and hiding it would make the panel look like it
    // had one. The sentence under it says what is missing.
    pick.disabled = source === "metacom" && !ready;
    pick.onclick = () => { void chooseSymbolSource(source); };
    body.appendChild(pick);
  }

  /* The way back in, where the folder is remembered and the browser wants a
   * click. Only then: with no folder at all there is nothing to re-grant, and
   * the sentence above already says to go and connect one. */
  const status = symbols.metacomStatus();
  if (!ready && status.kind === "needs-setup" && status.code === "permission-needed"
      && state.layout.symbolSource === "metacom") {
    const why = document.createElement("p");
    why.className = "note";
    why.textContent = t("ui.symbol_source_sleeping");
    const again = document.createElement("button");
    again.type = "button";
    again.className = "btn";
    again.textContent = t("ui.symbol_source_reconnect");
    again.onclick = async () => {
      // The browser's own prompt needs the gesture, so this is the handler and
      // not something further in. A refusal leaves everything as it was.
      if (await symbols.reconnectMetacom()) paintSymbolSource();
    };
    body.append(why, again);
  }
}

/** Writes the choice onto the Sammlung. Nothing on any board moves: the source
 *  binds what the picker offers next, never what a button already holds. */
async function chooseSymbolSource(source: "arasaac" | "metacom"): Promise<void> {
  if (state.layout.symbolSource === source) return;
  state.layout.symbolSource = source;
  paintSymbolSource();
  await save();
}

/** The list, thrown away and built again.
 *
 * Both halves matter. dispose() is not optional even though this module
 * subscribes to nothing: a preview may still be in flight, and a piper model
 * arriving after the sheet closed would otherwise write a per cent onto a
 * button in a tree nobody can see. And a fresh block is how the search text
 * and the language pill go back to nothing - they are the module's own state,
 * and this sheet narrows itself back on every open for the reason its panels
 * fold back.
 */
function buildPicker() {
  picker?.dispose();
  picker = voicePicker({
    // Read on every paint rather than handed over once, which is what lets a
    // key saved in Einstellungen, or a download that has just finished, show
    // up here without the sheet being closed and opened again.
    voices: () => voices.voices.map(pickable),
    /* An empty entry in layout.json means "whatever works here", and that is
       the normal case for a fresh Sammlung. It is not offered as a row of its
       own - "Automatic" tells nobody anything - so the voice it comes out as
       stands marked instead, and notes() below says nobody picked it. */
    current: () => voices.chosen || voices.active,
    pick: (id) => void chooseVoice(id),
    /* No progress to report: synthesise() answers with a finished blob and
       says nothing on the way, so the button stays on the module's "…" for as
       long as this takes. That is exactly what the ▶ here did before, and
       plumbing a share through the seam to make a number appear is a change to
       the backend rather than to this sheet.

       No button passed to speak(): the module owns this one and is already
       labelling and disabling it, and two writers of one label is how a button
       ends up stuck saying "…". */
    hear: (voice) => speak(sampleText(), null, voice.id),
    /* The one thing this product has to say about a row that the catalogue
       does not: a voice that is in force without anybody having chosen it.
       Only this Sammlung's storage makes that distinction, which is why it
       comes through the hook rather than out of the module.

       It lands under the facts rather than inside them, and that is the fix
       this file's own comment asked for and did not make: the facts line is
       four words that compare two voices, and a clause among them stops the
       line being scannable. */
    notes: (voice) => (!voices.chosen && voice.id === voices.active
      ? [t("ui.voice_auto_note")] : []),
    /* The name for a voice the layout still holds and this machine cannot
       offer. Worked out by the backend, because that is where the naming rules
       are; without it the row would be labelled with the id, and an id is
       `azure:de-DE-KatjaNeural`. */
    chosenName: () => voices.chosenLabel,
    // A function because LANG is a live binding: this page changes language
    // without reloading, and a locale captured once would go on answering in
    // the language somebody has just left.
    lang: () => (LANG === "en" ? "en" : "de"),
  });
  byId("voiceBox").replaceChildren(picker.node);
}

export async function openCollectionSettings() {
  // Emptied on the way in, not left standing while the catalogue is fetched:
  // what was here is the last Sammlung's answer, and a list that shows one
  // voice ticked and then another is a list that looked wrong for a moment.
  picker?.dispose();
  picker = null;
  byId("voiceBox").replaceChildren();
  byId("voiceHint").textContent = "";
  const language = byId<HTMLDetailsElement>("collectionLanguagePanel");
  language.hidden = isApp(state.layout);
  // Built from scratch on every open rather than emptied and refilled: an
  // editor may have been swapped since the last one, and a panel belonging to
  // the editor that is gone would otherwise still be standing here.
  const symbols = byId<HTMLDetailsElement>("symbolPanel");
  for (const old of symbols.parentElement?.querySelectorAll("details.panel--editor") ?? []) {
    old.remove();
  }
  // Filled before it is unfolded, so the heading it states is the one the
  // panel opens with rather than one written a frame later.
  const built = panels.map((one) => {
    const details = document.createElement("details");
    details.className = "panel panel--editor";
    // The accordion is by name, and these join the one the markup declares -
    // so opening a generated panel still folds the Sprache above it.
    details.setAttribute("name", "collection");
    details.id = `${one.name}Panel`;
    const section = document.createElement("span");
    section.className = "section";
    section.id = `${one.name}Section`;
    const line = document.createElement("span");
    line.className = "state";
    line.id = `${one.name}State`;
    const summary = document.createElement("summary");
    summary.append(section, line);
    const body = document.createElement("div");
    body.className = "setting";
    body.id = `${one.name}Body`;
    details.append(summary, body);
    // Before the symbols, which is where the one hard-coded editor panel used
    // to sit: the panels that are this target's, then the ones both have.
    symbols.before(details);
    one.build(body, (heading, state) => {
      section.textContent = heading;
      line.textContent = state;
    });
    return details;
  });
  // The first one that is there, whichever that is. Assigning `open` down the
  // list would do it too, but only because the accordion closes the previous
  // one - which is the browser undoing something this line should not have
  // said in the first place.
  paintSymbolSource();
  const shown = [language, ...built, symbols, byId<HTMLDetailsElement>("voicePanel")];
  const first = shown.find((one) => !one.hidden);
  for (const one of shown) one.open = one === first;
  byId<HTMLDialogElement>("collectionSheet").showModal();
  await Promise.all([loadVoices(), readFetch()]);
  // Read off the layout rather than out of LANG. It is deliberately not in
  // paintStates() with the settings sheet's state lines: those are redrawn
  // after a language switch because they are translated, and this one names a
  // language in that language's own word - "Deutsch" is "Deutsch" whichever
  // way this page is set.
  paintCollectionLanguage();
  // After the catalogue has arrived, not before: the module paints as soon as
  // it is built, and building it up with the panel would have drawn the list
  // this sheet was holding the last time it was open.
  buildPicker();
  renderVoices();
  if (fetching.running) pollFetch();
}
