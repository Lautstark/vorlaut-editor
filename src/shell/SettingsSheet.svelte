<script lang="ts">
  /* The settings sheet: five panels - „Sprache & Aussehen“, „Symbole“,
   * „Stimmen“, „Sammlung“ and „Deine Daten“.
   *
   * **The rule each panel follows is „Deine Daten“'s**, the Lautstark settings
   * design bildhaft shipped first (bildhaft 6a9c2a4): one box that says how
   * things stand, at most one button where something is to be done, and the
   * rest in a ⋯. Worded so that somebody who has never heard „aktive Quelle“
   * or „Region“ can still answer every question here. Three of the five are
   * the packages' own components - `SymbolePanel` (bildquelle),
   * `AzureConnection` (stimmquelle) and `DatenPanel` (sicherung).
   *
   * **One scope, and that is the whole rule.** Everything in here is a fact
   * about this browser or about this installation. Which voice a Sammlung
   * speaks in, and the language its device shows its own menu in, are behind
   * that Sammlung's own ⋯ - see CollectionSheet.svelte and
   * docs/sammlung-settings.md. So the voice panel here answers "which voices
   * does this machine have" - the offline ones and the Azure connection - and
   * not "which one does this Sammlung speak in".
   *
   * **The frame and the panels are @lautstark/design's.** `Sheet` is the head
   * with its ✕, the body and the one `close` exit; `Panel` is the `<details>`,
   * its summary's two spans and its body. conventions.md §6.1 and §6.2.
   *
   * **One open at a time**, which is `Panel`'s own `name="settings"` - the
   * platform's accordion. It is the component's default and so is not written
   * out five times. conventions.md §3.5.
   *
   * There is no Save and no Cancel on the dialog. Everything here applies when
   * it is touched. The one exception is the Azure form, which keeps a Save of
   * its own: half a key is not a key.
   */
  import { t } from "./live.svelte.js";
  import { outward } from "./links.js";
  import {
    adoptDataFolder, askAzure, boardState, chooseRendering, chooseTheme,
    dataFolderChanged, dataState, dataStore, exportData, importData, installed,
    pickBoardFile, preferredRendering, sayData, standingBackup, THEME_KEY,
    themeLabel, themeNow, useSource, useUnfoldSymbols, wipeAll, activeSource,
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
  import type { SymbolSource } from "@lautstark/bildquelle/symbole-panel";
  import Panel from "@lautstark/design/svelte/Panel";
  import Sheet from "@lautstark/design/svelte/Sheet";
  import ThemePicker from "@lautstark/design/svelte/ThemePicker";
  import Vanilla from "@lautstark/design/svelte/Vanilla";
  import DatenPanel from "@lautstark/sicherung/svelte/DatenPanel";
  import SymbolePanel from "@lautstark/bildquelle/svelte/SymbolePanel";
  import AzureConnection, { type AzureConnectionWords }
    from "@lautstark/stimmquelle/svelte/AzureConnection";
  import type { AzureAccess, AzureAnswer } from "@lautstark/stimmquelle/svelte/AzurePanel";

  /* What „Deine Daten“ says in its heading: where the work is. */
  let dataHead = $state("");

  /* What „Symbole“ says in its heading: which pictures are in force. The
     panel works the sentence out; this only holds it for the frame. */
  let symbolsHead = $state("");

  /* What the three shared panels are told the page is in.
   *
   * `lang` is a prop and the reactivity is the framework's - conventions.md
   * §6.8. `words()` is the note that a language switch happened, which
   * reassigns LANG without reloading the page. Their own tables hold German
   * and English only, and this product has no third language. */
  const reading = $derived.by<"de" | "en">(() => {
    words();
    return LANG === "en" ? "en" : "de";
  });

  /** The standing backup, read once the app has handed it over. Held as an
   *  answer rather than a prop because app.ts wires it, not this tree. */
  const backup = $derived(standingBackup());

  /* ------------------------------------------------------------ Symbole --- */

  /*
   * ARASAAC or METACOM, as one question. The panel draws the two answers, the
   * setting-up of a folder and the ⋯; this file keeps which one is in force,
   * as `activeProvider`, through useSource().
   *
   * The panel calls `pick` when somebody taps a card, after a folder has been
   * read in (METACOM becomes the answer, which is what „Einrichten“ promised),
   * and after a forgotten folder that was the answer (ARASAAC again). Nothing
   * on any board moves: the source binds what the picker offers next, and a
   * Sammlung that has chosen its own source keeps it.
   */
  const pickSource = (source: SymbolSource): Promise<void> => useSource(source);

  /* The ARASAAC credit. Not written here and not in the text table: the
     wording is a condition of the licence, so it comes from bildquelle. */
  const arasaacCredit = $derived(attributionFor(["arasaac"]).join(" ") || null);

  /* ------------------------------------------------------------- Stimmen --- */

  /* Where a region is, in the words of somebody who has never opened the
     Azure portal. Only the ones in Europe; anything else reads as Azure's
     code. bildhaft's list. */
  const regionName = (code: string): string => {
    const english = reading === "en";
    const names: Record<string, string> = {
      germanywestcentral: "Frankfurt",
      westeurope: t("ui.region_westeurope"),
      northeurope: english ? "Ireland" : "Irland",
      switzerlandnorth: english ? "Zurich" : "Z\u00fcrich",
      francecentral: "Paris",
      uksouth: "London",
      swedencentral: t("ui.region_sweden"),
      norwayeast: "Oslo",
    };
    return names[code] ?? code;
  };

  /* Every sentence the Azure connection can say, all of them this page's.
   *
   * conventions.md §6.0: a shared component carries no German, and §6.9 puts
   * the plural formatter on this side. `$derived`, so a language switch
   * reaches it: the object is new and the panel redraws.
   *
   * `failed` ignores Azure's own message: the seam is wordless by design -
   * azureState() answers with a code - so there is no message to pass on. */
  const azureWords = $derived<AzureConnectionWords>({
    title: t("ui.azure_title"),
    off: t("ui.azure_off"),
    on: t("ui.azure_on"),
    refusedState: t("ui.azure_refused_state"),
    offNote: t("ui.azure_off_note"),
    onNote: (hint, region) => t("ui.azure_on_note", { hint, region }),
    refusedNote: t("ui.azure_refused_note"),
    connect: t("ui.azure_connect"),
    change: t("ui.azure_change"),
    check: t("ui.azure_check"),
    key: t("ui.azure_key"),
    region: t("ui.azure_region"),
    regionHint: t("ui.region_hint"),
    save: t("ui.azure_save"),
    cancel: t("ui.cancel"),
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

  /* The probe, adapted at the seam and nowhere else: `AzureState` is this
   * repository's shape and `AzureAnswer` is the panel's. `key` absent means
   * the stored one, which azureState() reads itself - the page never hands
   * the secret back to the component, so `stored` is not passed either. */
  const probeForPanel = async (access: AzureAccess): Promise<AzureAnswer> => {
    const state = await askAzure(access);
    if (state.ok) return { ok: true, count: state.count };
    return { ok: false, code: state.code || "failed", words: "" };
  };

  /* Which of the five panels are open, by the name the list gives them. Held
     so that opening the sheet can fold them back - see openSettings(). Bound
     two-way, because the accordion makes the *browser* remove another panel's
     `open` attribute and a one-way prop would go on saying "open" for it -
     conventions.md §6.2. */
  const shown: Record<string, boolean> = $state(
    Object.fromEntries(PANELS.map((one) => [one, one === OPENS_WITH])));

  $effect(() => {
    foldEpoch();
    for (const one of PANELS) shown[one] = one === OPENS_WITH;
  });

  /* A folder that was set and cannot be read is the one state worth unfolding
     for: somebody meant to set this up and it is not working. Registered
     rather than imported, because settings.svelte.ts is what finds that out
     and this component is what holds the answer. */
  $effect(() => {
    useUnfoldSymbols(() => { shown.symbolsPanel = true; });
  });
</script>

<!-- A column of <details>, 900px. The id is historic - this is the settings
     sheet. design/docs/conventions.md 4.14.

     `open` one-way with `onclose`, which §6.1 says is as blessed as binding.
     `closeId` because #voiceClose is clicked across the specs, and `titleId`
     because e2e/language.spec.ts reads #settingsHeading. -->
<Sheet
  open={settingsOpen()}
  onclose={closeSettings}
  id="voices"
  closeId="voiceClose"
  titleId="settingsHeading"
  panels
  title={t("ui.settings")}
  closeLabel={t("ui.close")}
>
  <!-- Sprache & Aussehen first, and the one panel that opens on arrival:
       somebody who cannot read the page needs it before anything else, and
       the languages name themselves. Both rows are how this page looks to the
       person in front of it, and neither reaches the device.

       **This is the one panel whose `bind:open` is written after its id, and
       that is load-bearing.** tests/unit/settings_panels.test.ts reads this
       file as text and matches `/id="(\w+Panel)"[^>]*\bopen\b/` to assert that
       exactly one panel arrives open - and `\bopen\b` matches `bind:open`. So
       the folded panels put their binding *before* their id and this one puts
       it after. -->
  <Panel id="languagePanel" bind:open={shown.languagePanel}
         stateId="languageState" section={t("ui.look")}
         state={`${pageLanguageName()} · ${themeLabel(themeNow())}`} class="setting">
    <!-- The language row is @lautstark/design/language's, put in place by a
         `display: contents` host. The scheme beside it is ThemePicker, whose
         binding is a getter and a setter: the answer lives in
         shell/settings.svelte.ts, where the panel's state line reads it. -->
    <div class="opt"><span class="opt__label">{t("ui.language")}</span><Vanilla node={languagePickerNode()} /></div>
    <div class="opt"><span class="opt__label">{t("ui.theme")}</span><ThemePicker id="themePick" key={THEME_KEY} label={themeLabel}
                 ariaLabel={t("ui.theme")}
                 bind:theme={() => themeNow(), (one) => chooseTheme(one)} /></div>
    <p class="note" id="lookNote">{t("ui.look_note")}</p>
  </Panel>

  <!-- Symbole: @lautstark/bildquelle/svelte/SymbolePanel. One question, two
       answers; METACOM is offered as an answer only once its folder is read,
       and setting it up is one sentence and one button. The rendering choice
       sits in METACOM's ⋯. -->
  <Panel bind:open={shown.symbolsPanel} id="symbolsPanel"
         stateId="symbolsState" section={t("ui.symbols")}
         state={symbolsHead} class="setting">
    <SymbolePanel id="symbolsBox" metacom={metacomProvider}
      current={activeSource() === "metacom" ? "metacom" : "arasaac"}
      pick={pickSource} say={status} attribution={arasaacCredit}
      rendering={{ current: preferredRendering(), choose: chooseRendering }}
      headline={(text) => { symbolsHead = text; }} lang={reading} />
  </Panel>

  <!-- Stimmen: which voices this machine has, and under them Azure as a
       connection that is there or not. Once it is, its voices join the same
       list in each Sammlung's own settings; there is nothing else to find. -->
  <Panel bind:open={shown.voicesHerePanel} id="voicesHerePanel"
         stateId="voicesHereState" section={t("ui.voices_here")}
         state={voicesHereState()} class="setting">
    <p class="lead" id="voicesHereNote">{t("ui.voices_here_note")}</p>
    <!-- Present only when something is actually missing: a button offering
         to fetch nothing is worse than no button. -->
    <div class="voiceOffer" id="voiceOffer">{#if somethingMissing()}<div class="offer"><button type="button" disabled={fetchRunning()} onclick={() => void startFetch()}>{t("ui.voice_fetch")}</button><p class="note">{t("ui.voice_fetch_note")}</p></div>{/if}</div>
    <!-- How far a download has got, or how it ended. -->
    <div class="hint" id="voiceOfferHint">{fetchNote()}</div>
    <!-- @lautstark/stimmquelle/svelte/AzureConnection: the state in one box
         and one button, which unfolds AzurePanel's key-and-region form.

         **The key never comes back to the page as a value.** `stored` is not
         passed, so an untouched key field sends no key at all and
         writeSettings() reads that absence as "leave it alone"; the form
         shows the last four characters in its placeholder. Removing a key is
         its own button inside the form.

         The two paragraphs are `children`, shown while connecting for the
         first time: what a key brings and where it comes from. -->
    <AzureConnection
      id="azureBox"
      formId="azureForm"
      fieldId="azureKey"
      regionId="azureRegion"
      saveId="azureSave"
      forgetId="azureForget"
      probeId="azureProbe"
      hasKey={installed().azureKey.set}
      hint={installed().azureKey.hint}
      region={installed().azureRegion || undefined}
      {regionName}
      probe={probeForPanel}
      save={(next) => saveAzure(next)}
      forget={forgetAzureKey}
      words={azureWords}
      announce={status}
    >
      <p class="lead" id="azureIntro">{t("ui.azure_intro")}</p>
      <p class="lead"><a id="azureLink" href={outward(t("ui.azure_link_url"))} target="_blank" rel="noopener noreferrer">{t("ui.azure_link")}</a></p>
    </AzureConnection>
  </Panel>

  <!-- No state line, which is `state` left off rather than passed as "": this
       panel is one action, and a heading that says nothing is furniture. §6.2. -->
  <Panel bind:open={shown.boardPanel} id="boardPanel"
         section={t("ui.collection")} class="setting">
    <p class="lead" id="boardNote">{t("ui.collection_note")}</p>
    <!-- Only the way in. Exporting is in the work head's ⋯, beside the
         Sammlung it would export. -->
    <div class="row">
      <button id="boardImport" class="btn" type="button" onclick={pickBoardFile}>{t("ui.collection_import")}</button>
    </div>
    <!-- What the last import did. -->
    <p class="note" id="boardState">{boardState()}</p>
  </Panel>

  <!-- „Deine Daten“, @lautstark/sicherung/svelte/DatenPanel: the same panel in
       every Lautstark programme. One box says where the work is and whether
       that is safe, at most one button sits under it, and the ⋯ in its corner
       holds the rest - another folder, the backup file out and in, the dated
       second copy while the work is in the browser, and deleting everything,
       which still asks first. The board panel above it is a different act: an
       .obz is a board in a format other programs read, this is the whole of
       what is in this browser, in a shape only vorlaut reads. -->
  <Panel bind:open={shown.dataPanel} id="dataPanel"
         section={t("ui.data_section")} state={dataHead} class="setting">
    <div id="whereBox">
      <DatenPanel store={dataStore()} adopt={adoptDataFolder}
        changed={dataFolderChanged} say={sayData} lang={reading}
        {backup}
        headline={(text) => { dataHead = text; }}
        file={{ download: () => void exportData(), read: (file) => void importData(file), note: t("ui.data_file_note") }}
        wipe={() => void wipeAll()} />
    </div>
    <!-- What the last export, import or deletion did. -->
    <p class="note" id="dataState">{dataState()}</p>
  </Panel>
</Sheet>
