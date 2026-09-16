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
   */
  import { untrack } from "svelte";
  import { reason } from "../../core/errors.js";
  import { status } from "../dom.js";
  import { t } from "../live.svelte.js";
  import { cropSquare, pngName } from "../crop.js";
  import type { Cropper } from "../crop.js";
  import { HOME_TONES } from "../homekey.js";
  import { creditLine, findSymbols, searchPlaceholder, takeHome, takeSymbol, uploadOwn }
    from "../picker.js";
  import type { HomeSuggestion, SymbolAct, SymbolHit } from "../picker.js";
  import type { Held, PickColumn } from "../sheet.svelte.js";
  import Negate from "./Negate.svelte";
  import Picture from "./Picture.svelte";
  import Vanilla from "./Vanilla.svelte";

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

  /* What the results box is showing, as the three things that can be in it at
   * once: the prescribed start-key picture, the hits, and the sentence that
   * stands in for hits there are none of.
   *
   * Held rather than drawn as each arrives, because two of the three outlive a
   * press: taking a picture redraws the box to move the frame onto what was
   * taken, and a box redrawn from the hits alone would lose the tile above them
   * and the sentence below. `searching` is still what writes "sucht …", because
   * that one really does replace everything. */
  let hits = $state.raw<SymbolHit[]>([]);
  let home = $state.raw<HomeSuggestion | null>(null);
  let nothing = $state("");
  /* What can be done about `nothing`, where the seam offered something. Held
   * beside it rather than inside the sentence, because a sentence is drawn and
   * a button is pressed. */
  let act = $state.raw<SymbolAct | null>(null);
  /* The third answer, which is neither a hit nor a silence: hits that are the
   * nearest the collection holds rather than the word. They stay; this says so. */
  let near = $state("");
  let searching = $state(false);

  /* Which collection is being searched, from the one place that knows - a
     second copy of that answer is how a field comes to name a collection it is
     not searching. Read as the sheet is built rather than once at boot, because
     a METACOM folder arrives and leaves without a reload. */
  const placeholder = searchPlaceholder();
  /* What is owed for the collection these pictures come from.
     ARASAAC is CC BY-NC-SA and the wording is a condition of the licence, so it
     belongs wherever its pictures are shown - which, since a sheet carries its
     own search, is here. The sentence is picker.ts's, built there and read
     here. */
  const credits = creditLine();

  // svelte-ignore state_referenced_locally
  let word = $state(spec.seed.trim());
  let queryNode: HTMLInputElement;
  let results: HTMLElement;
  let file: HTMLInputElement;

  /* Going in and coming out of the crop.
   *
   * The search, its two sentences and the results go away for the duration
   * rather than dimming: a live grid of pictures under an open crop invites a
   * press that throws the crop away without saying so, and hiding them is one
   * property against a disabled look this stylesheet has nowhere else.
   *
   * The crop adds no buttons of its own, and it had two once. Both went the
   * same way and for the same reason: this sheet already has a foot, the foot
   * already says what it does, and a control repeating that a few inches higher
   * up is a question about which one is the real one rather than a choice.
   * Fertig keeps the square - see settle() - and the ✕ and Escape drop it,
   * which is what they mean everywhere else here. */
  let cropping = $state.raw<Cropper | null>(null);
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

  /* --- searching ---------------------------------------------------------- */

  // So a slow answer cannot overtake a newer one. The sheet's own, because the
  // sheet is its own search - there is no dialog behind it to hold one.
  let token = 0;
  /* The word the tiles on screen are the answer to, which is not the same as
     the word in the field: somebody who has typed three more letters and not
     yet been answered is looking at the old ones. onPick is handed this rather
     than the field's value so that the name a pick fills in is the word that
     found the picture being picked. */
  let searched = "";

  function search(): void {
    const asked = word.trim();
    if (!asked) return;
    const mine = ++token;
    /* "sucht …" replaces the box, so it is only written into an empty one.
     *
     * That was unconditional while Enter was the only way to run a search: a
     * press meant a wait, and the box had nothing in it worth keeping. Typing
     * runs one every few letters, and a box that blanked itself on each of them
     * would flicker under the hand that is typing - and would take away the
     * hits from two letters ago, which are the best answer anybody has until
     * the next ones arrive. So results stand until they are replaced. */
    searching = !home && !hits.length && !nothing;
    near = "";
    void findSymbols(asked).then((answer) => {
      if (mine !== token) return;
      searched = asked;
      searching = false;
      hits = answer.hits;
      home = answer.home;
      // Both silences - a word the collection does not have, and a browser that
      // never managed to ask - come back as a sentence from the seam, and are
      // written into the box under whatever else is in it.
      nothing = answer.empty;
      act = answer.act ?? null;
      near = answer.near;
    });
  }

  /* --- Searching as it is typed --------------------------------------------
   *
   * Enter was the only way to run a search, and there is no button beside the
   * field, so the field asked to be typed into and then said nothing about what
   * to do next. Everything else in this product that searches - the voice list,
   * the collection filter - answers as you type, and this is the one place that
   * made somebody ask for the answer.
   *
   * Three letters, because of what is on the other end. ARASAAC is a network
   * call and METACOM is an index over somebody's folder; one or two letters
   * match a large part of either and answer with the first four of a thousand
   * pictures, which is a slower way of showing nothing. Three is also where
   * German stops being prefixes - "es", "im", "am" are whole words and none of
   * them is a picture anybody wants.
   *
   * Enter still works and is not the same act: it runs the word as it stands,
   * now, at any length. That is what somebody typing "Ei" needs, and it is the
   * way to ask again after a search that failed on a dropped network.
   *
   * The stale-answer guard above is what makes this safe rather than anything
   * here: a fast typist has several searches in flight and they may land in any
   * order, and only the newest one is allowed to draw. */
  const ENOUGH = 3;
  /* Long enough that a word typed at speed is one search rather than six, short
     enough that stopping to look at the screen is answered before anybody
     wonders whether it will be. */
  const SETTLES = 300;
  let typing: ReturnType<typeof setTimeout> | undefined;

  function typedInto(): void {
    clearTimeout(typing);
    if (word.trim().length < ENOUGH) return;
    typing = setTimeout(search, SETTLES);
  }

  function pressedInQuery(event: KeyboardEvent): void {
    /* Down into the pictures, which is the whole point of having typed. The
       grid keeps its own arrows from here on, and ArrowUp out of the top row
       comes back to this field. */
    if (event.key === "ArrowDown") {
      const all = tiles();
      if (!all.length) return;
      event.preventDefault();
      focusTile(all, 0);
      return;
    }
    if (event.key !== "Enter") return;
    // The sheet is not a form, but Enter in a search field inside a dialog is
    // otherwise the browser's own way to close it.
    event.preventDefault();
    // Now, rather than in 300ms and again after that.
    clearTimeout(typing);
    search();
  }

  /* --- Walking the tiles ---------------------------------------------------
   *
   * The results are the one thing in this sheet that is looked at rather than
   * read, and Tab pressed twenty times to reach the twenty-first picture is not
   * looking. So the box is one stop in the tab order and the arrows move inside
   * it, which is what a grid of controls is for.
   *
   * Delegated to the box rather than bound to each tile: the tiles are thrown
   * away and rebuilt by every search and by every pick, and a handler per tile
   * would be rebuilt with them. */

  /** The tiles, in the order they are drawn in. */
  const tiles = (): HTMLElement[] =>
    [...results.querySelectorAll<HTMLElement>("button.pick__hit")];

  /** Focus one, and make it the box's one tab stop. Roving rather than a fixed
   *  stop at the first tile, so that Tab out and back in comes back to the
   *  picture somebody was looking at. */
  function focusTile(all: HTMLElement[], at: number): void {
    all.forEach((one, index) => { one.tabIndex = index === at ? 0 : -1; });
    all[at]?.focus();
  }

  /**
   * Where an arrow lands, as an index into the tiles.
   *
   * Stopping at the edge rather than wrapping - the same choice the board's
   * Alt+Arrow and the sheet's own "next" already make, and for the same reason:
   * walking off the end back to the beginning is a surprise.
   *
   * Up and down are read off the layout rather than counted in fours. ui.css
   * lays the box out in four columns, but the prescribed start-key tile is a
   * little column with a word under it and stands taller than the hits beside
   * it, so a row is not reliably four tiles at the same height. Grouping by
   * offsetTop makes that tile a member of its row instead of an exception to an
   * arithmetic, and it will go on being right if the column count ever becomes
   * a media query.
   */
  function stepTo(all: HTMLElement[], from: number, key: string): number {
    if (key === "ArrowLeft") return Math.max(0, from - 1);
    if (key === "ArrowRight") return Math.min(all.length - 1, from + 1);
    const here = all[from]!;
    const rows = [...new Set(all.map((one) => one.offsetTop))].sort((a, b) => a - b);
    const want = rows[rows.indexOf(here.offsetTop) + (key === "ArrowDown" ? 1 : -1)];
    if (want === undefined) return from;
    // The nearest tile on that row by where it starts, so a run of presses
    // holds a column rather than drifting to the left edge.
    let best = from;
    let nearest = Infinity;
    all.forEach((one, at) => {
      if (one.offsetTop !== want) return;
      const gap = Math.abs(one.offsetLeft - here.offsetLeft);
      if (gap < nearest) { nearest = gap; best = at; }
    });
    return best;
  }

  function walkTiles(event: KeyboardEvent): void {
    const arrow = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key);
    if (!arrow) return;
    const all = tiles();
    const from = all.indexOf(document.activeElement as HTMLElement);
    // Something else in the box has focus - the button offered beside a
    // sentence about an empty answer - and the arrows are not this box's.
    if (from < 0) return;
    // Claimed whether or not there is anywhere to go: the box scrolls at 150px,
    // and an arrow that moved nothing would scroll the pictures away from under
    // the one that is focused.
    event.preventDefault();
    const to = stepTo(all, from, event.key);
    /* Off the top row is back to the field above, which is where somebody who
       has changed their mind about the word is going. Off the other three edges
       is nowhere: left and right have the rest of the grid behind them and down
       has the credits, which is not a place to arrow into. */
    if (to === from && event.key === "ArrowUp") queryNode.focus();
    else focusTile(all, to);
  }

  /* One tab stop for the whole box, and the keyboard put back where it was.
   *
   * drawResults() did this by hand on every redraw, remembering the index
   * before it emptied the box and clamping it afterwards, because taking a
   * picture rebuilt every tile and the element focus was on went with them. The
   * keyed each block below is what makes the remembering unnecessary: a tile
   * that is still in the answer is still the same element, so focus stays where
   * it was without anybody moving it. What is left is the tab index, which
   * belongs to the box rather than to any one tile. */
  $effect(() => {
    hits; home; nothing;
    const all = tiles();
    if (!all.some((one) => one.tabIndex === 0)) {
      all.forEach((one, at) => { one.tabIndex = at === 0 ? 0 : -1; });
    }
  });

  /* The sheet opens in the search field, and where the thing being edited
     already has a word, it opens on the answer to it.
     Its own focus rather than the sheet's, because the field is this
     component's - see the note at the foot of openSheet(). Untracked, and that
     is not tidiness: `word` is a rune and reading it here would make this an
     effect that re-runs on every keystroke, which is a search fired per letter
     and the caret sent back to the start of the field while somebody is typing
     into it. What is wanted is once, at mount. */
  $effect(() => {
    untrack(() => {
      queryNode.focus();
      if (word) search();
    });
  });

  /* --- the pictures -------------------------------------------------------- */

  function takeHit(hit: SymbolHit): void {
    status(t(hit.source === "metacom" ? "ui.taking_symbol" : "ui.loading_symbol"));
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
       cropSquare()'s own head says which is which. */
    void cropSquare(picture).then(
      (cutter) => {
        if (cutter) beginCrop(cutter, picture.name);
        else void keep(picture, picture.name);
      },
      () => void keep(picture, picture.name));
  }

  function endCrop(): void {
    keeping = null;
    cropping?.close();
    cropping = null;
    // Deliberately not moving focus. The two presses below do it for
    // themselves, because the third caller - settle(), from a foot button - is
    // closing the sheet, and taking focus back to a control inside a dialog
    // that is going away is how it ends up nowhere.
  }

  function beginCrop(cutter: Cropper, name: string): void {
    cropping = cutter;
    keeping = () => cutter.cut()
      .then((square) => uploadOwn(square, pngName(name)))
      .then(
        (made) => { endCrop(); took(made, ""); status(t("ui.upload_done")); },
        (error: unknown) => {
          endCrop();
          status(t("ui.upload_failed", { error: reason(error) }));
        });
    cutter.surface.focus();
  }

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
     which is where somebody who has just cleared a picture is going next. */
  function takeOff(): void {
    took("", "");
    queryNode.focus();
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
   *  finding a panel two screens away and coming back. */
  function doAct(): void {
    void act?.run().then((changed) => {
      // Only when something really changed: a refused prompt leaves the sheet
      // exactly as it was, which is what a refusal should cost.
      if (changed) search();
    });
  }

  const cropped = $derived(!!cropping);
</script>

<div class="pick">
  {#if cropped}
    <!-- The crop takes the preview's place rather than standing beside it: it
         is the same square, being moved about. -->
    <div class="pick__preview pick__preview--crop"><Vanilla node={cropping?.surface} /></div>
    <!-- Directly under the box and above everything else, because the
         alternative is inserting elements into a live column at the moment
         somebody is looking at it. What fills it comes from shell/crop.ts; what
         it says is this column's, the way every other sentence here is.
         The sentence is the box's description as well as the column's copy:
         somebody who cannot see it has just been handed a control whose name
         says what it is and not what to do with it. -->
    <div class="pick__crop"><Vanilla node={cropping?.zoom} /><p class="pick__crophint" id="pickCropHint">{t("ui.crop_hint")}</p></div>
  {:else if !symbol}
    <div class="pick__preview pick__preview--none" role="img" aria-label={t("ui.symbol_none")}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.6" /><path d="M21 16l-5-5-5 5-3-3-5 5" /></svg></div>
  {:else}
    {#key symbol}
      <!-- Over the picture, at the size of the box, so the preview says the
           same thing the cell behind the sheet says and the device will say. -->
      <div class="pick__preview"><Picture {symbol} />{#if negated}<Negate />{/if}</div>
    {/key}
  {/if}

  <input bind:this={queryNode} bind:value={word} type="search" class="field" autocomplete="off"
    placeholder={placeholder} aria-label={t("ui.symbol_search")} hidden={cropped}
    oninput={typedInto} onkeydown={pressedInQuery} />

  <!-- What kind of answer the hits are, above the hits themselves.
       Its own element rather than a line inside the grid: the grid scrolls at
       150px and a sentence written into it scrolls away from the pictures it is
       about, which is the same silence as not writing it. Above, because it is
       read before the tiles are looked at rather than after.
       role="status" and built empty, so that the sentence is announced when it
       arrives. Hidden rather than left empty: an empty <p> above the grid is a
       gap that reads as a layout fault. -->
  <p class="pick__near" role="status" hidden={cropped || !near}>{near}</p>

  <div bind:this={results} class="pick__results" hidden={cropped} onkeydown={walkTiles} role="presentation">{#if searching}<p>{t("ui.searching")}</p>{:else}{#if home}<!-- The one tile the collection did not answer with: the picture a start key
       is prescribed, drawn the way that key is drawn rather than the way a
       thumbnail is.
       Marked and captioned rather than quietly put in the grid as a fifth hit.
       The grid has one rendering rule - a picture on white, as the collection
       draws it - and a single tile that broke it would read as the picker
       having two, with nothing on screen saying which is which. So the
       light-on-dark is declared: the tile is set apart, it says what it is for,
       and the same house is still in the grid beside it as an ordinary hit.
       The key's own colour, from the module that owns what a key looks like
       rather than written a second time in ui.css. It is not a token and must
       not become one: this is the tablet's tile, the same in both schemes. --><div class="pick__home"><button type="button" class="pick__hit pick__hit--home" style="--home-plate:{HOME_TONES.plate}" aria-label={home.caption} title={home.caption} onclick={takeHouse}><img src={home.url} loading="lazy" alt="" /></button><!-- A restatement of the tile's own name, for whoever can see it.
       Announcing it twice would be a reader hearing "start key, start key". --><span class="pick__homecap" aria-hidden="true">{home.caption}</span></div>{/if}{#each hits as hit (hit.url)}<!-- The hint tells twins apart - four METACOM tiles captioned "ja" differ
       only by picture - and is display only, never the reference. --><button type="button" class="pick__hit" aria-label={hit.label + ("hint" in hit && hit.hint ? ` - ${hit.hint}` : "")} onclick={() => takeHit(hit)}><img src={hit.url} loading="lazy" alt="" /></button>{/each}{#if nothing}<!-- Under whatever is above it rather than instead of it. The box used to
       be replaced, which was right while hits were the only thing in it - a
       search that found nothing had nothing to stand beside the sentence. It
       has now: the prescribed tile is offered whatever the collection answered,
       and it is the empty answers where that offer is worth the most. --><p>{nothing}</p>{#if act}<button type="button" class="btn" onclick={doAct}>{act.label}</button>{/if}{/if}{/if}</div>

  <div class="pick__acts" hidden={cropped}><button type="button" class="btn quiet" onclick={() => file.click()}>{t("ui.symbol_own")}</button><button type="button" class="btn quiet" hidden={!symbol} onclick={takeOff}>{t("ui.symbol_off")}</button></div>
  <input bind:this={file} type="file" accept="image/*" hidden onchange={chose} />

  {#if spec.onNegate}<label class="pick__negate" for="pickNegate" hidden={cropped || !symbol}><input type="checkbox" id="pickNegate" checked={negated} onchange={(e) => crossOut(e.currentTarget.checked)} />{t("ui.symbol_negate")}</label>{/if}

  <p class="pick__credits" hidden={cropped}>{credits}</p>
</div>
