<script lang="ts">
  /** The sentence under a row, or beside it. Its own component because a row
   *  whose sentence changes with the answer has to rewrite one rather than
   *  rebuild the row around it - and because the two act rows name theirs with
   *  `aria-describedby`, which needs an id the caller chose. */
  let { id = "", text = "" }: { id?: string; text?: string } = $props();
</script>

<span class="form__hint" {id}>{text}</span>
