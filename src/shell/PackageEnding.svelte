<script lang="ts">
  import { weighs } from "@lautstark/werkzeuge/bytes";
  import { t } from "./live.svelte.js";
  import type { Exporting } from "./packageExport.svelte.js";
  let { s }: { s: Exporting } = $props();
</script>

<p>{t("ui.package_ready", { name: s.name, size: weighs(s.made?.blob.size ?? 0) })}</p>
<!-- The gaps, said here as well as in the status line, and the two are not the
     same sentence. The line behind the sheet is the outcome and outlives it -
     design.md §4.3 - while this one is on the sheet somebody is standing on,
     deciding, and says the thing that decision wants to know: the package works,
     and the keys without a picture will show their word. It exists because the
     sheet stays up now; it used to be gone before the status line was read. -->
<p class="notice" hidden={!s.made?.missing}>{t("ui.package_gaps", { n: s.made?.missing ?? 0 })}</p>
