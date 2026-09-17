<script lang="ts">
  /* The sheet behind the ⋯ beside a Sammlung's name: what is true of *this*
   * Sammlung and travels with it.
   *
   * Two of the panels in here were in the settings sheet at the foot of the
   * sidebar, among the Azure key and the METACOM folder, and both were the
   * wrong thing to find there. Everything else on that sheet answers "what is
   * this browser, or this installation, set to"; those two answer "which
   * Sammlung is open" - so opening a different one and reopening Einstellungen
   * showed a different answer in the same place, which is not what a setting
   * is. docs/sammlung-settings.md is the argument in full.
   *
   * ## What is here, and what deliberately is not
   *
   * The voice, for both targets: which of the voices this machine has is the
   * one this Sammlung speaks in. **Which voices the machine has** is the other
   * half and it stayed behind - a download installs a voice for every Sammlung
   * there is, so putting it in a per-child sheet would be the same scope
   * mismatch this sheet exists to undo, only reversed.
   *
   * The device's menu language, for the talker only. On a tablet package that
   * field is nearly vestigial: localeFor() derives the locale from the *voice*
   * first, and only falls back to the layout's language when the voice name
   * carries no usable tag.
   *
   * The editor's own panel, in the place that language holds on a talker: for
   * the tablet that is the grid, and it is the tablet's in the same way. The
   * body is not written here and is the editor's, because counting what would
   * fall outside a smaller grid is editor-app/pages.ts's work and the shell may
   * not import it (tests/unit/layers.test.ts). voices.svelte.ts has the hook
   * and the argument; the talker registers nothing, and a panel nobody
   * registered is not drawn at all.
   *
   * ## The shape
   *
   * §3.5's folded panels, one open at a time - and both the frame and the
   * panels are @lautstark/design's now, the same two components the settings
   * sheet takes. conventions.md §6.1 and §6.2.
   *
   * `group="collection"` rather than the component's default, which is the one
   * thing about this column that differs from that sheet: two exclusive groups
   * in one product is correct, because §3.5's argument is about one column at a
   * time rather than about one name.
   *
   * No Save and no Cancel *on the sheet*, like the settings sheet: a language
   * and a voice apply when they are touched, because neither destroys
   * anything. The grid does destroy something - it throws buttons away when it
   * shrinks - so it keeps a button of its own, inside its panel.
   */
  import { menuOn } from "@lautstark/design/menu";
  import { t } from "./live.svelte.js";
  import {
    chooseCollectionLanguage, chooseSymbolSource, closeCollectionSettings,
    collectionEpoch, collectionLanguageCode, collectionLanguageName, collectionSheetOpen,
    deviceLanguages, deviceLanguageShown, editorPanels, reconnectSymbolFolder,
    symbolSourceChosen, symbolSourceSleeping, voiceEmpty, voiceHint,
    voiceListNode, voiceState, haveVoices,
  } from "./voices.svelte.js";
  import { metacomOffered } from "./settings.svelte.js";
  import Panel from "@lautstark/design/svelte/Panel";
  import Sheet from "@lautstark/design/svelte/Sheet";
  import Vanilla from "@lautstark/design/svelte/Vanilla";

  /* `$state` and optional, which the `{#if}` below is the reason for: a
     `bind:this` inside a conditional block is written twice - the element when
     the block is built and `undefined` when it is torn down - and Svelte says
     so rather than letting the second write go unnoticed. */
  let langPick = $state<HTMLButtonElement | undefined>(undefined);

  const panels = $derived(editorPanels());
  const chosen = $derived(symbolSourceChosen());
  const ready = $derived(metacomOffered());

  /* Which panels are open, by id. Two-way, because `name="collection"` is the
     platform's accordion and the browser writes that attribute behind Svelte's
     back - conventions.md §6.2.
     Seeded folded rather than left empty: `open` has a fallback in the
     component, and Svelte refuses to bind `undefined` to a prop that has one -
     `props_invalid_value`, thrown as the page boots. The editor's own panels
     cannot be seeded here at all, because which of them there are is an answer
     that arrives with the sheet; they bind through the pair below. */
  const shown: Record<string, boolean> = $state({
    collectionLanguagePanel: false, symbolPanel: false, voicePanel: false,
  });

  /* Whichever panel is first is open on arrival. A sheet of two, or of one,
     opening entirely folded is a sheet that asks for a second click before it
     says anything - which is the opposite of what the folding is for.
     The first one that is *there*, whichever that is: assigning `open` down
     the list would do it too, but only because the accordion closes the
     previous one, which is the browser undoing something this line should not
     have said in the first place.
     By id rather than by element, which is what the components cost and give
     back: the order was a list of nodes filled by `bind:this`, and it is the
     list of names the ids are made from - the same list §3.5 reads as the
     column. */
  $effect(() => {
    if (!collectionSheetOpen()) return;
    collectionEpoch();
    const order = [
      ...(deviceLanguageShown() ? ["collectionLanguagePanel"] : []),
      ...panels.map((one) => `${one.name}Panel`),
      "symbolPanel", "voicePanel",
    ];
    for (const one of order) shown[one] = one === order[0];
  });

  /* The options name themselves - "Deutsch" stays "Deutsch" whatever the page
     is set to. That matters twice over here: this is the language of a device
     somebody else will hold. */
  function pickLanguage(): void {
    if (!langPick) return;
    menuOn(langPick, (add) => {
      const live = collectionLanguageCode();
      for (const one of deviceLanguages()) {
        add(one.name, () => void chooseCollectionLanguage(one.code),
            { checked: one.code === live });
      }
    });
  }
</script>

<Sheet
  open={collectionSheetOpen()}
  onclose={closeCollectionSettings}
  id="collectionSheet"
  closeId="collectionSheetClose"
  title={t("ui.collection_settings")}
  closeLabel={t("ui.close")}
>
  <!-- Replaces the frame's <h2> only so that the id survives:
       e2e/language.spec.ts reads #collectionSheetHeading to check that this
       sheet is titled in the language the page was just switched to. -->
  {#snippet head()}<h2 id="collectionSheetHeading">{t("ui.collection_settings")}</h2>{/snippet}

  <!-- The language the device shows its own menu in. First, and open on
       arrival, because it is the one a talker Sammlung is usually opened for -
       and not drawn at all on a tablet Sammlung, where the voice decides the
       locale and this would be a field with nothing downstream of it.
       An `{#if}` where this was `hidden` on the <details>: the attribute was
       this component's to put on its own element and the element is the
       package's now. The suite reads it with toBeHidden(), which is true of an
       element that is not there - and is already how it reads the editor's
       panel on a talker, where nothing registers one. -->
  {#if deviceLanguageShown()}
    <Panel bind:open={shown.collectionLanguagePanel} id="collectionLanguagePanel"
           group="collection" stateId="collectionLanguageState"
           section={t("ui.collection_language")}
           state={collectionLanguageName()} class="setting">
      <!-- `aria-label` where this pointed at the heading's own id with
           aria-labelledby: the heading is the panel component's span now and
           carries no id of this component's making, so the name is written out
           of the same key the heading reads. -->
      <span class="menu-anchor start"><button bind:this={langPick} id="collectionLangPick" class="btn quiet sm dropdown"
        type="button" aria-haspopup="menu" aria-expanded="false"
        aria-label={t("ui.collection_language")}
        onclick={pickLanguage}>{collectionLanguageName()}</button></span>
      <p class="note" id="collectionLanguageNote">{t("ui.collection_language_note")}</p>
    </Panel>
  {/if}

  <!-- What the editor on screen has to say about the Sammlung as a whole, and
       it is not written here: on a tablet that is the grid and the press
       timings, which are that target's in the way the language above is the
       talker's. The ids are made from each panel's `name`, which is how
       #collectionEditorPanel and the rest still exist to be looked up. -->
  {#each panels as panel (panel.name)}
    {@const id = panel.name + "Panel"}
    <!-- The get/set pair rather than a plain `bind:`, which the three panels
         above use: this one's key is not in the record until the effect has
         run, and binding an absent key is binding `undefined` to a prop with a
         fallback, which Svelte refuses outright. Folded is the right reading of
         a panel nobody has said anything about yet. -->
    <Panel bind:open={() => shown[id] ?? false, (open) => { shown[id] = open; }}
           id="{panel.name}Panel"
           group="collection" stateId="{panel.name}State"
           section={panel.section()} state={panel.state()} class="setting">
      <!-- Destroyed and built again on every open, which is what the `{#key}`
           is for: a panel's pending choice lives nowhere but inside it, so
           closing the sheet has to be how that choice is declined. A <dialog>
           that is closed is hidden rather than emptied, and a component left
           standing in one carries its half-made decision into the next open.
           voices.svelte.ts's openCollectionSettings() is where the number moves.

           **It wraps the body and not the panel, and that is not tidiness.** It
           was around the whole `<details>`, which worked while this component
           drew that element itself. It cannot be now: the `<details>` is
           `name="collection"`, and rebuilding one means an old and a new
           element carrying that name are in the document together for an
           instant. Two open members of a native accordion is a state the
           browser resolves by closing one - and the one it closed still had its
           `bind:open` attached, so it wrote `false` back into the record the new
           one reads from, and the sheet reopened with the editor's panel folded
           after all. Which is conventions.md §6.2's own bug, arriving through
           the other door: the browser writing `open` behind Svelte's back.
           What has to be rebuilt is the pending choice, and the pending choice
           is in the body. -->
      {#key collectionEpoch()}<panel.body />{/key}
    </Panel>
  {/each}

  <!-- Which symbol collection this Sammlung's pictures come from. Both targets
       have it, because both have pictures - unlike the language above, which
       is the talker's, and the panel above that, which is whichever editor is
       on screen. exchange/SPEC.md §5.1 makes one source per package a rule of
       the format, so this is the Sammlung's own fact and not this browser's. -->
  <Panel bind:open={shown.symbolPanel} id="symbolPanel"
         group="collection" stateId="symbolState"
         section={t("ui.symbol_source_section")}
         state={chosen === "metacom" ? t("ui.metacom") : t("ui.arasaac")}
         class="setting">
    <p class="note">{t("ui.symbol_source_note")}</p>
    <!-- Disabled rather than hidden: a source that is not on offer here is
         still one of the two answers, and hiding it would make the panel look
         like it had one. The sentence under it says what is missing. -->
    <button type="button" class="btn choice" aria-pressed={chosen === "arasaac" ? "true" : "false"} onclick={() => void chooseSymbolSource("arasaac")}><strong>{t("ui.arasaac")}</strong><span>{t("ui.symbol_source_arasaac_note")}</span></button>
    <button type="button" class="btn choice" aria-pressed={chosen === "metacom" ? "true" : "false"} disabled={!ready} onclick={() => void chooseSymbolSource("metacom")}><strong>{t("ui.metacom")}</strong><span>{ready ? t("ui.symbol_source_metacom_note") : t("ui.symbol_source_needs_folder")}</span></button>
    <!-- The way back in, where the folder is remembered and the browser wants
         a click. Only then: with no folder at all there is nothing to
         re-grant, and the sentence above already says to go and connect one.
         The browser's own prompt needs the gesture, so this is the handler
         and not something further in. -->
    {#if symbolSourceSleeping()}
      <p class="note">{t("ui.symbol_source_sleeping")}</p>
      <button type="button" class="btn" onclick={() => void reconnectSymbolFolder()}>{t("ui.symbol_source_reconnect")}</button>
    {/if}
  </Panel>

  <Panel bind:open={shown.voicePanel} id="voicePanel"
         group="collection" stateId="voiceState" section={t("ui.voice")}
         state={voiceState()} class="setting">
    <!-- The search field, the language pills and the rows, drawn by
         @lautstark/stimmquelle/voice-picker so that all three programmes
         show the same list. The search field went into the module with the
         rest: redrawing an input somebody is typing into takes the caret with
         it, and the module makes the same guarantee one level in, by building
         the field once and replacing only the rows under it. -->
    <div id="voiceBox" hidden={!haveVoices()}><Vanilla node={voiceListNode()} /></div>
    <!-- Not the module's "no voice matches that": this is a machine with
         nothing to choose between at all, and what to do about it is this
         product's. -->
    <p class="note" id="voiceEmpty">{voiceEmpty()}</p>
    <!-- What a different voice costs, and - when there is nothing here to
         choose between - where voices come from. -->
    <div class="hint" id="voiceHint">{voiceHint()}</div>
  </Panel>
</Sheet>
