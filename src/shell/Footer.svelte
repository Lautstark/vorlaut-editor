<script lang="ts">
  /* The three links every page of a German site has to carry, and the two that
   * say where this one comes from.
   *
   * Its own component rather than a line at the foot of the frame for the
   * reason it was its own template: it belongs to no feature. The board is the
   * thing being edited; this is the page saying who publishes it, which is a
   * different kind of statement and outlives any particular board.
   *
   * Buttons rather than anchors for the first three: what they open is a dialog
   * in this page, not another document, and a link that goes nowhere is a link
   * that offers a new tab and a copied address that lead somewhere else. The
   * labels arrive from the text table like every other label - see Legal.svelte
   * for why two of them are the same word in both languages.
   *
   * **The landmark is @lautstark/design/svelte/Footer's**, and nothing else is.
   * conventions.md §6.12: the shell is shared and every word in it is the
   * product's, so the links arrive as children, in this product's order and in
   * this product's words. What a footer may claim is governed by "prose that
   * denies must also disclose" (design.md §4.3), which is not a rule a shared
   * component can keep on a product's behalf.
   *
   * The links are deliberately not wrapped in anything. `text-align: center`
   * and the word space between them is what spaces them here, where bildhaft
   * puts its four in a `<p>` with a flex gap; a wrapper in the component would
   * have moved these two by ten pixels each, in a footer that is photographed
   * at a tolerance of zero.
   *
   * `credit` is left off. It is bildhaft's symbol-source attribution - a
   * licence condition that follows whichever source the open Sammlung uses -
   * and this page makes that statement inside the symbols panel instead, out of
   * bildquelle's own words. Left off rather than passed empty, though the two
   * are the same: the component draws no paragraph either way, which is the
   * point of it being a string.
   */
  import { t } from "./live.svelte.js";
  import { outward } from "./links.js";
  import { showLegal } from "./legal.svelte.js";
  import Footer from "@lautstark/design/svelte/Footer";
</script>

<Footer>
  <button class="linklike" id="aboutLink" type="button" onclick={() => showLegal("aboutPage")}>{t("ui.legal_about")}</button>
  <!-- Both of these are required to be reachable from every screen AND to be
       called exactly this. "Kontakt", or a paragraph inside the about dialog,
       would not count as either. -->
  <button class="linklike" id="impressumLink" type="button" onclick={() => showLegal("impressumPage")}>{t("ui.legal_impressum")}</button>
  <button class="linklike" id="privacyLink" type="button" onclick={() => showLegal("privacyPage")}>{t("ui.legal_privacy")}</button>
  <a id="sourceLink" href={outward(t("ui.legal_source_url"))} target="_blank" rel="noreferrer noopener">{t("ui.legal_source")}</a>
</Footer>
