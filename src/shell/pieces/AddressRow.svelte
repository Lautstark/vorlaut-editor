<script lang="ts">
  /**
   * Four boxes rather than one field.
   *
   * design's docs/mocks/senden.css makes the argument and it is pin.css's,
   * reused: one field with four numbers in it asks somebody to count what they
   * typed, and four boxes do not. This product's user has met that shape once
   * already, on the PIN. What the content forces is the difference - three
   * digits to a box, nothing masked, and two of the four allowed to go quiet.
   *
   * **Nothing is hard-coded, and that is a decision rather than an omission.**
   * All four are typed the first time. A Fritzbox hands out 192.168.178.x, most
   * other routers 192.168.0.x, and a home network on 10.x is ordinary; a first
   * half written into the product would work in most German houses and strand
   * the rest with no way back. What the return visit gets is not a prefix but a
   * memory: the two that rarely change step back to an outline so the eye lands
   * on the two that do, and they stay fields - focusable, editable, and awake
   * the moment anybody touches one.
   */
  import { untrack } from "svelte";
  import { t } from "../live.svelte.js";
  import { OCTETS, octet, split } from "../address.js";

  let { known, value = $bindable() }: { known: string; value: string } = $props();

  /** The aria labels, written out one by one rather than built from an index.
   *  Four keys the text-usage check can see, which a template would hide. */
  const labels = $derived([
    t("ui.send_octet_1"), t("ui.send_octet_2"),
    t("ui.send_octet_3"), t("ui.send_octet_4"),
  ]);

  /* `known` is what this browser remembered and is read once: the sheet is
     opened around one answer, and a second one arriving would rewrite boxes
     somebody is typing in. */
  // svelte-ignore state_referenced_locally
  const parts = $state(split(known));
  /* The first two are the ones a house keeps: a router hands out the same half
     to everything on it, and only the tail moves between two visits. A number
     somebody has gone into is no longer a number they were told, so the quiet
     ones wake as soon as they are touched. */
  // svelte-ignore state_referenced_locally
  const quiet = $state([!!parts[0] && !!known, !!parts[1] && !!known, false, false]);

  let boxes: HTMLInputElement[] = $state([]);

  $effect(() => {
    value = parts.every(octet) ? parts.join(".") : "";
  });

  /* Into the boxes, past the corner ✕ that showModal() would otherwise leave
     focus on. The last box on a return visit and the first on a first one,
     which is the same rule the two of them are drawn by: what is being asked
     for is the part that changes. */
  $effect(() => {
    untrack(() => {
      const box = boxes[known ? OCTETS - 1 : 0];
      box?.focus();
      box?.select();
    });
  });

  function typed(at: number, raw: string): void {
    // Typed rather than validated: a letter never appears in the box at all, so
    // there is nothing to be told off about afterwards.
    const only = raw.replace(/\D/g, "");
    parts[at] = only;
    boxes[at]!.value = only;
    if (only.length === 3 && at < OCTETS - 1) boxes[at + 1]?.select();
  }

  function pressed(event: KeyboardEvent, at: number): void {
    /* The second way into the next box, and the one somebody uses without being
     * told: an address is copied the way it is written down, dots and all.
     *
     * **It moves on only out of a box with something in it**, and that condition
     * is the whole of what makes the two ways get along. Three digits have
     * already moved the caret by the time the dot after them is pressed, so a
     * dot that always moved would skip the box it had just arrived in -
     * 192.168.178.42 typed straight through came out as three numbers and an
     * empty box, which is exactly the address nobody typed. Swallowed rather
     * than ignored, so a dot never lands in a box and is then filtered out of it
     * a keystroke later. */
    if (event.key === ".") {
      event.preventDefault();
      if (parts[at] && at < OCTETS - 1) boxes[at + 1]?.select();
    }
    // Backspace at the start of an empty box steps back, so that correcting a
    // number is one key held down rather than a click into each box.
    if (event.key === "Backspace" && !parts[at] && at > 0) {
      event.preventDefault();
      boxes[at - 1]?.select();
    }
  }

  // What is pasted is the whole thing, not a third of it. Anything that is not
  // four numbers falls through to the browser's own paste, which lands in one
  // box and is then filtered to digits by the input handler above.
  function pasted(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData("text").trim() ?? "";
    const whole = text.split(".");
    if (whole.length !== OCTETS || !whole.every(octet)) return;
    event.preventDefault();
    whole.forEach((one, at) => {
      parts[at] = one;
      boxes[at]!.value = one;
      quiet[at] = false;
    });
    boxes[OCTETS - 1]?.select();
  }
</script>

<div class="address-row" onpaste={pasted} role="presentation">{#each parts as part, at (at)}{#if at}<span class="address-row__dot">.</span>{/if}<input bind:this={boxes[at]} class="address-row__box" type="text" inputmode="numeric" maxlength="3" value={part} aria-label={labels[at]} data-known={quiet[at] ? "1" : undefined} oninput={(e) => typed(at, e.currentTarget.value)} onkeydown={(e) => pressed(e, at)} onfocus={(e) => { quiet[at] = false; e.currentTarget.select(); }} />{/each}</div>
