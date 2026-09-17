<script lang="ts">
  /* The whole page: the Sammlungen down the side, and the one being worked on
   * in the middle.
   *
   * What is left over belongs to no device: the save conflict, which is about
   * two tabs writing to one store, and the hidden file input that lets the
   * settings sheet open a file dialog without a visible control. There were two
   * of those; the other was the symbol picker's, and a sheet's picture column
   * now makes its own rather than reaching for a shared one here.
   *
   * Below 820px the sidebar is a layer over the work rather than a column
   * beside it, and something has to open it - that is the `.topbar`, which is
   * the same bar both siblings have. conventions.md §3.1.
   *
   * The three dialogs sit at the end and take no room at all while they are
   * closed, so where they are in the flow decides nothing. There were four
   * places markup was mounted from before this - a frame, a footer, and three
   * sheets, each `innerHTML` into the document and then filled in by a module
   * that looked its elements up by id - and this file is the shape that
   * replaced all of them: one tree, drawn from one place, with every label read
   * out of the text table where it is drawn. adr/0025.
   */
  import { t } from "./live.svelte.js";
  import { useEditorHole } from "./holes.js";
  import { closeDrawer, columnOpen, drawerOpen, openDrawer, showColumn } from "./sidebar.svelte.js";
  import { HOME_TONES } from "./homekey.js";
  import { takeBoardFile, useBoardFile } from "./settings.svelte.js";
  import Sidebar from "./Sidebar.svelte";
  import Scrim from "@lautstark/design/svelte/Scrim";
  import Reveal from "@lautstark/design/svelte/Reveal";
  import TopBar from "@lautstark/design/svelte/TopBar";
  import WorkHead from "./WorkHead.svelte";
  import Conflict from "./Conflict.svelte";
  import Footer from "./Footer.svelte";
  import Legal from "./Legal.svelte";
  import SettingsSheet from "./SettingsSheet.svelte";
  import CollectionSheet from "./CollectionSheet.svelte";

  /* The logo lives in public/, so Vite copies it verbatim. BASE_URL is what the
     build's `base` resolves to - "/" while developing and "/vorlaut-editor/"
     once published - so this is the same rewriting Vite does inside
     index.html, done by hand in the one place the bundler cannot reach. */
  const logo = `${import.meta.env.BASE_URL}icon.svg`;

  let hole: HTMLElement;
  let boardFile: HTMLInputElement;

  /* Whether the Sammlungen are on screen at all, with the live breakpoint
     already applied - the drawer below 820px, the remembered column above it.
     The sidebar works it out because it is the one thing subscribed to that
     breakpoint; the bar and the reveal are mounted out here and are handed the
     answer rather than each computing it from a `narrow()` read at the moment
     of a press, which is what all three products used to do and what left
     whatever was announced before the press stale. */
  let showing = $state(false);

  $effect(() => {
    useEditorHole(hole);
    useBoardFile(boardFile);
  });

  /* The column's answer, on the element the stylesheet asks about. `.collapsed`
     is on <body> because the grid it changes is `.frame`'s and the reveal
     beside it is a sibling - two rules keyed off one ancestor, which is what
     the class was before this and is why it is not a prop. */
  $effect(() => {
    document.body.classList.toggle("collapsed", !columnOpen());
  });
</script>

<!-- Narrow screens get a bar instead of a column: the sidebar slides over the
     work rather than sitting above it, and the scrim closes it. Both siblings
     have exactly this, at exactly this width, which is why the bar is
     `@lautstark/design/svelte/TopBar` and owns the breakpoint itself - a
     product keeping its own `@media { .topbar { display: flex } }` would lose
     to the component's scoped base rule and get a bar that never appears.
     The ☰ is the component's, because all three bars have exactly one control,
     first, with the same class, the same tier and the same job. Only what is
     between its tags is a snippet, and this page passes none: `☰` is the
     default and is the character that was here. -->
<!-- The two that dismiss and the two that reveal, each pair sharing a word:
     ‹ and ✕ both put the Sammlungen away, ☰ and › both bring them back. Which
     one is on screen is a question about the width, not about the words. -->
<TopBar buttonId="sidebarOpenBtn" controls="sidebar" expanded={showing}
  label={t("ui.collections_show")} title={t("ui.collections_show")} onreveal={openDrawer}>
  {#snippet brand()}<h1><img src={logo} alt="" class="logo" />vorlaut</h1>{/snippet}
</TopBar>
<!-- A `<button aria-label>` where this was a `<div role="presentation">`, which
     is §6.3's one deliberate change of element here: bildhaft already had the
     button, mitreden argues for the div, and one of the three had to move. What
     it costs is nothing on screen and what it buys is a way out a keyboard can
     reach. The component carries a `border: 0` reset with it, because a
     `<button>` at `inset: 0` otherwise picks up the user agent's two-pixel
     outset frame around the whole viewport - and no test in this family would
     have caught that, because the one that exists clicks a position.
     `drawerOpen()` rather than `showing`: above the breakpoint `showing` is the
     column being there, and there is nothing to dismiss. -->
<Scrim id="scrim" label={t("ui.collections_hide")} shown={drawerOpen()} ondismiss={closeDrawer} />

<div class="frame">
  <Sidebar {logo} bind:showing />

  <!-- What brings the column back once it is put away. It floats where the
       sidebar was, carrying the mark, which is where both siblings put it and
       where the eye is already looking - so the component is the container and
       the pair inside it is this page's, handed the wiring for its button. It
       drops itself below 820px, for TopBar's reason turned round: down there
       the bar's ☰ is the way back and this would be a second mark beside the
       one already in it. -->
  <Reveal id="sidebarShow" controls="sidebar" shown={!showing}>
    {#snippet brand(wired: { "aria-controls": string | undefined; "aria-expanded": boolean })}<button id="sidebarShowBtn" class="btn quiet icon" type="button" {...wired} title={t("ui.collections_show")} aria-label={t("ui.collections_show")} onclick={() => void showColumn(true)}>›</button><img src={logo} alt="" class="logo logo--small" />{/snippet}
  </Reveal>

  <div class="content">
    <WorkHead />

    <main>
      <Conflict />

      <div bind:this={hole} id="editor"></div>

      <input bind:this={boardFile} type="file" id="boardFile" accept=".obf,.obz,.json,application/zip,application/json" hidden onchange={() => void takeBoardFile()} />

      <Footer />
    </main>
  </div>
</div>

<!-- The one piece of drawing on this page a stylesheet cannot express.
     The CSS filter property has no colour matrix, and the nearest shorthand -
     invert(1) - is not this map and looks wrong: it takes the white inside the
     house to pure black, which on a dark key reads as a hole cut through it.
     So the map is an SVG filter, defined once here and named by ui.css.

     color-interpolation-filters="sRGB" because the default is linearRGB, and
     the numbers are a map between the colours as they are written rather than
     between their linear energies - left to the default, the strokes come out
     visibly dark of the tone that was chosen.

     Mounted with the frame rather than with the sheet that uses it: an SVG
     filter is referenced by id from anywhere in the document, and one that came
     and went with a dialog would be a picture that renders correctly only while
     something else is open. Zero-sized and aria-hidden - there is nothing here
     to see or to read, only something to point at. -->
<svg class="filters" aria-hidden="true" focusable="false">
  <filter id="homeTone" color-interpolation-filters="sRGB">
    <feColorMatrix type="matrix" values={HOME_TONES.matrix.join(" ")} />
  </filter>
</svg>

<SettingsSheet />
<CollectionSheet />
<Legal />
