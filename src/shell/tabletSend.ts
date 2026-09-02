/* The second place a finished app package can go: a tablet on the same wifi.
 *
 * Until now the file went to the Downloads folder and the rest was a cable, a
 * stick, or a share sheet. This is the other end of that walk - the editor
 * hands the bytes straight over while the tablet is listening. The receiving
 * half is in Lautstark/vorlaut-app and the two were built from one contract;
 * the contract is written out under "the wire" below, and neither half may
 * move it alone.
 *
 * ## This door belongs to the app package, and to nothing else
 *
 * exchange/SPEC.md §5.2 and adr/0010 keep three export functions apart - "a
 * different function, not the same one behind a flag" - and adr/0010 is
 * explicit that a shared helper is where a flag grows. That rule is about the
 * writers, and this module is not one; but the same reasoning decides where it
 * may be reached from, so it is written down here rather than left to be
 * rediscovered.
 *
 * **openTabletSend() takes bytes that are already written.** It cannot choose
 * a package, cannot name one, and has no way to ask for one - the caller has
 * the file before this is reachable at all. What it must never become is a
 * "send any export" helper with the target as an argument: that is the
 * one-door-three-shapes design §5.2 forbids, arrived at from the delivery end
 * instead of the writing end. The talker export writes symbols as references
 * and other AAC software opens it; the device export is a talker's own input
 * and goes to the page with the cable. Neither has a tablet to be sent to, and
 * a helper that could send either would be a helper that had to decide which.
 *
 * So: one caller, `openPackageExport()`'s ending in shell/packageExport.ts,
 * and tests/unit/layers.test.ts is what keeps it one.
 *
 * ## What was measured, and what it means for the code
 *
 * design's docs/mocks/README.md carries the measurements. Three of them decide
 * things here, and each one killed an implementation that would have looked
 * reasonable:
 *
 *  - **Mixed content does not stop this.** Chrome carves private addresses out
 *    of mixed-content blocking, so an https page may POST to one. The control
 *    - the same POST to a public http host - is refused outright. Nothing here
 *    has to work around a scheme.
 *  - **Private Network Access is not the mechanism**, and the header everything
 *    was once written around is dead. Chrome never sends
 *    `Access-Control-Request-Private-Network`, and a receiver that answers the
 *    matching header is treated exactly like one that does not. There is
 *    deliberately nothing PNA-shaped below.
 *  - **A permission is what decides it.** Local Network Access is PNA's
 *    successor and it is a user permission rather than a handshake. It answers
 *    `granted` in Chrome as it ships today; with the checks turned on it
 *    answers `prompt`, the request stalls until somebody clicks Allow, and a
 *    refusal fails with ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS. That
 *    refusal is the whole reason `refused()` exists.
 *
 * ## Two failures, two sentences, and they must never be one
 *
 * A browser that would not let the request out and a tablet that is not at
 * that number look identical on screen: nothing came back, either way. Their
 * fixes are opposite. One is a number to re-read off the tablet; the other is
 * a permission in the lock icon, with a number that was right all along.
 *
 * Somebody shown "is there a different one on the tablet?" after a refused
 * permission checks a correct number until they give up. So the two are told
 * apart before either sentence is chosen - by asking the permission, which is
 * the only thing that actually knows - and their feet differ as much as their
 * words do. A refusal keeps the typed numbers standing, because they are
 * right, and offers Speichern rather than another send: a second attempt meets
 * the same refused permission until it is taken back in the browser, and a
 * button that silently does nothing is worse than no button.
 *
 * **The refusal has never been seen outside a fixture, and that is worth
 * knowing rather than assuming.** On 2026-08-28 this path was run end to end
 * for the first time - a real editor on a laptop, the real app on a tablet, a
 * package arriving over the wifi - and the happy path worked, the remembered
 * address worked, `already_current` read as the success it is. None of that
 * touched the two sentences below. Chrome 151 as it ships answers `granted`
 * silently, so nothing was asked and nothing was refused: `ui.send_blocked`
 * has been drawn by e2e/send.spec.ts and by nothing else. A live 422 and a
 * live 413 are unseen for the same reason - the tablet accepted what it was
 * sent.
 *
 * So the half of this design that had the most care spent on it is the half
 * with the least evidence behind it. Exercising it deliberately costs one
 * session: run Chrome with `--enable-features=LocalNetworkAccessChecks` and
 * refuse the prompt, and the sentence, the standing address and the Speichern
 * foot are all right there to be looked at. Until somebody has, "it shipped"
 * is not "it was seen working", and this comment is here so that the two do
 * not get quietly conflated by whoever reads this next.
 *
 * That is also the rule for which failures offer another send at all. Exactly
 * one does - nothing at that number - and it is not a guess that a retry might
 * work: the four boxes are still there and still editable, so "send again" is
 * "send to the number I am about to fix". Every other failure came back *from*
 * a tablet, which means the number was right, which means the same request
 * would be the same request. Those offer Speichern.
 */
import { openDialog } from "./dialog.js";
import { status } from "./dom.js";
import { t } from "../core/texts.js";
import { readSettings, writeSettings } from "../backend/index.js";

/* --- the wire --------------------------------------------------------------
 *
 * `POST http://<address>:<port>/paket`, the raw package bytes as the body,
 * `Content-Type: application/zip`. 200 with an outcome, 422 refused, 413 too
 * large, 415 the wrong type. Shared with the receiver in vorlaut-app and
 * changed only by agreement with it.
 */

/** Where the tablet listens. Not typed by anybody: the person copies four
 *  numbers off a screen, and a port in a fifth box would be a question with
 *  one answer that can only be got wrong. It is the receiver's to change and
 *  this is the other half of that decision. */
const PORT = 8765;

/** The one route. The receiving half serves POST and OPTIONS on it and
 *  nothing else - in particular no GET, because a package that could be read
 *  back out of the viewer is the path §5.2 says must not exist. */
const ROUTE = "/paket";

/** The three things a 200 can say, all of them good. `already_current` is a
 *  success and not a near miss: the tablet has this package, which is what
 *  the person wanted, and it did not have to write it twice to say so. */
const ARRIVED = ["installed", "replaced", "already_current"];

/** What came back, in the shape the sheet needs it.
 *
 *  `refused` carries a code and never prose. The receiver answers
 *  `{"outcome":"refused","reason":"<code>","detail":"<prose>"}` and the detail
 *  is for a log rather than for a person: a sender that read the prose would
 *  be a sender coupled to the receiver's wording, which is the coupling the
 *  closed set of codes exists to prevent. So the code is shown as the token it
 *  is, beside a sentence this repository owns. */
type Answer =
  | { said: "arrived"; outcome: string; name: string }
  | { said: "refused"; code: string }
  | { said: "too_large" }
  | { said: "wrong_type" }
  | { said: "odd"; status: number }
  | { said: "nothing_there" }
  | { said: "blocked" };

/** Whether the browser is what stopped the request, rather than the number.
 *
 * `local-network-access` is not in the platform's PermissionName union, so the
 * descriptor is cast - the query is a string lookup at run time and answers
 * for a name the types have not caught up with.
 *
 * A browser that does not know the name at all answers by throwing, and that
 * is read as "not the permission": where Local Network Access is not
 * implemented, it cannot be what refused. The one case that reading gets wrong
 * is a Chromium that enforces the checks and offers no way to grant them -
 * Samsung Internet refuses in under half a second with no prompt at all - and
 * nothing either end can do rescues that, because there is no permission to
 * ask for. It matters only to somebody editing on a tablet, which is not what
 * this is for.
 */
async function refused(): Promise<boolean> {
  try {
    const answer = await navigator.permissions.query(
      { name: "local-network-access" } as unknown as PermissionDescriptor);
    // `prompt` counts with `denied`: a prompt that is still pending after the
    // request has already failed is a prompt somebody dismissed.
    return answer.state !== "granted";
  } catch {
    return false;
  }
}

/** A body that may not be there and may not be JSON. A tablet that answered
 *  at all has said the useful half in its status; nothing here should fail
 *  over a body it could not read. */
async function bodyOf(answer: Response): Promise<Record<string, unknown>> {
  try {
    return await answer.json() as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * One attempt, and everything that can come back from one.
 *
 * **There is deliberately no timer.** A number with nothing at it on a local
 * network fails at the first hop - no answer to the address resolution, or a
 * refusal from a machine that is there without anything listening - and both
 * arrive in seconds, which is what lets the sheet promise an immediate answer.
 * A timer short enough to be that promise would cut a package that is arriving
 * perfectly well: these are tens of megabytes over wifi, and the measurement
 * that says a small one lands in about two seconds says the same thing about a
 * large one taking a good deal longer.
 */
async function send(address: string, blob: Blob): Promise<Answer> {
  let answer: Response;
  try {
    answer = await fetch(`http://${address}:${PORT}${ROUTE}`, {
      method: "POST",
      headers: { "Content-Type": "application/zip" },
      body: blob,
    });
  } catch {
    // Both failures land here as the same TypeError, which is the whole
    // reason the permission is asked rather than the error read.
    return { said: await refused() ? "blocked" : "nothing_there" };
  }

  if (answer.ok) {
    const body = await bodyOf(answer);
    const outcome = String(body.outcome ?? "");
    return {
      said: "arrived",
      // A 200 whose body is unreadable is still a package that arrived: the
      // tablet took the bytes and said so with its status. What is lost is
      // which of the three words it was, and the sheet has a sentence for
      // exactly that.
      outcome: ARRIVED.includes(outcome) ? outcome : "",
      name: String(body.name ?? ""),
    };
  }
  if (answer.status === 413) return { said: "too_large" };
  if (answer.status === 415) return { said: "wrong_type" };
  if (answer.status === 422) {
    const body = await bodyOf(answer);
    return { said: "refused", code: String(body.reason ?? "") };
  }
  return { said: "odd", status: answer.status };
}

/* --- the four boxes ------------------------------------------------------ */

const OCTETS = 4;

/** The aria labels, written out one by one rather than built from an index.
 *  Four keys the text-usage check can see, which a template would hide. */
const NUMBERED = (): string[] => [
  t("ui.send_octet_1"), t("ui.send_octet_2"),
  t("ui.send_octet_3"), t("ui.send_octet_4"),
];

/** Whether one box holds a number an address can have in it. */
const octet = (text: string): boolean =>
  /^\d{1,3}$/.test(text) && Number(text) <= 255;

/** `a.b.c.d` split into four, or four empty strings for anything else. */
function split(address: string): string[] {
  const parts = address.split(".");
  if (parts.length !== OCTETS || !parts.every(octet)) {
    return Array<string>(OCTETS).fill("");
  }
  return parts;
}

interface AddressRow {
  root: HTMLElement;
  /** `a.b.c.d`, or "" while any of the four is empty or out of range. */
  value(): string;
  /** Where the caret starts: the last box on a return visit, the first on a
   *  first one. */
  start(): void;
  /** Run whenever what value() would answer may have moved. */
  onChange: () => void;
}

/**
 * Four boxes rather than one field.
 *
 * design's docs/mocks/senden.css makes the argument and it is pin.css's,
 * reused: one field with four numbers in it asks somebody to count what they
 * typed, and four boxes do not. This product's user has met that shape once
 * already, on the PIN. What the content forces is the difference - three
 * digits to a box, nothing masked, and two of the four allowed to go quiet.
 *
 * **Nothing is hard-coded, and that is a decision rather than an omission.**
 * All four are typed the first time. A Fritzbox hands out 192.168.178.x, most
 * other routers 192.168.0.x, and a home network on 10.x is ordinary; a first
 * half written into the product would work in most German houses and strand
 * the rest with no way back. What the return visit gets is not a prefix but a
 * memory: the two that rarely change step back to an outline so the eye lands
 * on the two that do, and they stay fields - focusable, editable, and awake
 * the moment anybody touches one.
 */
function addressRow(known: string): AddressRow {
  const parts = split(known);
  const root = document.createElement("div");
  root.className = "address-row";

  const labels = NUMBERED();
  const boxes: HTMLInputElement[] = [];
  for (let at = 0; at < OCTETS; at++) {
    if (at) {
      const dot = document.createElement("span");
      dot.className = "address-row__dot";
      dot.textContent = ".";
      root.append(dot);
    }
    const box = document.createElement("input");
    box.className = "address-row__box";
    box.type = "text";
    box.inputMode = "numeric";
    box.maxLength = 3;
    box.value = parts[at] ?? "";
    box.setAttribute("aria-label", labels[at] ?? "");
    // The first two are the ones a house keeps: a router hands out the same
    // half to everything on it, and only the tail moves between two visits.
    if (parts[at] && at < 2) box.dataset.known = "1";
    root.append(box);
    boxes.push(box);
  }

  const row: AddressRow = {
    root,
    value: () => {
      const held = boxes.map((box) => box.value);
      return held.every(octet) ? held.join(".") : "";
    },
    start: () => {
      const box = known ? boxes[OCTETS - 1] : boxes[0];
      box?.focus();
      box?.select();
    },
    onChange: () => {},
  };

  boxes.forEach((box, at) => {
    box.addEventListener("input", () => {
      // Typed rather than validated: a letter never appears in the box at all,
      // so there is nothing to be told off about afterwards.
      box.value = box.value.replace(/\D/g, "");
      if (box.value.length === 3 && at < OCTETS - 1) boxes[at + 1]?.select();
      row.onChange();
    });
    box.addEventListener("keydown", (event) => {
      /* The second way into the next box, and the one somebody uses without
       * being told: an address is copied the way it is written down, dots and
       * all.
       *
       * **It moves on only out of a box with something in it**, and that
       * condition is the whole of what makes the two ways get along. Three
       * digits have already moved the caret by the time the dot after them is
       * pressed, so a dot that always moved would skip the box it had just
       * arrived in - 192.168.178.42 typed straight through came out as three
       * numbers and an empty box, which is exactly the address nobody typed.
       * Swallowed rather than ignored, so a dot never lands in a box and is
       * then filtered out of it a keystroke later.
       */
      if (event.key === ".") {
        event.preventDefault();
        if (box.value && at < OCTETS - 1) boxes[at + 1]?.select();
      }
      // Backspace at the start of an empty box steps back, so that correcting
      // a number is one key held down rather than a click into each box.
      if (event.key === "Backspace" && !box.value && at > 0) {
        event.preventDefault();
        boxes[at - 1]?.select();
      }
    });
    // A number somebody has gone into is no longer a number they were told:
    // the quiet ones wake as soon as they are touched.
    box.addEventListener("focus", () => {
      delete box.dataset.known;
      box.select();
    });
  });

  // What is pasted is the whole thing, not a third of it. Anything that is not
  // four numbers falls through to the browser's own paste, which lands in one
  // box and is then filtered to digits by the input handler above.
  root.addEventListener("paste", (event) => {
    const text = event.clipboardData?.getData("text").trim() ?? "";
    const parts = text.split(".");
    if (parts.length !== OCTETS || !parts.every(octet)) return;
    event.preventDefault();
    boxes.forEach((box, at) => {
      box.value = parts[at] ?? "";
      delete box.dataset.known;
    });
    boxes[OCTETS - 1]?.select();
    row.onChange();
  });

  return row;
}

/* --- the sheet ------------------------------------------------------------ */

/** What the sheet is given: the bytes, and the other door out.
 *
 *  `save` is the export's own Speichern, handed in rather than rebuilt here -
 *  this module knows nothing about filenames, downloads, or which export it is
 *  finishing, and that is the point. It is offered wherever sending again
 *  cannot help. */
export interface Sending {
  blob: Blob;
  /** What the Sammlung is called here, for the sentence at the end of it. The
   *  tablet answers with the name it stored the package under and that is the
   *  one shown - it is the tablet's own reading of what just arrived - but a
   *  200 whose body could not be read still has a package in it, and this is
   *  the name that sentence falls back to. */
  name: string;
  save: () => void;
}

/**
 * Asks where the tablet is, and sends.
 *
 * Answers true when the package arrived, so that the sheet behind this one can
 * go with it: the file is on a tablet and there is nothing left to do with it.
 * Every other way out - a refusal, a wrong number, Abbrechen, Escape - answers
 * false, and false means the package is still only in this page and the door
 * that saves it is still standing.
 *
 * Settled from the acts rather than from the close event alone, which is the
 * rule confirmDialog() states at length in the shared dialog: a promise that
 * never settles is a button that did nothing, with nothing in the console.
 */
export async function openTabletSend(what: Sending): Promise<boolean> {
  const remembered = (await readSettings()).tabletAddress ?? "";

  const lead = document.createElement("p");
  lead.className = "send-lead";
  lead.textContent = t("ui.send_lead");
  // Only where it is news. On a return visit the boxes are already filled and
  // the line under them says where from, so this would be a sentence about
  // something that has already happened.
  lead.hidden = !!remembered;

  const label = document.createElement("span");
  label.className = "lbl";
  label.textContent = t("ui.send_address");

  const row = addressRow(remembered);

  const note = document.createElement("p");
  note.className = "address-row__note";
  note.textContent = t("ui.send_remembered");
  note.hidden = !remembered;

  const trouble = document.createElement("p");
  trouble.className = "notice bad";
  trouble.hidden = true;

  const cancel = document.createElement("button");
  cancel.className = "btn quiet";
  cancel.type = "button";
  cancel.textContent = t("ui.cancel");

  const go = document.createElement("button");
  go.className = "btn primary";
  go.type = "button";
  go.textContent = t("ui.send_go");

  const instead = document.createElement("button");
  instead.className = "btn";
  instead.type = "button";
  instead.textContent = t("ui.send_save_instead");
  instead.hidden = true;

  return await new Promise<boolean>((resolve) => {
    let settled = false;
    let running = false;

    const finish = (arrived: boolean) => {
      if (settled) return;
      settled = true;
      resolve(arrived);
      sheet.close();
    };

    const sheet = openDialog({
      title: t("ui.send_title"),
      body: [lead, label, row.root, note, trouble],
      footer: [cancel, go, instead],
      // Escape, the corner and a press outside all land here, and none of them
      // put a package on a tablet.
      onClose: () => finish(false),
    });

    cancel.onclick = () => finish(false);
    instead.onclick = () => { finish(false); what.save(); };

    // Nothing to send until four numbers say where. Disabled rather than
    // pressable-and-scolding: the boxes are what is incomplete and they are
    // the thing being looked at.
    const ready = () => { go.disabled = running || !row.value(); };
    row.onChange = ready;
    ready();

    /* Into the boxes, past the corner ✕ that showModal() would otherwise
       leave focus on. The last box on a return visit and the first on a first
       one, which is the same rule the two of them are drawn by: what is being
       asked for is the part that changes. */
    row.start();

    go.onclick = () => {
      if (running) return;
      const address = row.value();
      if (!address) return;
      running = true;
      // design.md §4.3: progress belongs to the control that started it, and
      // goes when the work does. No spinner and no bar - §4.2 closes the
      // motion budget at 130ms for colour and 220ms for size, and an
      // indeterminate loop is neither.
      go.disabled = true;
      go.textContent = t("ui.send_running");
      trouble.hidden = true;
      void arrive(address);
    };

    async function arrive(address: string): Promise<void> {
      const answer = await send(address, what.blob);
      running = false;
      go.textContent = t("ui.send_again");
      ready();

      if (answer.said === "arrived") {
        // Only now, and only here. An address that answered nothing is the one
        // worth not remembering: it would come back filled in on the next
        // visit, looking exactly like an address that had worked.
        await writeSettings({ tabletAddress: address });
        status(landed(answer.outcome, answer.name || what.name));
        finish(true);
        return;
      }

      trouble.textContent = wrong(answer);
      trouble.hidden = false;
      // The one failure where another send can land differently, because the
      // four boxes are still there to be corrected first. Everything else came
      // back from a tablet at that address, so the number is right and the
      // same request would be the same request - those offer the other door.
      const again = answer.said === "nothing_there";
      go.hidden = !again;
      instead.hidden = again;
      if (again) go.focus(); else instead.focus();
    }
  });
}

/** What the status line says once it is over there. */
function landed(outcome: string, name: string): string {
  const said = { name };
  if (outcome === "installed") return t("ui.send_installed", said);
  if (outcome === "replaced") return t("ui.send_replaced", said);
  if (outcome === "already_current") return t("ui.send_already", said);
  // A 200 nobody could read the body of. The bytes are over there, which is
  // the half worth saying; which of the three words it was is not.
  return t("ui.send_arrived", said);
}

/** The sentence for each way it did not.
 *
 *  Everything but the one that arrived, so that a way of failing added to
 *  Answer without a sentence to go with it is a compile error rather than a
 *  notice that says nothing. */
function wrong(answer: Exclude<Answer, { said: "arrived" }>): string {
  switch (answer.said) {
    // The two that look the same on screen and are told apart by asking the
    // permission. Nothing in this pair may ever be merged into one sentence.
    case "nothing_there": return t("ui.send_none");
    case "blocked": return t("ui.send_blocked");
    // A code rather than the receiver's prose, and shown because it is the one
    // thing support can be told over a telephone.
    case "refused": return answer.code
      ? `${t("ui.send_refused")} (${answer.code})`
      : t("ui.send_refused");
    case "too_large": return t("ui.send_too_large");
    case "wrong_type": return t("ui.send_wrong_type");
    default: return t("ui.send_odd", { status: answer.status });
  }
}
