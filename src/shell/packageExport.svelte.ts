/* The two exports that have to speak before they can be written, and the wait
 * in front of each.
 *
 * Each export is one call into backend/. What is here is the sheet around it,
 * and it exists because of a number: every distinct sentence in a Sammlung is
 * synthesised before it can be packaged, and each is a piper inference or a
 * round trip to Azure. A full tablet Sammlung - six pages of a 6x11 grid - is
 * on the order of four hundred of them, which is minutes, and a page that says
 * one thing at the start and nothing after is indistinguishable from a page
 * that has died. A talker Sammlung is at most twenty, which a status line once
 * covered; it does not any more, and that is adr/0011's doing. The device
 * export used to be instant because it copied a build that had already been
 * paid for, and there is no build here now - it speaks for itself, like the
 * other one.
 *
 * So: what is about to happen, then a count while it happens, then a way to
 * stop.
 *
 * **One sheet, two doors, and the difference matters.** exchange/SPEC.md §5.2
 * requires the *exports* to be separate entry points - "a different function,
 * not the same one behind a flag" - and adr/0010 is emphatic that no helper
 * may cross that line, because a shared helper is where a flag grows. A
 * progress dialog is not one of those helpers: it knows a count and a word,
 * never a picture or a licence, and each caller below names its own door. What
 * would be forbidden is a `run` that decided between the two.
 *
 * **That rule is what shaped the ending as well.** Where a written file goes
 * is now a different question for each export - the app package can be sent to
 * a tablet, and nothing else here can - so the sheet stopped answering it. It
 * no longer downloads anything and no longer knows a filename; each export
 * ends itself. Which keeps the one thing that must not exist from being
 * writable at all: a send that takes a package as an argument. See
 * shell/tabletSend.svelte.ts, and tests/unit/layers.test.ts for the check that only
 * this file may reach it.
 *
 * In the shell rather than in either editor, because both targets export a
 * package. A talker Sammlung goes to a tablet through exactly this path - that
 * is what vorlaut-app's BuilderPackageTest opens - so the sheet cannot belong
 * to the editor that happens to be on screen.
 */
import type { Component } from "svelte";
import { openParts } from "./parts.js";
import { status } from "./dom.js";
import ExportBody from "./pieces/ExportBody.svelte";
import ExportFoot from "./pieces/ExportFoot.svelte";
import PackageEnding from "./PackageEnding.svelte";
import PackageDoors from "./PackageDoors.svelte";
import DeviceEnding from "./DeviceEnding.svelte";
import { reason } from "../core/errors.js";
import { t } from "../core/texts.js";
import { exportAppPackage, exportDevicePackage } from "../backend/index.js";
import type { PackageProgress } from "../backend/local.js";
import { openTabletSend } from "./tabletSend.svelte.js";
import { download } from "@lautstark/werkzeuge/download";

/** One export, as the sheet needs to know it.
 *
 * `write` is the door, handed in rather than chosen here: that is the whole of
 * what keeps this file on the right side of §5.2. It answers null for
 * "somebody stopped it", which is a decision rather than a failure.
 */
interface Offered {
  title: string;
  /** What is about to happen, before the press. */
  lead: string;
  go: string;
  write(
    onProgress: (at: PackageProgress) => boolean | void,
  ): Promise<{ blob: Blob; missing: number } | null>;
  /** The status line afterwards, given how many pictures resolved to nothing. */
  told(missing: number): string;
  /**
   * What the sheet becomes once the bytes exist.
   *
   * **The export's own last step, and deliberately not the sheet's.** This was
   * one line of text under a file the sheet had already handed to the browser,
   * and the handing over was the sheet's: one path, because there was one thing
   * a package could be. That stopped being true the moment a package could go to
   * a tablet, and where a file goes is precisely what an export must answer for
   * itself - so the download moved out of here and into the two endings, and
   * this file no longer knows a filename.
   *
   * `doors` are the ways on from here, in the foot after the one that dismisses
   * it. An ending with none is one whose file has already gone somewhere.
   *
   * A different sense of the word from §5.2's, and worth saying in a file that
   * uses both: these are buttons, and which package was written was settled two
   * steps ago by which of the three export functions was called.
   */
  ending: Component<{ s: Exporting }>;
  doors?: Component<{ s: Exporting }>;
  /** What the two doors of the app package's ending do. Absent on the export
   *  that has none. */
  save?(): void;
  send?(): Promise<boolean>;
}

/** A written package, before anybody has said where it goes. */
interface Made {
  blob: Blob;
  missing: number;
}

/** What the sheet is holding while it is open. */
export interface Exporting {
  readonly what: Offered;
  /** The Sammlung's name, which the ending says back. */
  readonly name: string;
  /** What is about to happen, then the count while it happens. */
  line: string;
  /** The bytes, once there are any. Null is "not yet", which is what the body
   *  and the foot both read to know which of the two steps they are drawing. */
  made: Made | null;
  running: boolean;
  start(): void;
  stop(): void;
  dismiss(): void;
  save(): void;
  send(): Promise<boolean>;
}

/**
 * Opens the sheet, and writes the package if somebody presses the button.
 *
 * Two steps in one dialog, which does not close between them: what is about to
 * be written, then the writing. The sheet then stays up and hands over to the
 * export's own ending, because with two possible destinations there is always
 * something left to say - which of them, or where the file that has already
 * gone is to be taken next.
 *
 * The sheet used to close itself when an export had nothing to add, and that
 * shape has gone with the automatic download it was the other half of. It was
 * right while a package could only ever land in the Downloads folder: a sheet
 * that has to be dismissed after a file has already been handed over is a click
 * that says nothing.
 */
function openExport(what: Offered, name: string): () => void {
  // Set by the confirming press and read by the progress callback, which is
  // called from inside the export loop. A module-level flag would leak between
  // two sheets; this one dies with the closure.
  let stopped = false;

  const sheet: Exporting = $state({
    what,
    name,
    line: what.lead,
    made: null,
    running: false,
    start() {
      if (sheet.running) return;
      sheet.running = true;
      void write();
    },
    stop() { stopped = true; made.close(); },
    dismiss() { made.close(); },
    save() { what.save?.(); },
    send() { return what.send?.() ?? Promise.resolve(false); },
  });

  const made = openParts<Exporting>({
    title: what.title,
    state: sheet,
    body: ExportBody,
    foot: ExportFoot,
    // Closing the sheet mid-run is the same act as pressing Abbrechen, and it
    // has to be, or the corner ✕ would leave a loop running against a dialog
    // nobody can see - which is the shape of the hang design.md §3.4 warns
    // about, arrived at from the other end.
    onClose: () => { stopped = true; },
  });

  return () => made.close();

  async function write(): Promise<void> {
    try {
      const done = await what.write((at) => {
        if (stopped) return false;
        sheet.line = at.total === 0 || at.done === at.total
          ? t("ui.package_packing")
          : t("ui.package_speaking", { done: at.done + 1, total: at.total });
        return true;
      });
      // null is somebody having stopped it, which is a decision rather than a
      // failure. Nothing was written and nothing is said beyond saying so.
      if (!done) {
        made.close();
        status(t("ui.package_stopped"));
        return;
      }
      // Missing pictures are worth a sentence rather than a refusal: the
      // package works, and the usual cause is a METACOM folder this browser
      // has not been given back yet.
      status(what.told(done.missing));
      sheet.running = false;
      sheet.made = done;
    } catch (error) {
      made.close();
      status(t("ui.collection_export_failed", { error: reason(error) }));
    }
  }
}

/** The Sammlung as the package the Android viewer opens.
 *
 * **Two doors at the end of it, where there used to be none.** The file was
 * downloaded the moment it existed and the sheet closed itself, which was the
 * right shape for a step with one possible outcome. There are two now - the
 * Downloads folder, or a tablet on the same wifi - and a question cannot be
 * answered by doing one of the two before it is asked. Sending would otherwise
 * leave a stray zip behind every single time.
 *
 * **The cost is one press, and it is paid by the person who only ever saves.**
 * That is the whole of the trade and it was argued before it was built; the
 * mock in design's docs/mocks/vorlaut-senden.html states it in its own copy
 * rather than hiding it. The alternative - keep the automatic download and add
 * a send button beside it - buys that press back by making every send litter,
 * which is the thing the tablet route exists to stop.
 *
 * The send door is this export's alone. exchange/SPEC.md §5.2 and adr/0010
 * keep the three writers apart, and shell/tabletSend.svelte.ts's own header carries
 * the reason that reaches the delivery end too: the talker export and the
 * device export have no tablet to go to, and a helper that could send either
 * would be a helper that had to decide which.
 */
export function openPackageExport(name: string, stem: string): void {
  // .zip rather than .obz, and only on this export. Chrome on Android goes by
  // the blob's media type for an unregistered extension, so a file declared
  // application/zip and named .obz is one the download manager will not take —
  // the package never reaches the tablet it was made for. The bytes are
  // unchanged and the viewer never looks at a filename, so the rename costs
  // nothing it can see. exchange/SPEC.md §2 says which of the two an importer
  // goes by. The two exports beside this one keep .obz: other AAC software
  // looks for that extension, and the talker's is read by a page that takes
  // whatever it is given.
  const filename = `${stem}-app.zip`;
  /* Held rather than passed, because the two doors that use it are drawn after
     the bytes exist and the object they read is made before. `sheet.made` holds
     the same blob; this is the name for it that says what save() is for. */
  let written: Blob | null = null;
  let close: () => void = () => {};
  /* Speichern hands the file over and then takes the sheet away, because there
   * is nothing left on it: the package exists, it has gone where somebody said,
   * and a sheet that has to be dismissed after that is a click that says
   * nothing. Both doors run this one - the button in the foot here, and the
   * "save it instead" the send sheet offers when a retry cannot help - so the
   * two cannot come apart. */
  const save = () => {
    if (written) download(written, filename);
    close();
  };
  close = openExport({
    title: t("ui.package_title"),
    lead: t("ui.package_lead", { name }),
    go: t("ui.package_go"),
    write: async (onProgress) => {
      const done = await exportAppPackage(onProgress);
      written = done ? done.blob : null;
      return done;
    },
    told: (missing) => missing
      ? t("ui.collection_exported_app_gaps", { n: missing })
      : t("ui.collection_exported_app"),
    ending: PackageEnding,
    doors: PackageDoors,
    save,
    send: async () => {
      if (!written) return false;
      return openTabletSend({ blob: written, name, save });
    },
  }, name);
}

/** The page that takes an exported file to a talker, in the other repository.
 *
 * **Written out, and that is the change the split made.** This was built from
 * import.meta.env.BASE_URL while the two pages came out of one deployment, so
 * that a rename could not break it in silence - the argument the literal base
 * paths in package.json and playwright.config.ts are the counter-example to.
 * That reasoning does not survive the move: the page is served from
 * Lautstark/vorlaut-diy-talker now, and a relative URL off this site's base
 * points at a path that does not exist here.
 *
 * The address is safe to hard-code for the one reason that decided which half
 * leaves. The talker keeps the repository it is named for, and the loader page
 * takes that site's root once the editor is gone, so there is no rename
 * underneath this - which is exactly what this repository's own address no
 * longer has. Note it is the site's root and not the `loader/` under it.
 *
 * This is the only crossing on the split's bill whose breakage a carer sees
 * rather than a test, and there is no gate for it.
 */
export const TALKER_PAGE = "https://lautstark.github.io/vorlaut-diy-talker/";

/** The Sammlung as the talker's own package, and where to take it.
 *
 * The hand-off is the reason this one keeps its sheet open. Everything before
 * it happens on this page and the last step does not: the file is on somebody's
 * disk and the talker is on the table, and the page that joins the two is a
 * second address they have no reason to know. A link, at the moment the file
 * exists, is the whole of what stands between "exported" and a device.
 */
export function openDeviceExport(name: string, stem: string): void {
  void openExport({
    title: t("ui.device_export_title"),
    lead: t("ui.device_export_lead", { name }),
    go: t("ui.device_export_go"),
    write: async (onProgress) => {
      const done = await exportDevicePackage(onProgress);
      // Unasked, and it stays unasked: this file has one place to go and the
      // sentence the ending carries is that place. The question the app package
      // now puts is a question because that one has two answers, and there is no
      // tablet at the end of a talker's file for a second door to lead to.
      if (done) download(done.blob, `${stem}-device.obz`);
      return done;
    },
    told: (missing) => missing
      ? t("ui.collection_exported_device_gaps", { n: missing })
      : t("ui.collection_exported_device"),
    ending: DeviceEnding,
  }, name);
}
