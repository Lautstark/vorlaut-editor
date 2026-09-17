<script lang="ts">
  /* What the footer opens: about, the Impressum, and the privacy notice.
   *
   * One dialog with three bodies rather than three dialogs. They are the same
   * piece of furniture - a heading, a cross, one scrolling column of prose - and
   * the only thing that differs is which paragraphs are in it. The heading is
   * what gives the dialog its accessible name, so a reader that announces it
   * says "Impressum" while the Impressum is showing; that is also what the
   * end-to-end check looks the dialog up by.
   *
   * **Every word is in this file, and that is the change this file records.** It
   * used to be an empty element with an id per paragraph, filled in by a pass in
   * core/texts.ts that named all forty-one of them - so the markup said where a
   * sentence went and another file said which sentence, and the only thing
   * holding the two together was that somebody had written both. The prose still
   * exists twice, in boot_data.ts, and that has not changed: what is written
   * here is a key, never a string, and tests/test_language.py is what says no
   * German reaches this file.
   *
   * **It stays markup, and adopting the shared dialog is what could have taken
   * that away.** @lautstark/design/svelte/Legal draws the frame, the three
   * `<section>`s and the scroll reset; what goes inside each one arrives as a
   * snippet, so the forty-one ids are still written where the sentences are.
   * conventions.md §6.12 argues the same from the other end: every section is
   * drawn and the two that are not showing are `hidden`, because this markup is
   * *addressed* and mounting one page at a time would make whether a locator
   * resolves depend on which page happened to be open.
   *
   * The two addresses that are not prose - the repository, the mail - go
   * through shell/links.ts's guards for the reason they went through texts.ts's:
   * an href is the one thing on this page that is not inert.
   *
   * Three things about this dialog are the reason three props exist, and they
   * survive the second adoption exactly as they survived the first:
   *
   *   - The **id stays an id.** `#legal`'s 520px is an ID selector and the
   *     comment above that rule in ui.css says so: an id beats any class, so it
   *     quietly outranked whatever components.css drew for a sheet. Demoted to
   *     a class it would tie with `.sheet { width: … }` and the winner would be
   *     bundle order.
   *   - The **title is a thunk**, because it changes. One dialog with three
   *     prose sections, and the accessible name has to be the one showing. The
   *     component builds that thunk out of `pages` and the page in force.
   *   - **`page` is two-way**, because every way out - the ✕, Escape, a press
   *     outside - has to end with the dialog and legal.svelte.ts agreeing.
   *
   * The ✕ **keeps its id**, which e2e/legal.spec.ts presses. It did not, for a
   * few hours: `Legal` had no `closeId` where the `Sheet` underneath it does,
   * and the choice was between pressing the ✕ by its accessible name and
   * writing an id onto the frame after the fact, which §6.0 says not to do. It
   * was reported rather than worked around, and design v1.37.0 forwards both
   * `closeId` and `bodyId` to the sheet - so the id is a prop here, which is
   * where it should have been.
   *
   * What the ✕ gained by being the frame's is a name: the button had neither
   * `aria-label` nor `title` when this dialog drew its own, so it was announced
   * as "✕" and nothing else. `closeLabel` is required and has no fallback.
   */
  import { t } from "./live.svelte.js";
  import { outward, mailward } from "./links.js";
  import { closeLegal, LEGAL_PAGES, legalPage, setLegalPage } from "./legal.svelte.js";
  import Legal from "@lautstark/design/svelte/Legal";

  /* The three, in the order they are drawn, with the key doubling as the
     section id - which is what every locator in e2e/legal.spec.ts already
     assumed and what LEGAL_PAGES was already keyed by. */
  const pages = $derived(Object.entries(LEGAL_PAGES).map(([key, title]) => ({
    key, id: key, title: t(title),
  })));
</script>

<Legal
  bind:page={legalPage, setLegalPage}
  {pages}
  id="legal"
  closeId="legalClose"
  class="legal"
  closeLabel={t("ui.close")}
  onclose={closeLegal}
>
  {#snippet children(key)}
    {#if key === "aboutPage"}
      <p class="lead" id="aboutLead">{t("ui.about_lead")}</p>
      <h3 id="aboutLeavesHead">{t("ui.about_leaves_head")}</h3>
      <p id="aboutLeaves">{t("ui.about_leaves")}</p>
      <h3 id="aboutSymbolsHead">{t("ui.about_symbols_head")}</h3>
      <p id="aboutSymbols">{t("ui.about_symbols")}</p>
      <h3 id="aboutSourceHead">{t("ui.about_source_head")}</h3>
      <p id="aboutSource">{t("ui.about_source")}</p>
      <p class="legal__links">
        <a id="aboutRepo" href={outward(t("ui.about_repo_url"))} target="_blank" rel="noreferrer noopener">{t("ui.about_repo")}</a>
        <a id="aboutMitreden" href={outward(t("ui.about_mitreden_url"))} target="_blank" rel="noreferrer noopener">{t("ui.about_mitreden")}</a>
        <a id="aboutBildhaft" href={outward(t("ui.about_bildhaft_url"))} target="_blank" rel="noreferrer noopener">{t("ui.about_bildhaft")}</a>
      </p>
    {:else if key === "impressumPage"}
      <h3 id="impAngabenHead">{t("ui.imp_angaben_head")}</h3>
      <!-- Name, street, town and country as one value with newlines in it,
           and .address is what lets them stand as the four lines a postal
           address is. Four keys would let a translation lose one. -->
      <p class="address" id="impAddress">{t("ui.imp_address")}</p>
      <h3 id="impContactHead">{t("ui.imp_contact_head")}</h3>
      <p id="impContactLead">{t("ui.imp_contact_lead")}</p>
      <p class="legal__links">
        <a id="impMail" href={mailward(t("ui.legal_email"))}>{t("ui.legal_email")}</a>
        <a id="impIssues" href={outward(t("ui.imp_issues_url"))} target="_blank" rel="noreferrer noopener">{t("ui.imp_issues")}</a>
      </p>
      <h3 id="impResponsibleHead">{t("ui.imp_responsible_head")}</h3>
      <p id="impResponsible">{t("ui.imp_responsible")}</p>
      <h3 id="impSymbolsHead">{t("ui.imp_symbols_head")}</h3>
      <p id="impSymbols">{t("ui.imp_symbols")}</p>
      <h3 id="impLinksHead">{t("ui.imp_links_head")}</h3>
      <p id="impLinks">{t("ui.imp_links")}</p>
      <h3 id="impDisputeHead">{t("ui.imp_dispute_head")}</h3>
      <p id="impDispute">{t("ui.imp_dispute")}</p>
    {:else}
      <p class="lead" id="dsgLead">{t("ui.dsg_lead")}</p>
      <h3 id="dsgControllerHead">{t("ui.dsg_controller_head")}</h3>
      <p class="address" id="dsgController">{t("ui.dsg_controller")}</p>
      <p class="legal__links"><a id="dsgMail" href={mailward(t("ui.legal_email"))}>{t("ui.legal_email")}</a></p>
      <h3 id="dsgHostingHead">{t("ui.dsg_hosting_head")}</h3>
      <p id="dsgHosting">{t("ui.dsg_hosting")}</p>
      <h3 id="dsgArasaacHead">{t("ui.dsg_arasaac_head")}</h3>
      <p id="dsgArasaac">{t("ui.dsg_arasaac")}</p>
      <h3 id="dsgShelfHead">{t("ui.dsg_shelf_head")}</h3>
      <p id="dsgShelf">{t("ui.dsg_shelf")}</p>
      <h3 id="dsgCdnHead">{t("ui.dsg_cdn_head")}</h3>
      <p id="dsgCdn">{t("ui.dsg_cdn")}</p>
      <h3 id="dsgVoicesHead">{t("ui.dsg_voices_head")}</h3>
      <p id="dsgVoices">{t("ui.dsg_voices")}</p>
      <!-- Azure is the one that has to be read before it is switched on: it
           is the only path on which what somebody typed leaves the browser at
           all, rather than a lookup or a download. -->
      <h3 id="dsgAzureHead">{t("ui.dsg_azure_head")}</h3>
      <p id="dsgAzure">{t("ui.dsg_azure")}</p>
      <h3 id="dsgStorageHead">{t("ui.dsg_storage_head")}</h3>
      <p id="dsgStorage">{t("ui.dsg_storage")}</p>
      <h3 id="dsgDeviceHead">{t("ui.dsg_device_head")}</h3>
      <p id="dsgDevice">{t("ui.dsg_device")}</p>
      <h3 id="dsgNoneHead">{t("ui.dsg_none_head")}</h3>
      <p id="dsgNone">{t("ui.dsg_none")}</p>
      <h3 id="dsgRightsHead">{t("ui.dsg_rights_head")}</h3>
      <p id="dsgRights">{t("ui.dsg_rights")}</p>
      <p class="stand" id="dsgStand">{t("ui.dsg_stand")}</p>
    {/if}
  {/snippet}
</Legal>
