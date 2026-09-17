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
  import { THEMES, type Theme } from "@lautstark/design/theme";
  import { menuOn } from "@lautstark/design/menu";
  import { t } from "./live.svelte.js";
  import { outward } from "./links.js";
  import {
    azureKeyField, azureRegionField, azureState$, boardState, chooseRendering,
    chooseTheme, dataState, exportData, importData, installed, keyPlaceholder,
    metacomOffered, metacomPathField, metacomWord, ablagePanel, keepPanel,
    keepShown, pickBoardFile, preferredRendering, renderingLabel, renderings,
    setAzureKey, setAzureRegion, setMetacomPath, symbolPanelNode,
    symbolsSummary, themeLabel, themeNow, useSource,
    useUnfoldSymbols, wipeAll, activeSource,
  } from "./settings.svelte.js";
  import {
    closeSettings, fetchNote, fetchRunning, foldEpoch, forgetAzureKey,
    languagePickerNode, OPENS_WITH, pageLanguageName, PANELS, saveAzure,
    settingsOpen, somethingMissing, startFetch, voicesHereState,
  } from "./voices.svelte.js";
  import { attributionFor } from "../data/symbols.js";
  import Panel from "@lautstark/design/svelte/Panel";
  import Sheet from "@lautstark/design/svelte/Sheet";
  import Vanilla from "@lautstark/design/svelte/Vanilla";

  let dataFile: HTMLInputElement;
  let renderingPick: HTMLButtonElement;

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
    <!-- role=group, not radiogroup: components.css marks the choice with
         aria-pressed, which is the vocabulary bildhaft's print dialog already
         uses, and a radiogroup whose children are not radios reads worse than
         a labelled group of buttons. The panel's accessible name as well as
         its heading: the group of buttons inside it is three unlabelled words
         without one. -->
    <div class="segmented" id="themePick" role="group" aria-label={t("ui.theme")}>{#each THEMES as one (one)}<button type="button" aria-pressed={one === themeNow() ? "true" : "false"} onclick={() => chooseTheme(one as Theme)}>{themeLabel(one as Theme)}</button>{/each}</div>
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
    <p class="lead" id="azureIntro">{t("ui.azure_intro")}</p>
    <p class="lead"><a id="azureLink" href={outward(t("ui.azure_link_url"))} target="_blank" rel="noopener noreferrer">{t("ui.azure_link")}</a></p>
    <label id="azureKeyLabel" for="azureKey">{t("ui.azure_key")}</label>
    <input type="password" id="azureKey" class="field" autocomplete="off"
      placeholder={keyPlaceholder()} disabled={!installed().local}
      value={azureKeyField()} oninput={(e) => setAzureKey(e.currentTarget.value)} />
    <label id="azureRegionLabel" for="azureRegion">{t("ui.azure_region")}</label>
    <input type="text" id="azureRegion" class="field" autocomplete="off"
      value={azureRegionField()} oninput={(e) => setAzureRegion(e.currentTarget.value)} />
    <!-- Only the one thing the field cannot show by itself. That a key is
         stored, and which one, is in the placeholder above and in the
         heading. -->
    <p class="note" id="azureKeyState">{installed().local ? "" : t("ui.azure_local_only")}</p>
    <div class="row">
      <!-- The one Save left on this sheet, and it is here rather than on the
           dialog because a key is the one thing that must not be written as
           it is typed. -->
      <button id="azureSave" class="btn primary" type="button" onclick={() => void saveAzure()}>{t("ui.azure_save")}</button>
      <!-- Removing the key is its own button: the empty field already means
           "leave the key alone", so it cannot also mean "drop it". Only when
           there is a key to remove, and only where the key can be touched at
           all - away from the machine the whole panel is read-only. -->
      <button id="azureForget" class="btn" type="button" hidden={!installed().azureKey.set || !installed().local} onclick={() => void forgetAzureKey()}>{t("ui.azure_forget")}</button>
    </div>
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
         @lautstark/bildquelle/metacom-panel so that all three programmes show
         the same block. The licence paragraph and the link to the shop are
         the module's now. They were this repository's own words, and are in
         the package because it was the only one of the three that said where
         a licence comes from - see the module's header. -->
    <div id="metacomBox"><Vanilla node={symbolPanelNode()} /></div>

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
      <span class="menu-anchor start"><button bind:this={renderingPick} id="renderingPick" class="btn quiet sm dropdown"
        type="button" aria-haspopup="menu" aria-expanded="false"
        aria-labelledby="renderingLabel"
        onclick={() => menuOn(renderingPick, (add) => {
          const live = preferredRendering();
          add(renderingLabel(null), () => chooseRendering(null), { checked: live === null });
          for (const entry of renderings()) {
            add(renderingLabel(entry.segment), () => chooseRendering(entry.segment),
                { checked: live === entry.segment });
          }
        })}>{renderingLabel(preferredRendering())}</button></span>
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
    <!-- The store: one panel for every Lautstark programme, built by
         @lautstark/sicherung/ablage-panel so the words and the order are the
         same wherever somebody meets them. Everything below is what vorlaut
         offers besides the store. -->
    <div id="whereBox"><Vanilla node={ablagePanel()} /></div>
    <hr class="hair" />
    <p class="subhead" id="keepHead">{t("ui.keep_head")}</p>

    <p class="lead" id="dataNote">{t("ui.data_note")}</p>

    <!-- The folder first, because it is the one that keeps working after
         somebody stops thinking about it. Hidden outright where the browser
         has no picker - Safari, Firefox, anything on Android - and then the
         two buttons below are the whole offer, unchanged. -->
    <div id="folderBox" class="folderbox" hidden={!keepShown()}><Vanilla node={keepPanel()} /></div>

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
