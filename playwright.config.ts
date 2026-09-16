import { devices } from "@playwright/test";
import { playwrightConfig } from "@lautstark/toolchain/playwright";

/* The check whose absence let a page that rendered nothing ship green.
 *
 * It runs against the built site rather than the dev server, and under the base
 * a GitHub project site really uses. Both matter and neither is fussiness: a
 * dev server resolves things Vite's output does not, and serving from the root
 * would let an absolute path pass here and 404 once published.
 *
 * This string, package.json's test:e2e and package.json's build:pages are the
 * three places the repository name is written out literally. .github's
 * pages.yml derives it from the repository and follows a rename for free;
 * these three do not, and both of their failure modes are silent - a build
 * with no base renders an empty body with no error at all, and a wrong base
 * fetches the phonemizer from a prefix that 404s on the first spoken sentence,
 * which this suite cannot see because it stands that chunk in.
 */
const BASE = "/";

/* The port, overridable, because reuseExistingServer is a trap between two
 * checkouts of this repository.
 *
 * Two worktrees running their suites at once share this port, and the second
 * one does not fail: it finds a server already answering and quietly tests the
 * *other* worktree's build. Every spec that asserts something new fails, and
 * every failure points at the wrong file. E2E_PORT is how a second checkout
 * gets a port of its own. */
const PORT = Number(process.env.E2E_PORT || 8802);

/* The shape is @lautstark/toolchain/playwright's now - the built page served
 * by `vite preview` on a strict port, the desktop-and-phone split, the trace
 * on the first retry, `forbidOnly` on CI. Four things are passed back over it,
 * and each of them is a fact about this repository rather than a preference.
 *
 * **`projects`, for the names.** The base calls its two "desktop" and
 * "mobile"; this suite's have always been "chromium" and "mobile", and a
 * project's name is in the file name of every visual baseline it records
 * (`…-chromium.png`). Taking the base's names would orphan twenty committed
 * PNGs on both platforms, and the repair for that is to re-record - which is
 * exactly the thing a baseline exists to make impossible to do casually.
 *
 * **`locale`, unset.** The base asks for de-DE. This page reads its language
 * out of localStorage and then out of `navigator.language` (see CHOICE in
 * core/boot.ts), so a locale written here decides which of the two text tables
 * the baselines were recorded against - which is a change to what the pictures
 * are of, arriving as a line in a config file. Passed as undefined rather than
 * left out, because the base spreads its own `use` under whatever comes.
 *
 * **The timeout**, which the note below is about, and **`retries`**: this
 * suite has always run two on CI rather than the base's one, because
 * editor_app.spec.ts builds a whole Sammlung through the controls and is the
 * one file in the family that is genuinely slow.
 */

/* What one test is allowed to take, said out loud because the default is
 * smaller than what this suite's own helpers ask for.
 *
 * Playwright's 30s applies to the whole test, not to one action inside it, and
 * two helpers in e2e/sheets.ts already wait longer than that on their own:
 * exportForTalker() gives the download 45s and savePackage() gives the save
 * button 45s. Both were unreachable - the test died at 30s first, and whatever
 * call happened to be in flight when it did was reported as the failure. So a
 * timeout written in a spec meant nothing above 30s, which is worse than a
 * wrong number: it reads as a decision that was never in force.
 *
 * 90s rather than 45s because the wait is not the test. editor_app.spec.ts
 * builds a whole Sammlung through the controls before it exports one - two
 * pages, seven buttons, a grid reset and a voice, every one of them a real
 * press - so the 45s the export asks for starts from whatever that cost. On a
 * loaded machine the build alone measured 29.5s and the slowest test in the
 * file 52.7s, which is the spread this number is picked to clear rather than
 * a figure to hold anything to.
 *
 * A ceiling only bills what it stops, so this costs nothing where the suite is
 * already fast: CI runs the whole job in about three minutes and none of it
 * comes near this. What it buys is a machine under load finishing rather than
 * reporting a click that never landed - the failure this number was written
 * for looked like a hit-target check failing in a sheet, and was the clock.
 */
export default playwrightConfig({
  port: PORT,
  // --host pins it to 127.0.0.1. Without it vite preview binds IPv6 loopback
  // only, and Playwright's baseURL - which has to be a literal address, not a
  // name - never connects.
  host: "127.0.0.1",
  base: BASE,
  timeout: 90_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { locale: undefined },
  /* Two, the way both siblings have them. The phone is not a smaller desktop
     here: below 820px the sidebar is a layer over the work rather than a column
     beside it (conventions.md §3.1), and that arrangement has no coverage at
     all from a 1280px viewport. */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
  webServer: {
    // `npm run test:e2e` builds first; this only serves what that produced.
    command: `npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    // The base is baked into the bundle at build time and read from this same
    // variable, so the server has to be told it too or it serves the built
    // /vorlaut-editor/ page from the root and every asset 404s.
    env: { BASE_PATH: BASE },
    url: `http://127.0.0.1:${PORT}${BASE}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
