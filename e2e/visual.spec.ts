import { expect, test, type Locator, type Page } from "@playwright/test";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { openBoard } from "./diy.js";
import { openPanel, openSettings } from "./sheets.js";

/* What the settings surfaces look like, held against a picture of themselves.
 *
 * Every other spec in here asserts behaviour: a press does a thing, a choice
 * survives a reload, a file comes out the other end. None of them would notice
 * a rule that stopped applying - a panel losing its spacing, a status line
 * losing its dot, a button losing the outline that says it is destructive. The
 * suite would stay green over a sheet nobody could read.
 *
 * That gap is about to matter. The CSS these three surfaces are drawn with is
 * moving out of this repository and into @lautstark/design, where the four
 * programmes share it. A move like that is meant to change nothing at all, and
 * "nothing at all" is precisely the claim that prose cannot make and a picture
 * can. So this file is the before: recorded now, committed, and compared
 * against afterwards.
 *
 * The middle test is the one the move is about. #whereBox and #folderBox are
 * not this repository's markup at all - they are built by
 * @lautstark/sicherung's two panel builders and styled from outside, which
 * makes them the two boxes most likely to shift when the stylesheet they
 * depend on changes address.
 *
 * Each test screenshots the panel rather than the page. A full-page shot of a
 * modal sheet is mostly the scrim over a board that has nothing to do with any
 * of this, and it fails on any change to the board behind - which is a false
 * alarm in a file whose entire value is that its alarms are true.
 */

/* Where the baselines are, and the one condition under which this file has
 * nothing to say.
 *
 * Playwright files a snapshot per project and per platform, and the images say
 * so in their own names, because text is not rasterised the same way on two
 * operating systems. A machine with no baseline of its own cannot compare
 * anything: it would write its own picture and pass, which is worse than no
 * check at all - a green tick for a comparison that never happened.
 *
 * So the guard asks the snapshot directory whether a picture exists for the
 * platform this run is on, rather than naming a platform outright. It named
 * darwin once, and that spelling had to be edited by hand on the day Linux
 * baselines arrived - a switch somebody has to remember to flip is a switch
 * that stays where it is. Recording a baseline on a new platform and
 * committing it is now the whole of turning the comparison on there:
 *
 *   npx playwright test e2e/visual.spec.ts --update-snapshots
 *
 * .github/workflows/baselines.yml is how the Linux pictures are recorded on
 * the very runner that will later compare them.
 */
const SNAPSHOTS = fileURLToPath(new URL("./visual.spec.ts-snapshots", import.meta.url));

function recordedHere(): boolean {
  if (!existsSync(SNAPSHOTS)) return false;
  return readdirSync(SNAPSHOTS).some((name) => name.endsWith(`-${process.platform}.png`));
}

/* The empty pattern is Playwright's requirement, not a slip: it reads the
   destructuring to work out which fixtures a hook wants, and this one wants
   none of them - only the run's own settings, which arrive beside it. */
test.beforeEach(async ({}, testInfo) => {
  /* 'missing' and 'none' are the modes that only ever compare; 'all' and
     'changed' are the ones that write, and a run that is here to write must
     not skip itself out of ever producing a first baseline. */
  const recording = testInfo.config.updateSnapshots === "all"
    || testInfo.config.updateSnapshots === "changed";
  test.skip(!recording && !recordedHere(),
            `no baseline for ${process.platform} - record one with --update-snapshots`);
});

/* Everything about the window that a picture depends on, pinned.
 *
 * The height is the one number here that was measured rather than chosen. The
 * sheet is a modal whose body scrolls, and at an ordinary 900 the data panel
 * is half a head taller than the sheet that holds it - so the shot of it was
 * partly the page *behind* the sheet, and the overlays that paint out the
 * varying lines landed a scroll offset away from the lines they were painting
 * out. A window this tall lets the sheet draw its whole self, which makes an
 * element shot exactly that element and nothing else.
 *
 * The other three are not about size at all, and each of them was a
 * machine-dependent baseline waiting to happen: the page reads the browser's
 * language and would come up German on a German laptop, it follows the
 * device's colour scheme and would come up dark on a machine that is, and any
 * date it ever draws would be drawn in whatever zone the runner sits in. */
test.use({
  viewport: { width: 1280, height: 1500 },
  deviceScaleFactor: 1,
  locale: "en-US",
  colorScheme: "light",
  timezoneId: "UTC",
});

/* The parts that are about this machine rather than about the design, painted
 * over before the comparison.
 *
 * Named per surface rather than as one list for all three, and that is not
 * tidiness. A mask is measured against the page, not against the element being
 * shot, and an element inside a folded <details> is measured anyway - it is
 * reported at a position it does not occupy, and the overlay lands there. One
 * such entry, the symbol source's folder line, painted a bar straight across
 * the folder tree in the data panel: a mask that hid a thing worth checking,
 * to cover a thing that was not on screen. So each list holds only what its
 * own picture actually shows.
 *
 * A mask is a loss either way - whatever is under it stops being checked - so
 * each entry has to name something a second machine, or a second week, would
 * legitimately draw differently. */

/** In the sheet as it opens, every panel but the first is folded away, so the
 *  one changing thing on it is a count in a heading: how many voices this
 *  computer happens to have. Seven on this laptop, three on a fresh container,
 *  and none of it a fact about the stylesheet. */
const voiceCount = (page: Page): Locator[] => [page.locator("#voicesHereState")];

/** In the data panel, three lines, each of them written at run time.
 *
 * The first two are the shared boxes' own status lines and are addressed by
 * the class names @lautstark/sicherung gives them rather than by an id this
 * repository owns: the store's box names the folder everything is in, the
 * backup's line says how long ago it last wrote and into what. The third is
 * where an import or an export reports what it did, and how many of them.
 *
 * The first two reach for the words inside the box rather than the box. That
 * is the whole point of masking narrowly here: the box around the store's line
 * and the coloured dot beside the backup's are drawn from the very stylesheet
 * that is about to move house, and covering them would leave this picture
 * blind to the one change it exists to catch. */
const dataLines = (page: Page): Locator[] => [
  page.locator("#whereBox .where b"),
  page.locator("#folderBox .standing > span:nth-child(2)"),
  page.locator("#dataState"),
];

test("the settings sheet, as it opens", async ({ page }) => {
  await openBoard(page);
  const sheet = await openSettings(page);
  /* No panel is opened first. The sheet decides for itself which one is
     unfolded on arrival - language, and settings.ts has an argument for why -
     and a test that opened one would be recording a state nobody arrives in. */
  await expect(sheet).toHaveScreenshot("settings-sheet.png", { mask: voiceCount(page) });
});

test("the data panel, unfolded", async ({ page }) => {
  await openBoard(page);
  await openSettings(page);
  await openPanel(page, "#dataPanel");
  const panel = page.locator("#dataPanel");
  /* Both shared boxes drawn before the picture is taken. Neither is in the
     markup: wireData() builds them at startup and appends them, so an
     assertion on the panel alone would be satisfied by a panel with two empty
     divs in it - which is exactly the state a broken import leaves behind, and
     exactly the picture that would then be recorded as correct. */
  await expect(panel.locator("#whereBox .where-panel")).toBeVisible();
  await expect(panel.locator("#folderBox .backup-panel")).toBeVisible();
  await expect(panel).toHaveScreenshot("data-panel.png", { mask: dataLines(page) });
});

test("the deletion panel, unfolded", async ({ page }) => {
  await openBoard(page);
  await openSettings(page);
  await openPanel(page, "#dangerPanel");
  const panel = page.locator("#dangerPanel");
  // The one button in the product drawn as destructive, so what this picture
  // is really holding is that it still looks unlike the others.
  await expect(panel.locator("button.destructive")).toBeVisible();
  // No mask at all: a heading, a sentence and a button, none of them written
  // at run time. Masking here on principle would only hide the panel.
  await expect(panel).toHaveScreenshot("danger-panel.png");
});
