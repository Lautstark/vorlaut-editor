import { defineConfig, devices } from "@playwright/test";

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
const BASE = "/vorlaut-editor/";

/* The port, overridable, because reuseExistingServer is a trap between two
 * checkouts of this repository.
 *
 * Two worktrees running their suites at once share this port, and the second
 * one does not fail: it finds a server already answering and quietly tests the
 * *other* worktree's build. Every spec that asserts something new fails, and
 * every failure points at the wrong file. E2E_PORT is how a second checkout
 * gets a port of its own. */
const PORT = Number(process.env.E2E_PORT || 8802);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}${BASE}`,
    trace: "on-first-retry",
  },
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
    // --host pins it to 127.0.0.1. Without it vite preview binds IPv6 loopback
    // only, and Playwright's baseURL - which has to be a literal address, not a
    // name - never connects.
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
