/* What a board is, as the rest of the app passes it around.
 *
 * These shapes were only ever written down in three places that could not
 * check each other: layout_format.ts, which turns one into the bytes the
 * firmware reads; obf.ts, which turns one into a document other AAC software
 * opens; and the seed in backend/local.ts that a first visit gets. Every
 * module in between took an object and hoped.
 *
 * The names are the ones already on disk and in every saved layout - snake
 * case where the firmware and the Open Board Format use it - because these are
 * a description of stored data rather than a chance to rename it.
 */

/** One key: what it says, and the picture on it. */
export interface Slot {
  text: string;
  /** A file name kept in the browser's store, or "metacom:<name>" for a
   *  reference into somebody's own licensed collection. Empty means none. */
  symbol: string;
  /** Whether the picture is crossed out - see Negated below. */
  negated?: boolean;
  /** What one press does. Exactly one thing.
   *
   *  Absent is not a fourth value: it means `speak`, which is what every key
   *  on this device did before there was anything else it could do. So a
   *  Sammlung written before this field existed reads back as the Sammlung it
   *  was and exports byte for byte the file it exported, which is the same
   *  reason `negated` above is absent rather than false. AppButton.act is
   *  required where this is optional for exactly that difference: a tablet
   *  button has never had a default worth writing down. */
  act?: SlotAct;
}

/** What pressing a speech key does, on the device with four of them.
 *
 * Three things in the editor's words - **Wort**, **Wort & weiter**, **weiter**
 * - which are two members and a modifier here, for the reason Act's own note
 * gives one floor along: the modifier rides on the case that navigates,
 * because that is the only case the states it can reach are states a file can
 * hold.
 *
 * **Its own union rather than a narrowing of Act.** Four of Act's seven are
 * the sentence bar - `append`, `clear`, `backspace`, `sayBar` - and this
 * device has no bar at all: the key is the whole sentence and it is said on
 * the press. `home` is the fifth, and it goes with the bar's neighbour, the
 * start page, which a ring of sets does not have. What is left is not a subset
 * either, because `goto` names a different thing here - a BoardSet, not an
 * AppPage - and the modifier says something else about it. A shared union
 * would therefore have to be widened until it could express a talker key
 * appending to a bar that does not exist, which is the kind of state
 * core/types.ts's shapes exist to make unwritable.
 *
 * What *is* shared is the thinking, and deliberately: one dropdown asking what
 * one press does, a target list under it when the answer navigates, and the
 * same marks on the cell. Somebody who has authored one of these boards has
 * authored the other.
 */
export type SlotAct =
  /** Say this key. The default and, until this type existed, the only thing a
   *  speech key did. */
  | { kind: "speak" }
  /** Switch to another set. `set` is a BoardSet.id in this same Sammlung.
   *
   *  `alsoSpeak` is the talker's half of exchange/SPEC.md §7.3's modifier: the
   *  key says its word first, then the set changes. It is
   *  `ext_lautstark_speak_on_navigate` on the wire, the sibling of
   *  `ext_lautstark_append_on_navigate` - *speak on the way through* where the
   *  tablet *appends on the way through*, because a tablet has a bar to append
   *  to and this device has a voice. Absent rather than false where it is not
   *  wanted, like `negated` and for the same reason. */
  | { kind: "goto"; set: string; alsoSpeak?: boolean };

/* --- Crossing a picture out ------------------------------------------------
 *
 * German AAC negates by drawing a cross over the symbol being negated rather
 * than by swapping in a picture of its own.
 *
 * Not because a collection has no negation symbol - METACOM files one under
 * `nichtkein` in `Kleine_Worte`, the German negation pair run together because
 * a filename cannot hold the slash between them, and bildquelle 1.6.4 splits
 * it apart so that searching either half reaches it (see `metacom.ts` there).
 * The reason is that such a symbol can only say the negation *itself*, on a
 * key of its own. It cannot say which word is being negated, and on a board
 * of four keys with no sentence bar there is nothing to join it to.
 *
 * Crossing out is what puts the negation onto the bread. Without it the only
 * way to say so is a picture of bread meaning its opposite, with nothing on
 * the key to tell a reader which it is.
 *
 * A property of the key rather than of the picture, and that is the whole of
 * why it is a field here instead of a second symbol reference. The same
 * drawing of bread is bread on one key and not-bread on the next; a collection
 * holds one of it, the board says which. It also survives switching symbol
 * source, because it says nothing about where the picture came from.
 *
 * Optional and absent for "no", so every layout already stored reads back
 * unchanged - and so that a false never has to be written to say the ordinary
 * thing. bildhaft's Slot.negated is the same field for the same reason; the
 * two products draw the cross from the same convention, not from shared code.
 *
 * Where it is drawn is every place a picture is: the cell, the sheet's
 * preview, the device's tile, and the PNG that goes into an app package. The
 * last two bake it into pixels rather than carrying a flag, which is what lets
 * the firmware and the Android viewer show it without knowing it exists. */

/** One set of four keys, and the set key that switches to it. */
export interface BoardSet {
  /** What a `goto` key names, when one names this set. AppPage.id one editor
   *  along, and the same argument: a set is told apart from its neighbours by
   *  being itself, not by where it currently sits. The order of these is the
   *  order the device's set key cycles them in, so reordering them is an
   *  ordinary authoring act on this device rather than a rearrangement of a
   *  list - and a target stored as a position would follow the drag instead of
   *  staying where it was pointed.
   *
   *  **Minted when something first points at it, and not before.** Absent
   *  means no key leads here, which is every set in every Sammlung written
   *  until now: nothing has to be migrated, nothing already stored changes,
   *  and a Sammlung nobody uses this on goes on exporting the file it exported.
   *  The alternative - an id on every set the moment this field existed -
   *  would rewrite every board in the store to say something none of them had
   *  been asked. openKeySheet() is where the minting happens, on the press
   *  that writes the key that needed it. */
  id?: string;
  name: string;
  symbol: string;
  slots: Slot[];
}

/** One Sammlung in the list, as the sidebar shows it.
 *
 * `Collection` in the code and *Sammlung* on screen, which is the family's
 * convention rather than an oversight - design.md §3.6 settles both halves. It
 * also frees the word *board*, which the exchange format uses for a single OBF
 * page and which this repository spent a while meaning two things at once.
 *
 * The id is minted once and never changes - not on rename, not on edit, not on
 * export. Duplicating mints a fresh one, because a copy that kept the original's
 * would overwrite it wherever the two meet again. That is exchange/SPEC.md §8's
 * rule for `ext_lautstark_package_id`, and this is the value that will become
 * it; writing the id down now rather than deriving one at export time is what
 * makes "stable for the life of the package" true rather than hoped for. */
export interface CollectionRef {
  id: string;
  /** Whatever somebody typed in the work head. A new one is named for the day
   *  rather than left blank, so the list reads even when nobody names anything. */
  name: string;
  /** When it was last written, for the order the sidebar shows them in: the one
   *  being worked on rises.
   *
   *  Required rather than optional, and that is the storage layer's index
   *  asking for it: `collections` is indexed on this field, and a record
   *  missing an index's key is not in the index at all - so a Sammlung without
   *  a stamp would not be missing from the *order*, it would be missing from
   *  the sidebar. It was optional while a Sammlung could arrive from the
   *  single-layout database without one; nothing arrives from there any more. */
  updatedAt: number;
}

/** The whole list, and which of them is open. */
export interface CollectionList {
  collections: CollectionRef[];
  /** null only before the first one exists. */
  current: string | null;
}

/** Which editor a Sammlung is for, and therefore what is inside it.
 *
 * Declared once, when the Sammlung is made, and never converted: a five-key
 * device and a tablet board are not two renderings of one thing. Four keys in
 * a fixed ring have no answer to "which cell of a 6x11 grid", and a page of
 * sixty-six buttons composing a sentence has no answer to "which of the five
 * displays". A convert would therefore have to invent most of its output,
 * which is a worse offer than exporting and starting again.
 *
 * The shell names this type and neither editor: it is what core/editor.ts's
 * registry is keyed by, and it is the whole of what src/shell/ knows about
 * there being more than one of them.
 */
export type Target = "diy" | "app";

/** A whole Sammlung, in whichever shape its target asks for.
 *
 * A union rather than one interface with optional halves, and the difference
 * shows at every reader: `layout.sets` on an app Sammlung would type-check and
 * answer undefined, which is how the sidebar came to count every Sammlung with
 * whichever editor happened to be installed. With a union that line does not
 * compile until it has asked which shape it is holding.
 */
export type Layout = DiyLayout | AppLayout;

/** The five-key talker: sets of four keys, and the ring that cycles them. */
export interface DiyLayout {
  /** Absent counts as "diy". Every layout written before there was a second
   *  editor is one of these, and there is no migration - the flag arrived
   *  after boards already existed. */
  target?: "diy";
  /** Every one of them goes onto the device, in this order, at most five of
   *  them. A Sammlung is the selection: there is no second flag deciding
   *  which of its sets ship. */
  sets: BoardSet[];
  /** Which language the device's own menu speaks. */
  language?: string;
  /** The voice chosen for this board, "" or absent when none is. */
  voice?: string;
  /** Which symbol collection this Sammlung's pictures come from.
   *
   * **An intention, and that is the whole of why it is stored.** Which source a
   * Sammlung uses was already decided - picker.ts's offeredSource() reads it
   * off the pictures already on the board, and exchange/SPEC.md §5.1 makes one
   * source per package a rule of the format. What derivation cannot hold is a
   * Sammlung that has no pictures yet: it followed whatever this machine was
   * set to, so switching the machine between placing two pictures built a mixed
   * board out of two perfectly ordinary presses.
   *
   * Absent is not a third value. It means nobody has said, which is every
   * Sammlung written before this field existed and is read exactly as it was
   * then - from the pictures, then from the machine. There is no migration, for
   * the reason DiyLayout.target has none: the flag arrived after boards did.
   *
   * Set when a Sammlung is made, from what this browser is set to. That is the
   * pattern the voice and bildhaft already use, one level along: the app's
   * setting is the default for a new one, and the Sammlung carries its own from
   * then on. */
  symbolSource?: "arasaac" | "metacom";
  sleep_timeout_seconds?: number;
}

/** How a button wears the colour of its word class.
 *
 * A preference rather than a rule - which is the point. The Fitzgerald key
 * says a lot on a board of few big cells and rather less on one of sixty-six,
 * where a photograph under a fill is a photograph with a wash over it. The
 * border says the same thing and leaves the picture alone. */
export type WordColor = "fill" | "border" | "off";

/** A tablet Sammlung: pages of buttons that compose a sentence in a bar.
 *
 * The MetaTalk shape, and what the Android viewer already renders - see
 * exchange/SPEC.md §7. Nothing here is an extension of that format: a page is
 * an OBF board, a button is an OBF button, and the sentence bar is §7.3.
 */
export interface AppLayout {
  target: "app";
  language?: string;
  voice?: string;
  /** Which symbol collection this Sammlung's pictures come from.
   *
   * **An intention, and that is the whole of why it is stored.** Which source a
   * Sammlung uses was already decided - picker.ts's offeredSource() reads it
   * off the pictures already on the board, and exchange/SPEC.md §5.1 makes one
   * source per package a rule of the format. What derivation cannot hold is a
   * Sammlung that has no pictures yet: it followed whatever this machine was
   * set to, so switching the machine between placing two pictures built a mixed
   * board out of two perfectly ordinary presses.
   *
   * Absent is not a third value. It means nobody has said, which is every
   * Sammlung written before this field existed and is read exactly as it was
   * then - from the pictures, then from the machine. There is no migration, for
   * the reason DiyLayout.target has none: the flag arrived after boards did.
   *
   * Set when a Sammlung is made, from what this browser is set to. That is the
   * pattern the voice and bildhaft already use, one level along: the app's
   * setting is the default for a new one, and the Sammlung carries its own from
   * then on. */
  symbolSource?: "arasaac" | "metacom";
  /** One size for every page in the Sammlung, not one per page.
   *
   *  OBF would allow a grid per board and this deliberately does not use it.
   *  What a person learns on a board of this kind is where a word *is* - the
   *  hand goes to the top right for "ich" before the eye has read anything -
   *  and that only survives across pages while the pages are the same shape.
   *  A per-page size would make the top right cell a different distance from
   *  the thumb on every page, which is the one thing the layout is for. */
  grid: GridSize;
  /** Every page, in the order the editor's page strip shows them. Presentation
   *  only: what leads where is the buttons, not this order. */
  pages: AppPage[];
  /** The buttons of the leftmost column, when that column belongs to the
   *  Sammlung rather than to each page.
   *
   *  This is what MetaTalk's handbook describes when it says the keys of the
   *  leftmost column stay reachable while subpages are opened, and it is the
   *  same argument `grid` above is made with, one column narrower: what
   *  somebody learns on a board of this kind is where a word *is*, and core
   *  words only stay put while every page puts them in the same place.
   *
   *  Absent means the column is nothing special and each page owns its own -
   *  which is every Sammlung stored before this field existed, so nothing has
   *  to be migrated. An empty array is not the same absence: it means the
   *  column is the Sammlung's and there is nothing in it yet, which is what
   *  switching it on before authoring anything leaves behind.
   *
   *  Every button in here sits at `col: 0`; `row` is where in the column it
   *  is. While this is present no page holds a button of its own at column
   *  zero - the editor is what keeps that true, in the same way and with the
   *  same standing as the rule that two buttons may not share a cell.
   *
   *  **Nothing about this reaches the package**, and that is deliberate:
   *  exchange/SPEC.md §4.1 says persistence needs no field, because a builder
   *  writes those buttons onto every board and a viewer then sees an ordinary
   *  board. So this is an authoring shape - written once, exported many times -
   *  and data/app_package.ts is where the many-times happens.
   */
  firstColumn?: AppButton[];
  /** Whether the leftmost column is drawn set apart from the rest.
   *
   *  Written out as exchange/SPEC.md §4.1's ext_lautstark_first_column_gap,
   *  and it is a hint about drawing rather than about behaviour: the buttons
   *  in that column are ordinary buttons, and what makes them always reachable
   *  is a builder putting them on every page. The gap is what tells somebody
   *  looking at the board that those are the ones that stay - MetaTalk sets
   *  its leftmost column apart for exactly that reason.
   *
   *  Absent counts as false, and a viewer that has never heard of the field
   *  draws the board without the gap, which is a board with the wrong emphasis
   *  rather than a wrong board. */
  firstColumnGap?: boolean;
  /** Whether a word class is drawn as a fill, as a border, or not at all.
   *
   *  One choice for the whole Sammlung, beside the grid size and for the same
   *  reason: it is decided once and holds for every page.
   *
   *  Absent counts as "fill", which is what every layout stored before this
   *  field existed was drawn as - so an old Sammlung opens looking exactly as
   *  it did, and nothing has to be migrated.
   *
   *  "off" is not colourless. A page keeps whatever colour it has, because
   *  that says *where* somebody is; what goes away is the colour that means
   *  *what a word is*. The family this follows treats it the same way:
   *  AsTeRICS Grid carries `colorSchemesActivated` beside a `colorMode` of
   *  background, border or both. */
  wordColor?: WordColor;
  /** How long a press must rest on a button before the tablet counts it, in
   *  milliseconds. Written out as exchange/SPEC.md §4.1's
   *  ext_lautstark_hold_time_ms.
   *
   *  Absent counts as 0, which is off: the button activates on contact, the
   *  way every board did before this field existed. So nothing has to be
   *  migrated and no Sammlung changes behaviour by being opened.
   *
   *  This and [releaseTimeMs] are the only two things on a Sammlung that
   *  describe the *user* rather than the board - every other field here says
   *  what is on the page. They are stored per Sammlung anyway, because the
   *  person who authored a board is the person who knows who it was authored
   *  for, and a tablet that behaves correctly the first time it is handed over
   *  is worth more than one that has to be tuned before it can be used.
   *
   *  What it is *not* is the last word. SPEC.md §4.1 says a viewer with its own
   *  setting should let that win, so this is a default travelling with the
   *  package rather than a decision imposed on the tablet - a child's motor
   *  needs change with fatigue and illness, and the person holding the tablet
   *  on a bad afternoon is not going to re-export a Sammlung. */
  holdTimeMs?: number;
  /** How long after a press the tablet ignores the next one, in milliseconds.
   *  exchange/SPEC.md §4.1's ext_lautstark_release_time_ms.
   *
   *  Absent counts as 0, as above.
   *
   *  Deliberately separate from [holdTimeMs] rather than one "sensitivity"
   *  number, because the two catch different faults and a user commonly needs
   *  one and not the other. The hold rejects a press that was never meant - a
   *  hand resting on the board on the way to a word. This rejects the second
   *  copy of a press that was - a tremor, or a finger bouncing on release,
   *  arriving as three presses. One number would make every user take both
   *  treatments to get the one they need, and a hold time costs a delay on
   *  every word the user says. */
  releaseTimeMs?: number;
  /** The page the tablet opens on, and what a `:home` button goes to. It
   *  becomes `manifest.root`.
   *
   *  An id rather than pages[0], so that reordering the strip cannot silently
   *  change what a child's tablet opens on - which is a thing nobody would
   *  look for, because dragging a row is not an act that sounds like it could
   *  do that. */
  home: string;
}

export interface GridSize {
  rows: number;
  columns: number;
}

/** Which shape a layout is, for the readers that can only handle one.
 *
 * Type guards rather than a bare `layout.target === "app"` at each call site,
 * because the interesting half is the *other* one: "diy" is written down on
 * nothing that existed before there were two editors, so the test for it is
 * `!== "app"` and not `=== "diy"`. Getting that backwards would read every
 * board this product has ever saved as an app Sammlung with no pages in it,
 * which is an empty screen rather than an error.
 */
export const isApp = (layout: Layout): layout is AppLayout =>
  layout.target === "app";
export const isDiy = (layout: Layout): layout is DiyLayout =>
  layout.target !== "app";

/** What a talker key does, with the default written out.
 *
 * Absent means `speak` - Slot.act says why it is absent rather than stored -
 * and here rather than in either reader for the reason slotIsEmpty() is where
 * it is: the editor draws a key from this and app_package.ts writes one from
 * it, and the two agreeing is the whole point. A default decided twice is a
 * default that goes on being decided twice until the copies disagree. */
export const actOf = (slot: Slot): SlotAct => slot.act ?? { kind: "speak" };

/** Whether pressing a talker key says anything.
 *
 *  Both halves of the middle answer: a key that leads onward *and* carries its
 *  word through says it exactly as a plain speaking key does. What reads this
 *  is every question that is really about sound - whether to offer a play
 *  control, whether to bake a recording into a package. */
export const says = (act: SlotAct): boolean =>
  act.kind === "speak" || act.alsoSpeak === true;

/** One page: an OBF board, with the buttons that sit on it. */
export interface AppPage {
  /** Minted with the page, never derived from the name or the position - the
   *  same rule and the same reason as CollectionRef.id. Buttons point at this
   *  value, so deriving it from anything editable would break every edge the
   *  moment somebody renamed a page. */
  id: string;
  name: string;
  /* A page carried a colour here, written out as exchange/SPEC.md §4.2's
   * ext_lautstark_board_color. It is gone from this half while the whole idea
   * of colouring a *page* is reconsidered - a button's colour is untouched,
   * because that one marks a word class and is the Fitzgerald key.
   *
   * The field in the format is optional and stays defined; this builder simply
   * writes no value for it, which the viewer already handles (Board.color is
   * nullable there). The talker still has one, on a set rather than a page,
   * and that half goes with the firmware in its own change. */
  /** Sparse, and each one carries where it sits. There is deliberately no
   *  dense array of cells: growing the grid from 3x5 to 6x11 would re-index
   *  every entry of one, and that re-indexing is the rewrite this shape exists
   *  to avoid. A cell nothing sits in is a cell no button names. */
  buttons: AppButton[];
}

/** One button on one page. */
export interface AppButton {
  id: string;
  /** Zero-based, row-major, inside the Sammlung's grid. Two buttons may not
   *  hold the same cell; the editor is what keeps that true. */
  row: number;
  col: number;
  /** What the button shows. */
  label: string;
  /** What it says, when that is not what it shows: "einen Apfel" under an
   *  "Apfel". Empty means the label is spoken, which is what OBF means by
   *  leaving `vocalization` out - see exchange/SPEC.md §7.2. */
  vocalization: string;
  /** A file name in the browser's store, or "metacom:<name>". Same vocabulary
   *  as Slot.symbol, because it is the same picker behind it. */
  symbol: string;
  /** Whether the picture is crossed out. Same field as Slot.negated and the
   *  same reasons - the note above it is the one to read. */
  negated?: boolean;
  /** Which Fitzgerald class this word belongs to, as a key into
   *  boot_data.ts's WORD_CLASSES - or "" for a button that carries no class.
   *
   *  The class rather than the colour it resolves to, and that is what makes
   *  this a convention rather than a palette: the author chose "this is a
   *  verb", and green is a rendering of that. Storing the hex would make
   *  re-tinting a whole Sammlung a sweep over every button, and would lose the
   *  only thing anybody meant. */
  wordClass: string;
  /** What one press does. Exactly one thing.
   *
   *  See Act: the reason this is not a boolean beside an optional page id is
   *  that the format cannot represent the states such a pair could express. */
  act: Act;
}

/** What pressing a button does - exchange/SPEC.md §7.3's activation table, as
 *  a type.
 *
 * That table is exclusive on the wire: `load_board` beats `action`, which
 * beats `ext_lautstark_speak_immediately`, which beats appending. A model that
 * carried `speakImmediately: boolean` beside `target?: string` could hold
 * both, and the exporter would then have to pick a winner - which is the
 * exporter guessing at what somebody meant, in a file that ends up on a child's
 * tablet. A union can only say one thing, so there is nothing to guess.
 *
 * `alsoAppend` on the two navigating members is the one thing that is not a
 * choice between behaviours, and it is written where it is for that reason.
 * §7.3 calls it a modifier: it says a navigating button puts its entry in the
 * bar on the way through, and it decides nothing about *which* navigation
 * happens. Beside `kind` it would be a boolean the other five members would
 * each have to mean something about - "append and then append" - so it sits
 * inside the two that navigate, where the states it can reach are the states
 * the format can write.
 */
export type Act =
  /** Append one entry to the sentence bar. The default and the common case. */
  | { kind: "append" }
  /** Speak this button at once and leave the bar alone. For an interjection -
   *  "Aua", a greeting - which composing into a sentence first would ruin. */
  | { kind: "speak" }
  /** Go to another page. `page` is an AppPage.id in this same Sammlung.
   *
   *  `alsoAppend` is exchange/SPEC.md §7.3's ext_lautstark_append_on_navigate:
   *  the entry goes into the bar first, then the page changes. The carrier
   *  phrase - "ich will ..." leading to the page the next word is on - which
   *  is one press for what would otherwise be two on two pages. Absent rather
   *  than false where it is not wanted, like AppButton.negated and for the
   *  same reason: a button written before this existed is written the same
   *  way afterwards. */
  | { kind: "goto"; page: string; alsoAppend?: boolean }
  /** The four sentence-bar controls, exchange/SPEC.md §7.4. `sayBar` is the
   *  spec's `:speak`, renamed here only because "speak" above is the other
   *  thing and two of them in one union would be read wrongly every time. */
  | { kind: "clear" }
  | { kind: "backspace" }
  | { kind: "sayBar" }
  /** `alsoAppend`, again: §7.3 lets the flag ride on `:home` as well, because
   *  both are navigation. A "bitte" that adds the word and returns to the
   *  start page is an ordinary board, not an edge case. */
  | { kind: "home"; alsoAppend?: boolean };

/** A layout as it comes out of storage, with the stamp that says whether
 *  somebody else has written since we read.
 *
 *  There were two stamps. The second said whether a build was due, and it went
 *  with the build - adr/0011. Nothing in the editor is stale against a device
 *  any more, because the editor does not know there is one. */
export interface HeldLayout {
  layout: Layout | null;
  version: string | null;
}

/** What a write answers with: the conflict case is a value rather than a
 *  throw, because the caller has something to say about it. */
export interface SaveResult {
  conflict?: boolean;
  saved?: Layout;
  version?: string | null;
}

/** This installation rather than this content, which is why none of it is in
 *  the layout: an Azure key and where somebody's METACOM folder is. */
export interface Settings {
  azureKey: { set: boolean; hint: string };
  azureRegion: string;
  azureSecret?: string;
  metacom: {
    path: string;
    ok: boolean;
    count: number;
    keywords: boolean;
    fixed: boolean;
  };
  /** Which collection the picker offers. One at a time, deliberately: a board
   *  read by a child is easier to read when its five keys are drawn in one
   *  hand, and two illustration styles side by side is a cost paid by the
   *  person least able to say so. bildhaft settled on the same rule.
   *
   *  Only the picker is bound by it. A key already holding a picture keeps
   *  exactly the picture it holds - switching source is a decision about what
   *  to choose from next, never a reason to take symbols off a board. */
  activeProvider?: "arasaac" | "metacom";
  /** Which of METACOM's parallel renderings the search should prefer, or null
   *  for none. Ordering only - nothing is ever filtered out by it.
   *
   *  Beside the metacom block rather than inside it, and that is the whole of
   *  why it did not survive a reload: everything in there is re-derived from
   *  the provider on every read, because a folder chosen in this browser can
   *  be gone by the next visit and a stored "ok: true" would be a claim nobody
   *  checked. A preference is not such a claim - it is a choice, and it has to
   *  outlive the folder it was made about. */
  metacomRendering?: string | null;
  /** Whether the sidebar is a column of this page. A choice about the shape of
   *  the window, remembered rather than re-made every visit - and kept here
   *  with every other preference rather than in localStorage, because a
   *  preference living in two stores gets restored by one and overwritten by
   *  the other. conventions.md §1.3. Absent counts as open. */
  sidebarOpen?: boolean;
  /** The tablet an app package was last sent to, as `a.b.c.d`, or absent
   *  because none ever has been.
   *
   *  **It is one of the things a Sicherung must not carry**, and it sits in
   *  this object with the Azure key and the METACOM path for exactly that
   *  reason. data/backup.ts's stripSecrets() is an allow-list, so it is
   *  dropped by construction rather than by anybody remembering; what makes it
   *  belong in that company is not that it is a secret but that it is a fact
   *  about one house's wiring. A file restored on another machine, or in
   *  another home, would fill the four boxes with a number that is right
   *  nowhere - and the one failure this whole path is built to keep
   *  distinguishable is a wrong number.
   *
   *  Four numbers rather than a URL: a scheme, a port and a path are the
   *  product's to know, and the person copies a number off a screen. See
   *  shell/tabletSend.ts, which is the only thing that reads or writes it. */
  tabletAddress?: string;
  local?: boolean;
}

/** What the settings sheet asks to be written. A subset of Settings, because
 *  the sheet holds the fields somebody can type and not the ones the provider
 *  answers for - and azureKey is absent unless it was typed, since an untouched
 *  field must not wipe the stored key. Removing the key is therefore its own
 *  explicit ask - null - and never a reading of an empty field. */
export interface WantedSettings {
  /** Absent leaves the stored one alone, like every field below it. It was
   *  required, which meant a save about anything else had to carry it or wipe
   *  it - and the sidebar preference is a save about something else. */
  azureRegion?: string;
  metacom?: string;
  azureKey?: string | null;
  /** Absent leaves the stored preference alone; null clears it. Same shape as
   *  azureKey above, and for the same reason: a save that is about something
   *  else must not wipe a choice it never asked about. */
  metacomRendering?: string | null;
  activeProvider?: "arasaac" | "metacom";
  sidebarOpen?: boolean;
  /** Absent leaves the remembered one alone, like every field above it. Only
   *  ever written after a package has actually arrived somewhere: an address
   *  that answered nothing is the one thing worth not remembering. */
  tabletAddress?: string;
}

/** A voice as the picker shows it.
 *
 * Four facts beyond the name, and they are the four that decide between two
 * voices: who renders it, what it speaks, whose voice it is, and what it costs
 * to have. The catalogue carried all of them all along and this seam used to
 * drop them on the floor - a picker of bare names made "Thorsten" and "Katja"
 * look like the same kind of thing, when one is on this machine and the other
 * is a request to Microsoft per sentence.
 *
 * stimmquelle's `recommended` is deliberately NOT here. It is editorial, and
 * its own documentation says it is always false for a cloud backend "which
 * publishes hundreds and about which this package has no opinion" - so with an
 * Azure key a handful of rows would carry a badge and several hundred would
 * not, and "no opinion" is indistinguishable from "not as good" to anyone
 * reading the list. mitreden took the same badge out for the same reason. The
 * flag stays out of the type rather than being carried unused, because an
 * unused field is where a use gets invented later. */
export interface OfferedVoice {
  id: string;
  label: string;
  language: string;
  ready: boolean;
  /** What actually renders it. Decides what the other fields can promise. */
  source: "piper" | "azure" | "system";
  /** `female`, `male`, or `mixed` for a multi-speaker corpus. Empty if unknown. */
  gender: string;
  /** The model's quality tier - `medium`, `high`, and the `low` that only a
   *  page driving piper itself can speak. Empty where the backend has no such
   *  thing to say, which is every cloud voice.
   *
   *  Here because the name alone cannot carry it: stimmquelle's displayName()
   *  answers with the catalogue's name and nothing else, on purpose, so both
   *  Thorstens are "Thorsten" and the two rows differed only in a download
   *  size that said nothing about why. What the picker does with it is a
   *  narrower question than "show the tier" - see voiceRow(). */
  quality: string;
  /** Fetched before this voice first speaks. 0 for a cloud backend. */
  downloadBytes: number;
  /** True when it needs a key, and so a network call for every sentence. */
  needsKey: boolean;
  /** True when it crams a word carrying no terminal punctuation into a
   *  near-fixed span, so single words arrive as mush while whole sentences are
   *  fine. Absent rather than false everywhere else, exactly as the catalogue
   *  states it.
   *
   *  It is carried rather than worked out here for the reason no field on this
   *  interface is worked out here: which model does this is the catalogue's
   *  answer, and the moment vorlaut decided it, a voice id would be written
   *  down in this repository and a second voice found to do the same would
   *  cost an edit in two places instead of none.
   *
   *  Wordless, like `quality` and AzureState's `code`. Whether to say anything
   *  about it, and in what words, is voiceRow()'s question. */
  rushesFragments?: boolean;
}

export interface VoiceList {
  voices: OfferedVoice[];
  /** What would speak if somebody pressed play now. */
  active: string;
  /** What layout.json says. The settings sheet opens on this one; between
   *  opening it and pressing Save the two can differ. */
  chosen: string;
  /** What to call `chosen`, worked out from the id alone.
   *
   *  For the row that shows a voice the layout still holds but this machine
   *  cannot offer - a key withdrawn, a model deleted, a layout carried over
   *  from another machine. That row used to print the raw id, and for an Azure
   *  voice the id is the one thing nobody chose it by: `azure:de-DE-Katja-
   *  Neural` where the sheet had said "Katja". The name has to come from here
   *  because the backend is where the naming rules are; the page has no way to
   *  turn an id into a name and should not learn one. */
  chosenLabel: string;
  backend: string;
}

/** Whether Azure answers for the stored key and region. `code` is for the
 *  text table to branch on - "unreachable" is a region that is not one (the
 *  hostname never resolves), "refused" is a live region rejecting the key,
 *  "failed" is anything else. The seam stays wordless; the page owns words. */
export interface AzureState {
  configured: boolean;
  ok: boolean;
  count: number;
  code: "" | "unreachable" | "refused" | "failed";
}
