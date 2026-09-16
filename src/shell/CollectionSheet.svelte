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
   * §3.5's folded panels, one open at a time through `name="collection"` - the
   * platform's own accordion, the same as the settings sheet uses.
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
  import Vanilla from "./pieces/Vanilla.svelte";

  let dialog: HTMLDialogElement;
  let langPick: HTMLButtonElement;
  let languagePanel: HTMLDetailsElement;
  let symbolPanel: HTMLDetailsElement;
  let voicePanel: HTMLDetailsElement;
  const editorNodes: HTMLDetailsElement[] = $state([]);

  const panels = $derived(editorPanels());
  const chosen = $derived(symbolSourceChosen());
  const ready = $derived(metacomOffered());

  $effect(() => {
    if (!collectionSheetOpen()) { if (dialog.open) dialog.close(); return; }
    if (!dialog.open) dialog.showModal();
    /* Whichever panel is first is open on arrival. A sheet of two, or of one,
       opening entirely folded is a sheet that asks for a second click before it
       says anything - which is the opposite of what the folding is for.
       The first one that is *there*, whichever that is: assigning `open` down
       the list would do it too, but only because the accordion closes the
       previous one, which is the browser undoing something this line should not
       have said in the first place. */
    const shown = [
      ...(deviceLanguageShown() ? [languagePanel] : []),
      ...editorNodes.filter(Boolean), symbolPanel, voicePanel,
    ];
    for (const one of shown) one.toggleAttribute("open", one === shown[0]);
  });
</script>

<dialog bind:this={dialog} id="collectionSheet" class="sheet" onclose={closeCollectionSettings}>
  <div class="head">
    <strong id="collectionSheetHeading">{t("ui.collection_settings")}</strong>
    <button id="collectionSheetClose" class="btn quiet icon" type="button" title={t("ui.close")} aria-label={t("ui.close")} onclick={closeCollectionSettings}>✕</button>
  </div>
  <div class="body">

  <!-- The language the device shows its own menu in. First, and open on
       arrival, because it is the one a talker Sammlung is usually opened for -
       and hidden outright on a tablet Sammlung, where the voice decides the
       locale and this would be a field with nothing downstream of it. -->
  <details bind:this={languagePanel} class="panel" name="collection" id="collectionLanguagePanel" hidden={!deviceLanguageShown()}>
    <summary>
      <span class="section" id="collectionLanguageSection">{t("ui.collection_language")}</span>
      <span class="state" id="collectionLanguageState">{collectionLanguageName()}</span>
    </summary>
    <div class="setting">
      <!-- The options name themselves - "Deutsch" stays "Deutsch" whatever the
           page is set to. That matters twice over here: this is the language
           of a device somebody else will hold. -->
      <span class="menu-anchor start"><button bind:this={langPick} id="collectionLangPick" class="btn quiet sm dropdown"
        type="button" aria-haspopup="menu" aria-expanded="false"
        aria-labelledby="collectionLanguageSection"
        onclick={() => menuOn(langPick, (add) => {
          const live = collectionLanguageCode();
          for (const one of deviceLanguages()) {
            add(one.name, () => void chooseCollectionLanguage(one.code), { checked: one.code === live });
          }
        })}>{collectionLanguageName()}</button></span>
      <p class="note" id="collectionLanguageNote">{t("ui.collection_language_note")}</p>
    </div>
  </details>

  <!-- What the editor on screen has to say about the Sammlung as a whole, and
       it is not written here: on a tablet that is the grid and the press
       timings, which are that target's in the way the language above is the
       talker's. The ids are made from each panel's `name`, which is how
       #collectionEditorPanel and the rest still exist to be looked up. -->
  <!-- Destroyed and built again on every open, which is what the `{#key}` is
       for: a panel's pending choice lives nowhere but inside it, so closing the
       sheet has to be how that choice is declined. A <dialog> that is closed is
       hidden rather than emptied, and a component left standing in one carries
       its half-made decision into the next open. voices.svelte.ts's
       openCollectionSettings() is where the number moves. -->
  {#key collectionEpoch()}
  {#each panels as panel, index (panel.name)}
    <details bind:this={editorNodes[index]} class="panel panel--editor" name="collection" id="{panel.name}Panel">
      <summary>
        <span class="section" id="{panel.name}Section">{panel.section()}</span>
        <span class="state" id="{panel.name}State">{panel.state()}</span>
      </summary>
      <div class="setting" id="{panel.name}Body">
        <panel.body />
      </div>
    </details>
  {/each}
  {/key}

  <!-- Which symbol collection this Sammlung's pictures come from. Both targets
       have it, because both have pictures - unlike the language above, which
       is the talker's, and the panel above that, which is whichever editor is
       on screen. exchange/SPEC.md §5.1 makes one source per package a rule of
       the format, so this is the Sammlung's own fact and not this browser's. -->
  <details bind:this={symbolPanel} class="panel" name="collection" id="symbolPanel">
    <summary>
      <span class="section" id="symbolSection">{t("ui.symbol_source_section")}</span>
      <span class="state" id="symbolState">{chosen === "metacom" ? t("ui.metacom") : t("ui.arasaac")}</span>
    </summary>
    <div class="setting" id="symbolBody">
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
    </div>
  </details>

  <details bind:this={voicePanel} class="panel" name="collection" id="voicePanel">
    <summary>
      <span class="section" id="voiceSection">{t("ui.voice")}</span>
      <span class="state" id="voiceState">{voiceState()}</span>
    </summary>
    <div class="setting">
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
    </div>
  </details>

  </div>
</dialog>
