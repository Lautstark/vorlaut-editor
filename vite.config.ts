import { defineConfig } from "vite";
import { piperVendor } from "@lautstark/stimmquelle/vite";

/* A project site is served from /<repo>/, so the bundle needs that base.
 * For a user site (<user>.github.io) this would be "/".
 *
 * It is read from an environment variable rather than written here, because
 * the repository name is a fact about where it is published and not about the
 * code - the Pages workflow passes it. Locally it is "/", which is what
 * `npm run dev` and `npm run preview` serve from. */
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  /* Piper's runtime pieces, served from where the page is served.
   *
   * The four-file copy and the dev middleware that answers for them used to
   * stand here, with a long comment about arrival sizes and MIME types. Both
   * are stimmquelle's now: the same plugin ran in mitreden, and the traps it
   * had learned - checking a copy against its arrival size, walking
   * node_modules because onnxruntime-web publishes no `./dist/*` exports -
   * were the sort a second consumer rediscovers the hard way. `vendor/` is
   * still the directory, because piperRuntime() in backend/local.ts defaults
   * to the same name; the two are ends of one string. */
  plugins: [piperVendor()],
  build: {
    outDir: "dist",
    /* One page, which is why rollupOptions.input is not here.
     *
     * It was here, naming two: index.html for the editor and loader/index.html
     * for the page that takes an exported file to a talker. Vite's default
     * input is index.html alone, so a second entry point that is never named
     * simply is not built - the file sits in the repository, the page 404s on
     * Pages, and nothing anywhere says so. That is why it was written out
     * rather than left to the default.
     *
     * adr/0012 moved that second page to Lautstark/vorlaut-diy-talker, where
     * the firmware it serves already was, and this repository is back to one
     * page. Naming it explicitly would restate the default; what is worth
     * keeping is the reason the block existed, so that whoever adds a second
     * page here does not rediscover the silence.
     *
     * The base is the sharp edge and it is worth being exact about why it is
     * not one. Every path this page writes is absolute and rewritten by Vite
     * from `base` above - /icon.svg becomes /vorlaut-editor/icon.svg. What
     * must not appear anywhere is a repository name written out by hand, and
     * this repository has three places where one already is: package.json's
     * test:e2e and build:pages, and playwright.config.ts's BASE. Each is a
     * place a rename breaks in silence, and there is no gate for any of them.
     * tests/unit/reachable.test.ts is the one list that has to stay in step
     * with this file. */
    /* Vite's default target is a floor of browsers from 2020, which does not
       have top-level await - main.ts uses it to mount the page's structure
       before importing the module that wires it. Raising it is honest rather
       than a workaround: this app needs IndexedDB and the File System Access
       API for a METACOM folder, so a 2020 browser was never going to run it
       and pretending otherwise only shrank what the source could say.
       (WebSerial was on that list until adr/0012; the cable is served from
       Lautstark/vorlaut-diy-talker now and no page here opens a port.) */
    target: "es2022",
    // The board designer is one page; a sourcemap is what makes a stack trace
    // from a deployed copy readable, and it costs a file nobody downloads
    // unless they open the tools.
    sourcemap: true,
  },
  server: { port: 8801 },
  preview: { port: 8801 },
});
