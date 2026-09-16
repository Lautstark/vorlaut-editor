/* One key of the five: its picture, what it says, what it does, and hearing it.
 *
 * The frame is shell/sheet.svelte.ts's - the picture column with its search, the
 * foot with the destructive act on the left, and the promise that settles from
 * the presses rather than from `close` alone. What is here is the draft and the
 * two lists; what a key has on it is editor-diy/KeyRows.svelte.
 *
 * **Nothing is written until Fertig.** The sheet edits a draft and copies it
 * back on the confirming press, so every way out that is not that press costs
 * nothing. The tile wrote as you typed because it was always on screen and there
 * was nothing to dismiss.
 */
import { PAGE_KEY, actOf } from "../core/types.js";
import type { SlotAct } from "../core/types.js";
import { KEYS_PER_SET } from "../device/layout_facts.js";
import { t } from "../core/texts.js";
import { openSheet } from "../shell/sheet.svelte.js";
import type { Left } from "../shell/sheet.svelte.js";
import { dropdown, type Choice, type Dropdown } from "../shell/dropdown.svelte.js";
import KeyRows from "./KeyRows.svelte";
import {
  at, board, chosenAs, commit, mint, printsName, set, setName,
} from "./standing.svelte.js";

interface Draft { text: string; symbol: string; negated: boolean }

/** What the sheet holds while it is open, and what its rows read. Every
 *  question is a getter for the reason editor-app's is: `leads` is asked of the
 *  dropdown's answer, and that answer is a rune - so the rows follow it without
 *  a follow() that had to be called from three places. */
export interface KeySheet {
  draft: Draft;
  does: Dropdown;
  targets: Dropdown;
  readonly kinds: Choice[];
  readonly where: Choice[];
  readonly note: string;
  readonly leads: boolean;
  readonly speaks: boolean;
  /** The page's name as the placeholder on the panel the firmware prints it on,
   *  and only there. */
  readonly placeholder: string;
  /** The sentence under the field, which differs on that one seat. */
  readonly spokenNote: string;
  /** What ▶ would say. */
  readonly saying: string;
}

function openKeySheet(index: number): Promise<Left> {
  const layout = board();
  const sets = layout.sets;
  const entry = set();
  const slot = entry.slots[index]!;
  const held = actOf(slot);
  const draft: Draft = $state({
    text: slot.text, symbol: slot.symbol, negated: Boolean(slot.negated),
  });

  const kinds: Choice[] = (["word", "carry", "goto"] as const)
    .map((kind) => ({ value: kind, label: t(`ui.diy_does_${kind}`) }));
  const does = dropdown(chosenAs(held), () => {});

  /* Where the key already leads is where the list stands. Where it leads nowhere
   * - a page deleted since, which nothing in this change prevents - the list
   * stands on the page the key is on, and Fertig writes that. It is the fallback
   * editor-app states for a `goto` with no target: a navigating key is never
   * left pointing at nothing, because that exports as a key which does not
   * navigate at all, and the list said otherwise. */
  const where: Choice[] = sets.map((one, index$) =>
    ({ value: String(index$), label: setName(one, index$) }));
  const leadsTo = held.kind === "goto"
    ? sets.findIndex((one) => one.id === held.set) : -1;
  const targets = dropdown(String(leadsTo < 0 ? at() : leadsTo), () => {});

  const sheet: KeySheet = {
    draft, does, targets,
    get kinds() { return kinds; },
    get where() { return where; },
    get note() { return t(`ui.diy_does_${does.value}_note`); },
    get leads() { return does.value !== "word"; },
    get speaks() { return does.value !== "goto"; },
    /* **The name is the placeholder and not the value.** Leaving the field empty
     * has to go on meaning "say what the page is called", and filling the name
     * in would write that sentence onto the key: a page somebody only looked at
     * would come back out of Fertig carrying a word it never had. It would also
     * come loose - renaming the page afterwards would leave the typed copy
     * behind, still saying the old name with nothing on screen to say why. */
    get placeholder() { return printsName(index) ? entry.name.trim() : ""; },
    get spokenNote() {
      return printsName(index) ? t("ui.diy_set_spoken_note") : t("ui.diy_key_spoken_note");
    },
    get saying() {
      return draft.text.trim() || (printsName(index) ? entry.name.trim() : "");
    },
  };

  /** What the two lists come to, as an act.
   *
   *  The one place a set is given an id, and it happens on the press that writes
   *  the key which needed it - so a sheet somebody closes another way leaves the
   *  Sammlung exactly as they found it, ids included. See BoardSet.id. */
  const chosen = (): SlotAct => {
    if (does.value === "word") return { kind: "speak" };
    const to = sets[Number(targets.value)] ?? entry;
    to.id ??= mint();
    // Absent rather than false where the key only leads onward - SlotAct's own
    // note, and what keeps a key written before this existed byte-identical.
    return does.value === "carry"
      ? { kind: "goto", set: to.id, alsoSpeak: true }
      : { kind: "goto", set: to.id };
  };

  const keep = () => {
    /* Through a snapshot, for the reason editor-app's keep() gives: a record
       handed to a component is a proxy, and a proxy written into the layout is a
       proxy handed to structuredClone() and to IndexedDB. */
    const done = $state.snapshot(draft) as Draft;
    slot.text = done.text;
    slot.symbol = done.symbol;
    // Present only when it is true, never a stored false: an ordinary key goes
    // on being written exactly as it was before this field existed, so nothing
    // that has never been crossed out looks changed to changed.ts.
    if (done.negated) slot.negated = true;
    else delete slot.negated;
    // The same rule one field along, and the reason is the same one: absent is
    // what `speak` means, so a key nobody has given a second job to is written
    // as it always was.
    const act = chosen();
    if (act.kind === "speak") delete slot.act;
    else slot.act = act;
    commit();
  };

  return openSheet<KeySheet>({
    title: t("ui.diy_key_title"),
    pick: {
      symbol: draft.symbol,
      seed: draft.text,
      negated: draft.negated,
      /* Only fill a field that is still empty, never write over one somebody
       * typed: the symbol is called "zustimmen", but your key should say "Ja!".
       * The same rule editor-app keeps, and it has been this editor's since the
       * picker had it.
       *
       * The typed word before the collection's caption, which is the other half
       * of the same complaint: a search for "trinken" answered by a pictogram
       * filed under "Getraenk" wrote "Getraenk" onto the key. The caption is
       * still what fills it for a picture that was not searched for - an upload
       * has no word at all, and takes none. */
      onPick: (symbol, caption, typed) => {
        draft.symbol = symbol;
        const word = typed || caption;
        if (word && !draft.text.trim()) draft.text = word;
      },
      onNegate: (negated) => { draft.negated = negated; },
    },
    rows: KeyRows,
    state: sheet,
    /* Emptied and not deleted, and only where there is something to empty.
     * A slot is one of a fixed four and cannot go; what the button does is put
     * it back the way an untouched key is, which is why its label says so - see
     * ui.diy_key_clear. No question in front of it, for editor-app's reason:
     * what goes is one key on the set somebody is looking at, and putting it
     * back is one press in the cell it came from. */
    ...((slot.text || slot.symbol || slot.act) ? {
      remove: {
        label: t("ui.diy_key_clear"),
        onPress: (settle: () => void) => {
          slot.text = "";
          slot.symbol = "";
          // Putting a key back the way an untouched one is, and an untouched
          // key is not crossed out. A cross left behind on an empty key is
          // invisible - there is no picture under it - and comes back the
          // moment somebody picks the next picture.
          delete slot.negated;
          // An untouched key says its word, which is what no act at all means.
          // A key left leading onward with nothing on it is the one shape this
          // board can hold that nobody can see: no picture, no sentence, and a
          // press that changes the page.
          delete slot.act;
          settle();
          commit();
        },
      },
    } : {}),
    /* The sheet's one cost bought back. Five keys is a smaller run than a tablet
     * page of sixty-six, but it is still a run, and stopping at the last one
     * rather than wrapping is the same choice editor-app made: walking off the
     * end back to the first is a surprise. */
    ...(index + 1 < KEYS_PER_SET
      ? { next: { label: t("ui.diy_key_next"), onPress: keep } } : {}),
    done: { label: t("ui.done"), onPress: keep },
  });
}

/** The sheet, and then the next key's, for as long as somebody keeps pressing
 *  "next". */
export async function editKey(index: number): Promise<void> {
  for (let one = index; ; one += 1) {
    const how = await openKeySheet(one);
    if (how !== "next" || one + 1 >= KEYS_PER_SET) break;
  }
}

/* PAGE_KEY is imported for the seat question in standing.svelte.ts's
 * printsName(); it is named here only so that a reader looking for where the
 * placeholder rule comes from finds the constant rather than a number. */
void PAGE_KEY;
