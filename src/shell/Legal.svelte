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
   * **Every word is in this file now, and that is the change.** It used to be
   * an empty element with an id per paragraph, filled in by a pass in
   * core/texts.ts that named all forty-one of them - so the markup said where a
   * sentence went and another file said which sentence, and the only thing
   * holding the two together was that somebody had written both. The prose
   * still exists twice, in boot_data.ts, and that has not changed: what is
   * written here is a key, never a string, and tests/test_language.py is what
   * says no German reaches this file.
   *
   * The two addresses that are not prose - the repository, the mail - go
   * through shell/links.ts's guards for the reason they went through texts.ts's:
   * an href is the one thing on this page that is not inert.
   */
  import { t } from "./live.svelte.js";
  import { outward, mailward } from "./links.js";
  import { closeLegal, LEGAL_PAGES, legalPage } from "./legal.svelte.js";

  let dialog: HTMLDialogElement;
  let body: HTMLElement;

  const page = $derived(legalPage());

  $effect(() => {
    if (!page) { if (dialog.open) dialog.close(); return; }
    // From the top every time. The sheet keeps its scroll position, and the
    // privacy notice is long enough that reopening it half way down reads as a
    // page that starts in the middle of a sentence.
    body.scrollTop = 0;
    if (!dialog.open) dialog.showModal();
  });
</script>

<dialog bind:this={dialog} id="legal" class="sheet legal" aria-labelledby="legalHeading" onclose={closeLegal}>
  <div class="head">
    <strong id="legalHeading">{page ? t(LEGAL_PAGES[page]) : ""}</strong>
    <button id="legalClose" class="btn quiet icon" type="button" onclick={closeLegal}>✕</button>
  </div>
  <div bind:this={body} class="body">

    <section id="aboutPage" hidden={page !== "aboutPage"}>
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
    </section>

    <section id="impressumPage" hidden={page !== "impressumPage"}>
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
    </section>

    <section id="privacyPage" hidden={page !== "privacyPage"}>
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
    </section>

  </div>
</dialog>
