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

  /* One request per image and symbol, and each one owns its teardown.
   *
   * The abort is the per-run token. symbolInto() waits on a store read or a
   * folder walk, so a cell whose symbol changes twice can hear the first answer
   * last; without the signal it would draw that picture under the second one's
   * name, or fire an `error` that the handler below reads as the *new* symbol
   * failing - which puts the Missing sentence on a picture that is fine.
   *
   * The catch is the same reading of a different failure. A store that throws,
   * or a METACOM folder that refuses mid-read, used to be an unhandled
   * rejection and nothing on screen - the previous picture simply stayed, and
   * backend/local.ts is plain that a left-over picture is worse than a broken
   * one, because it is somebody else's symbol. So a throw is a miss, drawn the
   * way a miss is drawn.
   *
   * The blob URL is revoked when the image goes, not when the run does. A
   * rerun is a new symbol on the same element, and symbolInto() lets go of the
   * previous blob itself once the new one is ready - revoking it here first
   * would pull the picture out from under an image that may not have finished
   * loading it, and that is an `error` too. What nobody let go of was the last
   * blob, on the element being thrown away: one per cell, every time a page
   * was left. `dataset.blobUrl` is where symbolInto() keeps it. */
  $effect(() => {
    const target = image;
    if (!target) return;
    const asked = symbol;
    const run = new AbortController();
    symbolInto(target, asked, run.signal).catch(() => {
      if (!run.signal.aborted) failed = asked;
    });
    return () => run.abort();
  });

  $effect(() => {
    const target = image;
    if (!target) return;
    return () => {
      const url = target.dataset.blobUrl;
      if (url) URL.revokeObjectURL(url);
      delete target.dataset.blobUrl;
    };
  });
</script>

{#if failed === symbol && symbol}<Missing {symbol} />{:else}<img bind:this={image} class={className || undefined} alt="" onerror={() => { failed = symbol; }} />{/if}
