<script lang="ts">
  /* The picture, its search and the upload: the left column of the sheet both
   * editors open.
   *
   * The whole of `drawPick()`, which was four hundred lines of
   * document.createElement inside shell/sheet.svelte.ts. Every comment in it is about
   * a decision rather than about the DOM, so every one of them came across; what
   * went is the building, and with it the three hand-written redraws -
   * drawPreview(), drawResults() and the pair of `hidden` sweeps that took the
   * search away while a crop was open.
   *
   * ## And the search itself is a component now
   *
   * `@lautstark/bildquelle/svelte/SymbolSearch` draws the field, the grid, the
   * credit line and everything that happened between them: the three-character
   * minimum with Enter overriding it, the 300ms debounce, the stale-answer
   * guard, the roving-tabindex arrows read off `offsetTop`, and Enter claimed
   * with `preventDefault` *and* `stopPropagation`. All of that was written here
   * first and none of it was this product's - conventions.md §6.4, which is
   * where each of those decisions is argued once instead of three times.
   *
   * What is left here is what is genuinely this column's, and §6.4's seam is
   * shaped for exactly it: the prescribed start-key tile and the way back into
   * a folder are not caller content standing above and below the results, they
   * come out of the *search answer* and render inside the box. So they arrive
   * through snippets that are handed that answer. The home tile carries
   * `picker__item` and is therefore index 0 of the ring the arrows walk, which
   * is what it has always been and what a `before`/`after` seam would have
   * quietly taken away.
   */
  import { onDestroy, tick, untrack } from "svelte";
  import { reason } from "../../core/errors.js";
  import { status } from "../dom.js";
  import { t } from "../live.svelte.js";
  import { IMAGE_SIZE } from "../../data/app_package.js";
  import { SEARCH_LIMIT } from "../../data/symbols.js";
  import { cropName, loadSquare, typeOut } from "@lautstark/design/crop";
  import type { CropOutput, Loaded } from "@lautstark/design/crop";
  import Crop from "@lautstark/design/svelte/Crop";
  import SymbolSearch from "@lautstark/bildquelle/svelte/SymbolSearch";
  import type { Candidate } from "@lautstark/bildquelle";
  import { asksForHome, HOME_TONES } from "../homekey.js";
  import {
    captionFor, emptyLine, homeFor, nearLine, offeredSource, searchPlaceholder,
    searchProvider, takeHome, takeSymbol, uploadOwn, wayBackIn,
  } from "../picker.js";
  import type { HomeSuggestion } from "../picker.js";
  import { focusOnOpen } from "../parts.js";
  import type { Held, PickColumn } from "../sheet.svelte.js";
  import Negate from "./Negate.svelte";
  import Picture from "./Picture.svelte";

  let { spec, held }: { spec: PickColumn; held: Held } = $props();

  /* Both of these are read once on purpose, and the compiler is told so.
   *
   * A sheet is opened around one thing and never handed a second: openSheet()
   * builds the spec, mounts this column into the dialog and resolves when the
   * dialog closes. So `spec.symbol` is where the picture starts and `spec.seed`
   * is what the search opens on - starting values, not a feed - and what
   * happens to them afterwards is this component's. Reading them through a
   * derived would say the opposite: that a new spec could arrive and quietly
   * throw away a picture somebody had just chosen. */
  // svelte-ignore state_referenced_locally
  let symbol = $state(spec.symbol);
  // svelte-ignore state_referenced_locally
  let negated = $state(Boolean(spec.negated));

  /* --- the search ----------------------------------------------------------
   *
   * Which collection is searched comes from the one place that knows - a
   * second copy of that answer is how a field comes to name a collection it is
   * not searching. Read as the sheet is built rather than once at boot, because
   * a METACOM folder arrives and leaves without a reload.
   *
   * The provider handed over is a shim rather than bildquelle's own object, and
   * searchProvider()'s head says why: the German pipeline, a collection that
   * cannot be reached answering nothing at all, and the "must not throw" rule
   * that shell/data/symbols.ts deliberately breaks one layer down. */
  let failure = $state.raw<unknown | null>(null);
  let finder: ReturnType<typeof SymbolSearch> | undefined = $state.raw();
  const provider = searchProvider((error) => { failure = error; });

  /* Only two, because there is only so much fixed furniture in a field and a
     grid of pictures. §6.0: a shared component carries no German. */
  const words = $derived({
    field: t("ui.symbol_search"),
    placeholder: searchPlaceholder(),
    searching: t("ui.searching"),
  });

  /* What the sheet opens the search on, and the one thing that replaces it.
   *
   * A reconnect is the only event that can make a collection answer differently
   * to the same word, and there is no way to ask the component to run its
   * search again - nor should there be a second one, since what changed is the
   * collection rather than the query. So the search is built again around the
   * word that is in the field, which is what the block below keys on. The word
   * comes off the answer the snippet was handed, because the field's value is
   * the component's. */
  // svelte-ignore state_referenced_locally
  let seed = $state.raw(spec.seed.trim());
  let reopened = $state(0);

  /* The prescribed house, asked for once and only where a word asks for it.
   *
   * Two halves, and they are separated because one of them is expensive.
   * Whether the *word* asks for a start key is asksForHome(), which is a table
   * lookup and is asked for every answer. Whether this collection can produce
   * the picture is a resolve - a folder read under METACOM, a download under
   * ARASAAC - and is the same answer for the whole life of this sheet, so the
   * promise is made once and awaited wherever it is drawn. Nothing is asked of
   * either collection until a search actually lands on a word for "home". */
  let house: Promise<HomeSuggestion | null> | undefined;
  const houseSymbol = (): Promise<HomeSuggestion | null> => (house ??= homeFor());

  let file: HTMLInputElement;

  /* Going in and coming out of the crop.
   *
   * The search, its two sentences and the results go away for the duration
   * rather than dimming: a live grid of pictures under an open crop invites a
   * press that throws the crop away without saying so. That is `busy` on the
   * component, and it has to be a prop rather than a wrapper: a block around
   * the component cannot hide the field and the grid *inside* it.
   *
   * The crop adds no buttons of its own, and it had two once. Both went the
   * same way and for the same reason: this sheet already has a foot, the foot
   * already says what it does, and a control repeating that a few inches higher
   * up is a question about which one is the real one rather than a choice.
   * Fertig keeps the square - see settle() - and the ✕ and Escape drop it,
   * which is what they mean everywhere else here.
   *
   * The square, the slider and the two ways of moving them are
   * @lautstark/design/svelte/Crop, over @lautstark/design/crop - §6.6. */
  let cropping = $state.raw<Loaded | null>(null);
  /* The handle, because a component returns nothing where the factory returned
     an object. §6.6's answer: cut(), close() and focus() are instance exports
     and arrive through bind:this, the way TitleField.flush() already does. */
  let cropper: ReturnType<typeof Crop> | undefined = $state.raw();

  /* What this product writes a square as, said rather than inherited.
   *
   * The default policy is bildhaft's, which is the one that was reasoned
   * about; these are the three fields this product answers differently, and
   * each of them is now a decision rather than a side effect.
   *
   * `png`, because a symbol may be line art on nothing and a ground colour
   * chosen here would be wrong against half the keys - the same reason
   * data/app_assets.ts keeps the alpha.
   *
   * `IMAGE_SIZE`, and the comment it replaces claimed more than it could.
   * 512 is data/app_package.ts's constant for the package a tablet opens; the
   * exchange spec calls it a *recommendation* the format tolerates violating,
   * it is not one of the seven pinned device facts and no fixture holds it.
   * A cap never enlarges either - what is written is the smaller of the square
   * and the cap - which is the half "capped at 512" always lost.
   *
   * `srgb`, which this page never chose: it called getContext("2d") with no
   * options and took the default. It is written down here because the shared
   * default is Display P3, against a measurement in bildhaft, and inheriting
   * *that* silently would be the same mistake in the other direction. What a
   * key on a talker shows is line art bound for a 128px tile, so the wider
   * gamut buys it nothing. */
  const SQUARE = {
    type: "png",
    cap: IMAGE_SIZE,
    colorSpace: "srgb",
  } satisfies Partial<CropOutput>;
  /* The square, waiting to be kept - see settle(). Held apart from the button
   * that usually runs it because the button is not the only press that means
   * yes. Not a rune: nothing draws it. */
  let keeping: (() => Promise<void>) | null = null;

  /* Anything chosen but not yet kept, kept.
   *
   * The crop is the only such thing and is likely to stay the only one: every
   * other control in this column decides in a single press, and this one is
   * chosen over several. That is what made it different, and what made the
   * shape wrong on the first try - the foot's Fertig closed the sheet over an
   * open crop and the key kept what it had.
   *
   * That was defensible written down. Nothing had been written, so no way out
   * of this sheet had cost anything, which is the rule the whole module is
   * built on. It is not what happens: somebody chooses a picture, moves it
   * about, and then presses the one primary button on the screen - and gets
   * nothing, with no sentence anywhere saying why.
   *
   * So a foot button means the square as well. Not the corner ✕, not Escape,
   * not a press outside: those say nothing happened, and after them nothing
   * has.
   *
   * Cleared as it is read rather than when the write lands, so that two quick
   * presses cannot ask for the same square twice. */
  /* Written onto the handle the sheet made rather than handed back, because a
     component hands nothing back. One assignment, at mount, to an object that
     outlives this component by exactly the length of the closing animation. */
  // svelte-ignore state_referenced_locally
  held.settle = (): Promise<void> => {
    const pending = keeping;
    keeping = null;
    return pending ? pending() : Promise.resolve();
  };

  /* `typed` defaults to nothing, because most ways to a picture are not a
     search: an upload, the prescribed start-key tile, and taking the picture
     off again. The one that is passes what it was searched for. */
  function took(chosen: string, caption: string, typed = ""): void {
    symbol = chosen;
    spec.onPick(chosen, caption, typed);
  }

  /* The sheet opens in the search field, and where the thing being edited
     already has a word, it opens on the answer to it.
     Its own focus rather than the sheet's, because the field is the search
     component's - see the note at the foot of openSheet(). Untracked, and that
     is not tidiness: reading a rune here would make this an effect that re-runs
     while somebody is typing.
     The focus goes through focusOnOpen(): the frame shows the sheet from an
     effect of its own and a child's effects run before it, so a focus() here
     would land inside a dialog that is still display: none - see the note on it
     in shell/parts.ts.
     What is *not* here any more is running the seeded search. The component
     does that as it is created rather than from an effect, and its own head
     says why that difference is not cosmetic: an effect reads the field's
     current value rather than the seed, and anything typed between the mount
     and the first flush is searched a second time - measured, two characters
     into a fresh field. */
  $effect(() => {
    untrack(() => focusOnOpen(() => finder?.focus()));
  });

  /* --- the pictures -------------------------------------------------------- */

  /* Handed the word that *found* the picture rather than the field's value, and
     that is the component's doing rather than a mirror kept here: somebody who
     has typed three more letters and not yet been answered is looking at the
     old tiles. The bug it fixes is recorded in §6.4 and was this product's: a
     search whose word is not the label of the picture it lands on used to name
     the key after the collection's word rather than after the carer's. */
  function takeHit(hit: Candidate, searched: string): void {
    status(t(offeredSource() === "metacom" ? "ui.taking_symbol" : "ui.loading_symbol"));
    void takeSymbol(hit).then(
      (taken) => { took(taken.symbol, taken.label, searched); status(""); },
      (error: unknown) => status(t("ui.symbol_failed", { error: reason(error) })));
  }

  function takeHouse(): void {
    status(t("ui.loading_symbol"));
    void takeHome().then(
      (taken) => { took(taken.symbol, taken.label); status(""); },
      (error: unknown) => status(t("ui.symbol_failed", { error: reason(error) })));
  }

  /* Somebody's own picture, reached from inside the sheet. A modal over a modal
     to choose a symbol was the second dialog this design set out to remove, and
     the one it replaced has since gone entirely - shell/picker.ts is the seam
     under this column and nothing else now. */
  function chose(): void {
    const picture = file.files?.[0];
    file.value = "";
    if (!picture) return;
    const keep = (square: Blob, name: string) => {
      status(t("ui.uploading"));
      return uploadOwn(square, name).then(
        (made) => { took(made, ""); status(t("ui.upload_done")); },
        (error: unknown) => status(t("ui.upload_failed", { error: reason(error) })));
    };
    /* No crop offered is not a failure and does not get a sentence: the picture
       was already square, or the browser could not read a size off it, and in
       both cases the file goes exactly as it did before this step existed.
       loadSquare()'s own head says which is which. */
    void loadSquare(picture, picture.name).then(
      (loaded) => {
        if (loaded) void beginCrop(loaded);
        else void keep(picture, picture.name);
      },
      () => void keep(picture, picture.name));
  }

  function endCrop(): void {
    keeping = null;
    // Through the component while it is still mounted, because that is the
    // handle §6.6 hands back; the Loaded's own close() is the same call one
    // step further down and is what onDestroy below has left to reach for.
    cropper?.close();
    cropping = null;
    // Deliberately not moving focus. The two presses below do it for
    // themselves, because the third caller - settle(), from a foot button - is
    // closing the sheet, and taking focus back to a control inside a dialog
    // that is going away is how it ends up nowhere.
  }

  async function beginCrop(loaded: Loaded): Promise<void> {
    cropping = loaded;
    const name = cropName(loaded.name, typeOut(SQUARE.type, loaded.type));
    keeping = () => cropper!.cut()
      .then((square) => uploadOwn(square, name))
      .then(
        (made) => { endCrop(); took(made, ""); status(t("ui.upload_done")); },
        (error: unknown) => {
          endCrop();
          status(t("ui.upload_failed", { error: reason(error) }));
        });
    /* One tick, because the box is a component now rather than an element the
       factory had already built: the handle does not exist until the block
       above has been drawn. */
    await tick();
    cropper?.focus();
  }

  /* The way out that never called close(). Every other one does - keeping()
     closes on both of its branches - but the corner ✕, Escape and a press
     outside take the whole sheet away with a square still on screen, and the
     object URL the picture was loaded from outlived the page that was showing
     it. It was invisible because nothing downstream reads it: the store already
     has the bytes it needs by then. §6.6 says every way out has to call it;
     this is the way out that did not. */
  onDestroy(() => cropping?.close());

  /* Taking the picture off, which until the button existed could only be done
     by putting a different one on. Nothing downstream has to learn anything:
     `symbol: ""` is what a button without a picture has always been in the
     model, and a picture-less button draws its word large.
     Not a ✕ beside the search field. That field is an <input type="search"> and
     the browser puts its own ✕ inside it, which clears the *word being searched
     for* - two ✕ a few pixels apart meaning two different things is worse than
     the missing control was.
     Hidden rather than disabled when there is no picture: there is nothing to
     take off, and a control that is permanently there and permanently dead
     reads as broken. Hiding it does cost the press its own focus, though - the
     button vanishes under it - so the press hands focus to the search field,
     which is where somebody who has just cleared a picture is going next. The
     field is the component's now, so this asks the component for it. */
  function takeOff(): void {
    took("", "");
    finder?.focus();
    status(t("ui.symbol_off_done"));
  }

  /* Crossing the picture out.
   *
   * A checkbox rather than a fifth thing in the row above, because it is not a
   * thing done *to* the picture the way choosing one and taking one off are -
   * it is a state the key is in, and it stays true while the picture under it
   * is swapped. That is the whole of why it is a field on the key rather than a
   * second reference: see Slot.negated.
   *
   * Hidden with no picture, for the reason the ✕ is: there is nothing to cross
   * out, and a live control over an empty box invites a press that does nothing
   * visible. It comes back by itself as soon as a picture is picked.
   *
   * A label and nothing else, though a sentence explaining *why* a German board
   * crosses a picture out rather than using another one would help a carer who
   * has not built one before. It was written and taken out again, measured
   * rather than argued: three lines of prose here cost 60px, and this column
   * already overflows the sheet's scrolling body by a little. Sixty more pushed
   * the ARASAAC notice at its foot from mostly visible to entirely below the
   * fold, and that notice is a condition of a licence rather than something we
   * choose to show. */
  function crossOut(on: boolean): void {
    negated = on;
    spec.onNegate?.(on);
    status(t(on ? "ui.symbol_negated" : "ui.symbol_negate_off"));
  }

  /** The way out of an empty answer, where the seam knows one. The sentence
   *  says what is wrong; without this it also had to say where to go and fix
   *  it, which for the one case that has an answer meant closing this sheet,
   *  finding a panel two screens away and coming back.
   *
   *  Only where something really changed: a refused prompt leaves the sheet
   *  exactly as it was, which is what a refusal should cost. */
  function doAct(run: () => Promise<boolean>, query: string): void {
    void run().then((changed) => {
      if (!changed) return;
      seed = query;
      reopened += 1;
    });
  }

  const cropped = $derived(!!cropping);
</script>

<div class="pick">
  {#if cropping}
    <!-- The crop takes the preview's place rather than standing beside it: it
         is the same square, being moved about.
         Three things in one group rather than a box up here and a slider two
         elements down, because the component draws the box and the slider as
         siblings and this is the layout change §6.6 says to budget for. The
         box is `.crop` itself now - the shape, the clipping and the ground it
         wore as `.pick__preview--crop` moved onto it, which is where the
         component leaves them on purpose. What it says is still this column's,
         the way every other sentence here is.
         The sentence is meant as the box's description as well as the column's
         copy: somebody who cannot see it has just been handed a control whose
         name says what it is and not what to do with it. It has never been
         wired to one - the id below is referenced by nothing - and the
         component takes no describedby to wire it to. -->
    <div class="pick__crop"><Crop bind:this={cropper} loaded={cropping} label={t("ui.crop_frame")} zoomLabel={t("ui.crop_zoom")} output={SQUARE} rowClass="pick__zoom" /><p class="pick__crophint" id="pickCropHint">{t("ui.crop_hint")}</p></div>
  {:else if !symbol}
    <div class="pick__preview pick__preview--none" role="img" aria-label={t("ui.symbol_none")}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.6" /><path d="M21 16l-5-5-5 5-3-3-5 5" /></svg></div>
  {:else}
    {#key symbol}
      <!-- Over the picture, at the size of the box, so the preview says the
           same thing the cell behind the sheet says and the device will say. -->
      <div class="pick__preview"><Picture {symbol} />{#if negated}<Negate />{/if}</div>
    {/key}
  {/if}

  <!-- Rebuilt, and only ever by a reconnect - see doAct(). -->
  {#key reopened}
    <SymbolSearch bind:this={finder} class="pick__search" {provider} {words} {seed}
      busy={cropped} minimum={3} limit={SEARCH_LIMIT} describe={captionFor}
      onpick={takeHit} onescape={() => held.dismiss()}>
      <!-- What kind of answer the hits are, above the hits themselves.
           Outside the box rather than a line inside it: the box scrolls at
           150px and a sentence written into it scrolls away from the pictures
           it is about, which is the same silence as not writing it. Above,
           because it is read before the tiles are looked at rather than after.
           Neither of those is sayable without the `between` slot, which is why
           this repository is on bildquelle v2.4.0.
           role="status" and built empty, so that the sentence is announced when
           it arrives. Hidden rather than left empty: an empty <p> above the
           grid is a gap that reads as a layout fault. -->
      {#snippet between(answer)}{@const near = nearLine(answer.searched, answer.candidates)}<p class="pick__near" role="status" hidden={cropped || !near}>{near}</p>{/snippet}

      <!-- The one tile the collection did not answer with: the picture a start
           key is prescribed, drawn the way that key is drawn rather than the
           way a thumbnail is. It is inside the box and first, which is what
           `lead` is for: it carries the same class as a hit, so it is index 0
           of the ring the arrows walk, and a seam that put it outside the box
           would have shipped those arrows and removed the tile they start on.
           Marked and captioned rather than quietly put in the grid as a fifth
           hit. The grid has one rendering rule - a picture on white, as the
           collection draws it - and a single tile that broke it would read as
           the picker having two, with nothing on screen saying which is which.
           So the light-on-dark is declared: the tile is set apart, it says what
           it is for, and the same house is still in the grid beside it as an
           ordinary hit.
           The key's own colour, from the module that owns what a key looks like
           rather than written a second time in ui.css. It is not a token and
           must not become one: this is the tablet's tile, the same in both
           schemes.
           Offered whatever the collection answered, including an empty answer -
           a collection with no word for "home" still has the house that was
           chosen out of it, and that is exactly the search where somebody most
           needs to be shown it. -->
      {#snippet lead(answer)}{#if asksForHome(answer.searched)}{#await houseSymbol() then home}{#if home}<div class="pick__home"><button type="button" class="picker__item pick__hit--home" style="--home-plate:{HOME_TONES.plate}" aria-label={home.caption} title={home.caption} onclick={takeHouse}><img src={home.url} loading="lazy" alt="" /></button><!-- A restatement of the tile's own name, for whoever can see it.
           Announcing it twice would be a reader hearing "start key, start key". --><span class="pick__homecap" aria-hidden="true">{home.caption}</span></div>{/if}{/await}{/if}{/snippet}

      <!-- Under whatever is above it rather than instead of it. The box used to
           be replaced, which was right while hits were the only thing in it - a
           search that found nothing had nothing to stand beside the sentence.
           It has now: the prescribed tile is offered whatever the collection
           answered, and it is the empty answers where that offer is worth the
           most.
           Both silences - a word the collection does not have, and a browser
           that never managed to ask - are one sentence from the seam, which is
           also the only thing that still knows which of them it was. -->
      {#snippet trailing(answer)}{#if answer.empty}{@const act = wayBackIn()}<p>{emptyLine(answer.searched, failure)}</p>{#if act}<button type="button" class="btn" onclick={() => doAct(act.run, answer.query)}>{act.label}</button>{/if}{/if}{/snippet}

      <!-- Nothing. A tile here is a picture and only a picture, the way the
           collection draws it; the label is its accessible name and its title
           and is captionFor()'s, which is where the twins are told apart.
           §6.4 records that as a convergence rather than a difference -
           bildhaft disambiguates in visible text and this page in aria-label,
           and both products do disambiguate. -->
      {#snippet caption()}{/snippet}
    </SymbolSearch>
  {/key}

  <div class="pick__acts" hidden={cropped}><button type="button" class="btn quiet" onclick={() => file.click()}>{t("ui.symbol_own")}</button><button type="button" class="btn quiet" hidden={!symbol} onclick={takeOff}>{t("ui.symbol_off")}</button></div>
  <input bind:this={file} type="file" accept="image/*" hidden onchange={chose} />

  {#if spec.onNegate}<label class="pick__negate" for="pickNegate" hidden={cropped || !symbol}><input type="checkbox" id="pickNegate" checked={negated} onchange={(e) => crossOut(e.currentTarget.checked)} />{t("ui.symbol_negate")}</label>{/if}
</div>
