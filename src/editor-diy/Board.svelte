<script lang="ts">
  /* The five-key talker's board: the page tabs, a line saying how full the
   * device is, and the board as the hardware really lays it out.
   *
   * This is the device-specific half. Five keys to a page, a hole where the
   * speaker is, and a cap on the pages that is the device's own: none of that is
   * true of AAC in general and all of it is true of this hardware, which is why
   * it sits under editor-diy/ and why nothing in the shell may import it. The
   * shell reaches it through core/editor.ts instead, and app.ts is what mounts
   * this component into the hole the frame leaves.
   *
   * The log of what was sent used to be a <pre> at the foot of this, growing
   * under the work head while a transfer ran. It went to the loader page with
   * the cable (adr/0011). Everything that used to sit beside these in one <main>
   * and is not about this device - the save conflict, the file input - stayed
   * behind in the shell.
   */
  import Tabs from "./Tabs.svelte";
  import Device from "./Device.svelte";
</script>

<Tabs />
<Device />
