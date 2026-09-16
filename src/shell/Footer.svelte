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
   */
  import { t } from "./live.svelte.js";
  import { outward } from "./links.js";
  import { showLegal } from "./legal.svelte.js";
</script>

<footer class="footer">
  <button class="linklike" id="aboutLink" type="button" onclick={() => showLegal("aboutPage")}>{t("ui.legal_about")}</button>
  <!-- Both of these are required to be reachable from every screen AND to be
       called exactly this. "Kontakt", or a paragraph inside the about dialog,
       would not count as either. -->
  <button class="linklike" id="impressumLink" type="button" onclick={() => showLegal("impressumPage")}>{t("ui.legal_impressum")}</button>
  <button class="linklike" id="privacyLink" type="button" onclick={() => showLegal("privacyPage")}>{t("ui.legal_privacy")}</button>
  <a id="sourceLink" href={outward(t("ui.legal_source_url"))} target="_blank" rel="noreferrer noopener">{t("ui.legal_source")}</a>
</footer>
