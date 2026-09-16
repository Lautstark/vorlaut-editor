<script lang="ts">
  /** A stored symbol, drawn, or the sentence that says why it is not here.
   *
   * `symbolInto()` resolves the reference and fires an `error` event on the
   * image where it cannot - a METACOM folder that is not connected, a file this
   * browser's store does not hold - and every drawing of a symbol in this
   * product made the same reading of that: replace the picture with a sentence
   * that points at the right remedy. That was three copies of one rule, in the
   * sheet's preview and in both editors' cells; it is one component now, and
   * Missing.svelte is still where the two remedies are told apart.
   *
   * `failed` holds the reference that failed rather than a flag, which is what
   * lets a different picture be tried without anything resetting anything: a
   * new symbol is not the one that failed, so the image comes back by itself.
   *
   * **And a redraw is a second chance at the same one**, which is the half that
   * had to be put back by hand. A cell used to be thrown away and built again
   * on every render, so a picture that was not in the store when the board was
   * drawn - a brand new Sammlung's start key, still on its way down from
   * ARASAAC, or every `metacom:` reference on a board opened before the folder
   * was reconnected - was asked for again the next time anything moved. A
   * component is not thrown away, so without the effect below the first miss
   * would be the last word and the key would keep the "no picture" sentence for
   * the life of the page. keepHomeSymbol() and subscribeMetacom() both end in a
   * render(), which is what this is watching.
   *
   * It does mean a genuinely missing picture is re-asked on every commit. That
   * is what the old drawing did too, and the answer comes out of the store
   * rather than off the network. */
  import { symbolInto } from "../../backend/index.js";
  import { layout } from "../live.svelte.js";
  import Missing from "./Missing.svelte";

  let { symbol, className = "" }: { symbol: string; className?: string } = $props();

  let image = $state<HTMLImageElement | undefined>(undefined);
  let failed = $state("");

  $effect(() => {
    layout();
    failed = "";
  });

  $effect(() => { if (image) void symbolInto(image, symbol); });
</script>

{#if failed === symbol && symbol}<Missing {symbol} />{:else}<img bind:this={image} class={className || undefined} alt="" onerror={() => { failed = symbol; }} />{/if}
