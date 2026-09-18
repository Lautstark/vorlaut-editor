<script lang="ts">
  /* The settings sheet: this page's language, its colour scheme, where voices
   * come from, where symbols come from, and the Sammlung as a document.
   *
   * **One scope, and that is the whole rule.** Everything in here is a fact
   * about this browser or about this installation. Two panels used to be facts
   * about whichever Sammlung happened to be open - the voice, and the language
   * the device shows its own menu in - and a sheet whose answer changed when
   * somebody clicked a different row in the list is not a settings sheet. They
   * are behind that Sammlung's own ⋯ now; see CollectionSheet.svelte and
   * docs/sammlung-settings.md.
   *
   * The voice split rather than moved, and the seam is worth knowing about: the
   * Azure key and the offer to fetch the offline voices are still here, because
   * a downloaded voice is installed for every Sammlung there is. What went is
   * the choosing. So this sheet answers "which voices does this machine have"
   * and the Sammlung's answers "which one does this one speak in".
   *
   * Every section is a folded panel whose heading carries its state, so the
   * whole of what this installation is set to reads at a glance and opening one
   * is a decision.
   *
   * **The frame and the panels are @lautstark/design's.** `Sheet` is the head
   * with its ✕, the body and the one `close` exit; `Panel` is the `<details>`,
   * its summary's two spans and its body. Both were hand-written here, and both
   * are markup four products were retyping around rules they already shared -
   * conventions.md §6.1 and §6.2.
   *
   * **One open at a time**, which is `Panel`'s own `name="settings"` - the
   * platform's accordion, where a named group of <details> behaves like a radio
   * group, so opening one closes the rest and no script is involved. It is the
   * component's default and so is not written out nine times; the second sheet
   * passes `group="collection"`, and two exclusive groups in one product is
   * correct. conventions.md §3.5.
   *
   * There is no Save and no Cancel on the dialog. Everything here applies when
   * it is touched, the way every other edit on this page already does. The one
   * field that cannot work that way keeps a Save of its own, inside its panel:
   * an Azure key must not be written on every keystroke, and an empty field has
   * to keep meaning "leave the key alone" rather than "drop it".
   */
  import { t } from "./live.svelte.js";
  import { outward } from "./links.js";
  import {
    adoptDataFolder, afterMetacom, askAzure, azureState$,
    boardState, chooseRendering, chooseTheme, dataFolderChanged, dataState,
    dataStore, exportData, importData, installed, keyPlaceholder,
    metacomOffered, metacomPathField, metacomWord, keepShown, noteMetacomPress,
    pickBoardFile, preferredRendering, renderingLabel, renderings, sayData,
    sayMetacom, setMetacomPath, standingBackup,
    symbolsSummary, takeMetacomHeadline, THEME_KEY, themeLabel, themeNow, useSource,
    useUnfoldSymbols, wipeAll, activeSource,
  } from "./settings.svelte.js";
  import {
    closeSettings, fetchNote, fetchRunning, foldEpoch, forgetAzureKey,
    languagePickerNode, OPENS_WITH, pageLanguageName, PANELS, saveAzure,
    settingsOpen, somethingMissing, startFetch, voicesHereState,
  } from "./voices.svelte.js";
  import { attributionFor, metacomProvider } from "../data/symbols.js";
  import { status } from "./dom.js";
  import { LANG } from "../core/boot.js";
  import { words } from "./live.svelte.js";
  import type { MetacomAction } from "@lautstark/bildquelle/metacom-panel";
  import Dropdown from "@lautstark/design/svelte/Dropdown";
  import Panel from "@lautstark/design/svelte/Panel";
  import Sheet from "@lautstark/design/svelte/Sheet";
  import ThemePicker from "@lautstark/design/svelte/ThemePicker";
  import Vanilla from "@lautstark/design/svelte/Vanilla";
  import AblagePanel from "@lautstark/sicherung/svelte/AblagePanel";
  import BackupPanel from "@lautstark/sicherung/svelte/BackupPanel";
  import MetacomPanel from "@lautstark/bildquelle/svelte/MetacomPanel";
  import AzurePanel from "@lautstark/stimmquelle/svelte/AzurePanel";
  import type { AzureAccess, AzureAnswer, AzureWords }
    from "@lautstark/stimmquelle/svelte/AzurePanel";

  let dataFile: HTMLInputElement;

  /* What the three shared panels are told the page is in.
   *
   * `lang` is a prop now rather than the thunk each builder took, and the
   * reactivity is the framework's - conventions.md §6.8. The thunks existed
   * because LANG is a live binding a language switch reassigns and a locale
   * resolved once goes on answering in the language the reader has just left;
   * `words()` is the note that the switch happened, so this derivation is that
   * same guarantee in the shape a component can use. Their own tables hold
   * German and English only, and this product has no third language. */
  const reading = $derived.by<"de" | "en">(() => {
    words();
    return LANG === "en" ? "en" : "de";
  });

  /** The standing backup, read once the app has handed it over. Held as an
   *  answer rather than a prop because app.ts wires it, not this tree. */
  const backup = $derived(standingBackup());

  /* All four acts, including the one this repository did not have.
   * `readMetacomZip` had been sitting in data/symbols.ts since the search moved
   * into the browser with no caller at all - the wiring was built and never
   * hung on a button, which conventions.md §4.13 records as a hole rather than
   * a decision. bildhaft and wochenwerk both offer it. */
  const METACOM_ACTIONS: readonly MetacomAction[] =
    ["choose", "zip", "reread", "forget"];

  /* Every sentence the Azure panel can say, all of them this page's.
   *
   * conventions.md §6.0: a shared component carries no German, and §6.9 puts
   * the plural formatter on this side for the same reason - the count is a
   * number the panel has and only the product can put into its own language's
   * plural. `$derived`, so the language row three panels above this one
   * reaches it: the object is new and the panel redraws. That is §6.8's "lang
   * is a prop" in the shape this panel takes it, where there is no `lang` prop
   * at all because the language arrives with the words.
   *
   * `saving` is `ui.azure_checking` rather than a word of its own, and it is
   * the same sentence because it is the same act: the button is dark for
   * exactly as long as Azure is being asked. `saved` ignores its count - what
   * this page says out loud after a write has always been that it was written,
   * and the count is on the probe line beside it.
   *
   * `failed` ignores Azure's own message, which is the one place this page
   * deliberately keeps less than the panel offers. The seam is wordless by
   * design - azureState() answers with a code - so there is no message here to
   * pass on, and inventing one would be this page claiming to quote Azure.
   *
   * No `refusedOnSave`: one sentence for a refused key, which is what this
   * product has always said. No `regionHint`: there is no line under the
   * region field here to fill. */
  const azureWords = $derived<AzureWords>({
    key: t("ui.azure_key"),
    region: t("ui.azure_region"),
    save: t("ui.azure_save"),
    saving: t("ui.azure_checking"),
    forget: t("ui.azure_forget"),
    asking: t("ui.azure_checking"),
    typeFirst: t("ui.azure_key_placeholder"),
    answers: (count) => t("ui.azure_ok", { count }),
    saved: () => t("ui.settings_saved"),
    unreachable: t("ui.azure_unreachable"),
    refused: t("ui.azure_refused"),
    failed: () => t("ui.azure_probe_failed"),
  });

  /* The probe, adapted at the seam and nowhere else.
   *
   * `AzureState` is this repository's shape - four fields, one of them a code
   * for the text table to branch on - and `AzureAnswer` is the panel's. The
   * mapping is the whole adapter: `words` is the empty string because the seam
   * has none to hand over, which is exactly what makes the words above this
   * page's. A pairing nothing is configured for cannot arise - the panel asks
   * only when it has a key or has just been given one - and `failed` is the
   * honest answer if it ever did. */
  const probeForPanel = async (access: AzureAccess): Promise<AzureAnswer> => {
    const state = await askAzure(access);
    if (state.ok) return { ok: true, count: state.count };
    return { ok: false, code: state.code || "failed", words: "" };
  };

  /* Which of the nine panels are open, by the name the list gives them. Held so
     that opening the sheet can fold them back - see openSettings() - which is
     the one thing about this column that is not the browser's own accordion.
     Booleans where this was a record of elements filled by `bind:this`: the
     <details> is the component's now, and `bind:open` is how a caller reaches
     it. Two-way and not a prop, and conventions.md §6.2 is a page about why -
     the accordion makes the *browser* remove another panel's `open` attribute,
     Svelte never sees it happen, and a one-way prop's next write short-circuits
     against a record that still says open. The sheet then comes back fully
     folded, with nothing red anywhere. */
  const shown: Record<string, boolean> = $state(
    Object.fromEntries(PANELS.map((one) => [one, one === OPENS_WITH])));

  $effect(() => {
    foldEpoch();
    for (const one of PANELS) shown[one] = one === OPENS_WITH;
  });

  /* A folder that was set and cannot be read is the one state worth unfolding
     for: somebody meant to configure this and it is not working. Registered
     rather than imported, because settings.svelte.ts is what finds that out
     and this component is what holds the answer. */
  $effect(() => {
    useUnfoldSymbols(() => { shown.symbolsPanel = true; });
  });
</script>

<!-- panels: a column of <details>, 900px. The id is historic - this is the
     settings sheet, see the header. It showed the same column at 600px while
     wochenwerk showed it at 900, and wochenwerk had the reason written down.
     See design/docs/conventions.md 4.14. collectionSheet and legal stay at
     600: one asks a question about a Sammlung, the other is running text.

     `open` one-way with `onclose`, which §6.1 says is as blessed as binding:
     the sheet's state is a question asked of another module, and `bind:` cannot
     take one. `closeId` because #voiceClose is clicked in fourteen places
     across six spec files. -->
<Sheet
  open={settingsOpen()}
  onclose={closeSettings}
  id="voices"
  closeId="voiceClose"
  panels
  title={t("ui.settings")}
  closeLabel={t("ui.close")}
>
  <!-- The heading replaces the frame's own <h2> rather than sitting beside a
       hidden one, which is what `head` is for. It is here at all only for the
       id: e2e/language.spec.ts reads #settingsHeading to check that the sheet
       is titled in the language the page was just switched to. It was a
       <strong> with `font-weight: 600` restored by hand, so this is a real
       size change - 17px and 650 - and it is in a baseline. §6.1. -->
  {#snippet head()}<h2 id="settingsHeading">{t("ui.settings")}</h2>{/snippet}

  <!-- First, and deliberately: somebody who cannot read the page needs this
       one before anything else. The options name themselves. Open on arrival
       for the same reason.

       **This is the one panel whose `bind:open` is written after its id, and
       that is load-bearing.** tests/unit/settings_panels.test.ts reads this
       file as text and matches `/id="(\w+Panel)"[^>]*\bopen\b/` to assert that
       exactly one panel arrives open - and `\bopen\b` matches `bind:open` as
       readily as it matched the bare attribute this used to carry. So the
       eight folded panels put their binding *before* their id and this one puts
       it after. The test holds the arrangement in both directions: hoist this
       one and it finds none, drop one of the other eight's and it finds two. -->
  <Panel id="languagePanel" bind:open={shown.languagePanel}
         stateId="languageState" section={t("ui.language")}
         state={pageLanguageName()} class="setting">
    <!-- The segmented row is @lautstark/design/language's, put in place by a
         `display: contents` host - the same arrangement the three other
         shared panels on this sheet get. Three products had drawn the same
         row by hand and each had remembered to add something the others had
         not; the package is where that stopped being an accident.
         What the row is, and why it is not either of the two things it has
         been: the same segmented control as the scheme below it, and that
         pairing is the point - two facts about this page, offered the same
         way. It was a button and a menu, which put the choice behind a
         press, and a menu is for a list of things to do while this is a list
         of what the page already is. Not a select either: the open list of
         one is drawn by the operating system and so cannot follow the
         tokens. -->
    <Vanilla node={languagePickerNode()} />
    <p class="note" id="languageNote">{t("ui.language_title")}</p>
  </Panel>

  <!-- Beside the language, because both are what this page is rather than what
       is on the board. Three answers and not a switch: "follows the OS" is an
       answer too, and the default one - a two-state toggle has to open in light
       or dark and so has to guess, which is how a tablet that dims itself at
       dusk ends up pinned bright. -->
  <Panel bind:open={shown.themePanel} id="themePanel"
         stateId="themeState" section={t("ui.theme")}
         state={themeLabel(themeNow())} class="setting">
    <!-- The group is @lautstark/design/svelte/ThemePicker's. Four products drew
         it over one shared runtime and three of the four carried a near-
         identical comment arguing role=group over radiogroup, which §6.10 calls
         the strongest evidence in the audit that a control is ready to be
         shared - so that argument is the component's now and is not repeated
         here.
         The binding is a getter and a setter rather than a field: the answer
         lives in shell/settings.svelte.ts, where the panel's own state line
         reads it, and the component writes it down and puts it in force.
         initTheme() is the half no component mounted in a sheet can make, and
         main.ts has always called it. -->
    <ThemePicker id="themePick" key={THEME_KEY} label={themeLabel}
                 ariaLabel={t("ui.theme")}
                 bind:theme={() => themeNow(), (one) => chooseTheme(one)} />
    <!-- The counterpart to the language note above, and it exists for the
         same reason: this switch is the one that does NOT reach the device,
         and the language sitting directly above it is the reason somebody
         would assume it did. -->
    <p class="note" id="themeNote">{t("ui.theme_note")}</p>
  </Panel>

  <!-- Which voices this machine has - not which one anything speaks in.
       In the place the chooser used to hold, and deliberately: somebody who
       opens Einstellungen looking for "the voice" lands here, and the note
       inside says where the choosing moved to. -->
  <Panel bind:open={shown.voicesHerePanel} id="voicesHerePanel"
         stateId="voicesHereState" section={t("ui.voices_here")}
         state={voicesHereState()} class="setting">
    <p class="lead" id="voicesHereNote">{t("ui.voices_here_note")}</p>
    <!-- Present only when something is actually missing: a button offering
         to fetch nothing is worse than no button. With the note under it,
         always: the button used to be the word "Fetch" beside a list of
         voices, which left what it would fetch, from where, and how long it
         would take to a hint at the bottom that only appeared when there
         were no voices at all. -->
    <div class="voiceOffer" id="voiceOffer">{#if somethingMissing()}<div class="offer"><button type="button" disabled={fetchRunning()} onclick={() => void startFetch()}>{t("ui.voice_fetch")}</button><p class="note">{t("ui.voice_fetch_note")}</p></div>{/if}</div>
    <!-- How far a download has got, or how it ended. In the body rather than
         the summary: a summary carries what a section IS, and this is the
         running commentary on an errand somebody just started. -->
    <div class="hint" id="voiceOfferHint">{fetchNote()}</div>
  </Panel>

  <!-- Where the other voices come from, under the ones that are already here. -->
  <Panel bind:open={shown.azurePanel} id="azurePanel"
         stateId="azureState" section={t("ui.azure")}
         state={azureState$()} class="setting">
    <!-- @lautstark/stimmquelle/svelte/AzurePanel - conventions.md §6.9, three
         consumers and this is one of them. What went is the key field, the
         region field, the placeholder, the probe, the save and the twenty-six
         region names that all three products carried character for character.

         **The placeholder holds the key, and that is unchanged in every
         detail.** The stored key sits in `placeholder` and never in a value; a
         value can be revealed or resubmitted and a placeholder cannot; the
         field starts empty on every draw; an untouched field means "leave the
         key alone"; and removing one is its own button, because clearing the
         field cannot mean it. `stored` is deliberately not passed - the panel
         offers it for products that can read their own secret back, and this
         one cannot: `readSettings()` never hands the key to the page, so an
         untouched field here sends no key at all and `writeSettings()` reads
         that absence as "leave it alone". Absent, set, or `null` to clear: the
         three-state seam is this repository's and it is untouched.

         **The probe is injected and the words are ours.** `azureState()`
         answers with a code and no prose, boot_data.ts holds the four
         sentences in both languages, and askAzure() is where they meet. §6.9
         calls that the better half: a panel that owned a probe would have to
         own German too.

         The two paragraphs stay here as `children` for §6.0's reason - what a
         key costs and where it goes is three different paragraphs in three
         products, and `outward()` is this page's own link rule.

         No `regionHint`, so no paragraph and no `hintId`: the panel draws that
         line only where a product has one to draw, and this one never had a
         sentence under the region field. The prop is there for the day it
         does.

         The ids are props, which is what §6.9 turned the bare class hooks
         into. `#azureKey`, `#azureRegion`, `#azureSave` and `#azureForget`
         were already ids here and are unchanged, so the six spec files that
         name them still land. `#azureProbe` is new, and it is the one thing
         this panel did not have: a live region for the probe's answer, where
         somebody who has opened the panel is looking. The folded heading above
         still carries it too - see azureState$(). -->
    <AzurePanel
      id="azureBox"
      fieldId="azureKey"
      regionId="azureRegion"
      saveId="azureSave"
      forgetId="azureForget"
      probeId="azureProbe"
      hasKey={installed().azureKey.set}
      placeholder={keyPlaceholder()}
      region={installed().azureRegion}
      probe={probeForPanel}
      save={(next) => saveAzure(next)}
      forget={forgetAzureKey}
      words={azureWords}
      announce={status}
    >
      <p class="lead" id="azureIntro">{t("ui.azure_intro")}</p>
      <p class="lead"><a id="azureLink" href={outward(t("ui.azure_link_url"))} target="_blank" rel="noopener noreferrer">{t("ui.azure_link")}</a></p>
    </AzurePanel>
  </Panel>

  <!-- The two symbol sources, each stating what it is. They are not exclusive:
       a vorlaut key stores where its own picture came from, and a board may
       hold both - which is why the picker searches both and the .obz declares
       both licences. -->
  <Panel bind:open={shown.arasaacPanel} id="arasaacPanel"
         stateId="arasaacState" section={t("ui.arasaac")}
         state={activeSource() === "arasaac" ? t("ui.source_active") : t("ui.arasaac_state")}
         class="setting">
    <p class="lead" id="arasaacIntro">{t("ui.arasaac_intro")}</p>
    <!-- Not written here and not in the text table: the wording is a
         condition of the licence, so it comes from bildquelle. -->
    <p class="note" id="arasaacCredit">{attributionFor(["arasaac"]).join(" ")}</p>
    <div class="row"><button id="arasaacUse" class="btn" type="button" hidden={activeSource() === "arasaac"} onclick={() => void useSource("arasaac")}>{t("ui.source_use")}</button></div>
  </Panel>

  <Panel bind:open={shown.symbolsPanel} id="symbolsPanel"
         stateId="symbolsState" section={t("ui.symbols")}
         state={symbolsSummary()} class="setting">
    <p class="lead" id="metacomIntro">{t("ui.metacom_intro")}</p>
    <!-- The folder this browser reads, drawn by
         @lautstark/bildquelle/svelte/MetacomPanel so that all three programmes
         show the same block. The licence paragraph and the link to the shop
         are the package's now. They were this repository's own words, and are
         in the package because it was the only one of the three that said
         where a licence comes from - see the component's header.

         The twin of the builder this replaces, not a second path: same
         options, same emitted markup, same words. `#metacomBox` stays as the
         box around it rather than becoming the component's own `id` - the
         suite and the baseline both address the block as `#metacomBox
         .metacom-panel`, and a panel that IS the box has nothing for that
         descendant to find.

         `onclickcapture` is the listener wireSymbolFolder() used to add to the
         node the builder handed back: the panel's own click handler is what
         moves the status noteMetacomPress() asks about, so the sample has to
         happen on the way down. Capture on the box around it fires before the
         handler on the button inside it, which is the same moment. -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div id="metacomBox" onclickcapture={noteMetacomPress}>
      <MetacomPanel metacom={metacomProvider} actions={METACOM_ACTIONS}
        lang={reading} headline={takeMetacomHeadline} say={sayMetacom}
        after={afterMetacom} />
    </div>

    <label id="metacomLabel" for="metacomPath">{t("ui.metacom_path")}</label>
    <input type="text" id="metacomPath" class="field" autocomplete="off"
      disabled={!!installed().metacom.fixed}
      value={metacomPathField()} oninput={(e) => setMetacomPath(e.currentTarget.value)} />
    <p class="note" id="metacomState">{metacomWord()}</p>
    <p class="note" id="metacomBuildNote">{t("ui.metacom_build_uses")}</p>
    <div class="row"><button id="metacomUse" class="btn" type="button" hidden={activeSource() === "metacom" || !metacomOffered()} onclick={() => void useSource("metacom")}>{t("ui.source_use")}</button></div>

    <!-- METACOM ships the same symbols several times over - with and without
         a frame, with and without the word printed on. Only shown when the
         folder actually holds more than one; a copy pointed straight at one
         rendering has nothing to choose between. -->
    <div id="renderingBox" hidden={renderings().length < 2}>
      <!-- .lbl and not <label for>: the control is a button now, and a button
           is not a labelable element - the association has to be
           aria-labelledby rather than "for", which would silently do nothing. -->
      <span class="lbl" id="renderingLabel">{t("ui.rendering")}</span>
      <!-- The shared trigger, and it is a `.btn` rather than a `.field` here:
           this is a picker standing on its own in a settings panel, which is
           the case components.css says `.btn.dropdown` is right for. `start`
           because it sits at the left of the panel and the default hangs the
           list rightward. conventions.md §6.10. -->
      <Dropdown id="renderingPick" class="quiet sm" start labelledBy="renderingLabel"
        label={renderingLabel(preferredRendering())}
        build={(add) => {
          const live = preferredRendering();
          add(renderingLabel(null), () => chooseRendering(null), { checked: live === null });
          for (const entry of renderings()) {
            add(renderingLabel(entry.segment), () => chooseRendering(entry.segment),
                { checked: live === entry.segment });
          }
        }} />
      <p class="note" id="renderingNote">{t("ui.rendering_note")}</p>
    </div>
  </Panel>

  <!-- No state line, which is `state` left off rather than passed as "": this
       panel is two actions, and a heading that says nothing is furniture rather
       than a summary. An empty span is not the same shape - below 560px the
       summary is a two-column grid and it would be a second row and two
       pixels. §6.2. -->
  <Panel bind:open={shown.boardPanel} id="boardPanel"
         section={t("ui.collection")} class="setting">
    <p class="lead" id="boardNote">{t("ui.collection_note")}</p>
    <!-- Only the way in. Exporting is in the work head's ⋯, beside the
         Sammlung it would export - it acts on one particular Sammlung and
         this panel does not. -->
    <div class="row">
      <button id="boardImport" class="btn" type="button" onclick={pickBoardFile}>{t("ui.collection_import")}</button>
    </div>
    <!-- What the last export or import did. In the body rather than the
         summary: a summary carries what a section IS set to, and this is
         the outcome of an errand somebody just ran. -->
    <p class="note" id="boardState">{boardState()}</p>
  </Panel>

  <!-- Daten, which bildhaft and mitreden both already have and vorlaut did
       not. The board panel above it is a different act and stays: an .obz is
       a board in a format other programs read, this is the whole of what is
       in this browser, in a shape only vorlaut reads.
       No state line, for the panel above's reason. -->
  <Panel bind:open={shown.dataPanel} id="dataPanel"
         section={t("ui.data_section")} class="setting">
    <!-- The store: one panel for every Lautstark programme, drawn by
         @lautstark/sicherung/svelte/AblagePanel so the words and the order are
         the same wherever somebody meets them. Everything below is what vorlaut
         offers besides the store.

         Below it and not in its `below` snippet, which is what that option is
         for: the folder question is answered first, and what this repository
         offers besides the store is a separate offer under a subheading of its
         own. `#whereBox` stays for the METACOM box's reason - the suite and the
         baseline both address this as `#whereBox .where-panel`. -->
    <div id="whereBox">
      <AblagePanel store={dataStore()} adopt={adoptDataFolder}
        changed={dataFolderChanged} say={sayData} lang={reading} />
    </div>
    <hr class="hair" />
    <p class="subhead" id="keepHead">{t("ui.keep_head")}</p>

    <p class="lead" id="dataNote">{t("ui.data_note")}</p>

    <!-- The folder first, because it is the one that keeps working after
         somebody stops thinking about it. Hidden outright where the browser
         has no picker - Safari, Firefox, anything on Android - and then the
         two buttons below are the whole offer, unchanged. -->
    <div id="folderBox" class="folderbox" hidden={!keepShown()}>
      {#if backup}<BackupPanel {backup} say={sayData} lang={reading} />{/if}
    </div>

    <div class="row">
      <button id="dataExport" class="btn" type="button" onclick={() => void exportData()}>{t("ui.data_export")}</button>
      <button id="dataImport" class="btn" type="button" onclick={() => dataFile.click()}>{t("ui.data_import")}</button>
      <input bind:this={dataFile} type="file" id="dataFile" accept="application/json,.json" hidden
        onchange={() => { const file = dataFile.files?.[0]; dataFile.value = ""; if (file) void importData(file); }} />
    </div>
    <p class="note" id="dataState">{dataState()}</p>
  </Panel>

  <!-- Deletion is not filed under the word for keeping things: its own panel,
       last in the column, so the list of headings says what is in this sheet
       without anybody opening one of them.
       No state line, for the two panels above's reason. -->
  <Panel bind:open={shown.dangerPanel} id="dangerPanel"
         section={t("ui.danger_section")} class="setting">
    <p class="lead" id="dangerNote">{t("ui.danger_note")}</p>
    <div class="row">
      <button id="dangerWipe" class="btn destructive" type="button" onclick={() => void wipeAll()}>{t("ui.danger_wipe")}</button>
    </div>
  </Panel>
</Sheet>
