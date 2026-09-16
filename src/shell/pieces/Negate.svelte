<script lang="ts">
  /**
   * The negation cross, as an element to lay over a picture.
   *
   * German AAC negates by crossing the symbol out rather than by using a
   * different picture - see Slot.negated in core/types.ts, which is the field
   * this draws. bildhaft draws the same mark from the same convention; the two
   * do not share code, and the shape is what they agree on.
   *
   * SVG with preserveAspectRatio="none", so one element serves a square preview,
   * a cell the width of a grid column and a tile: the stroke stretches to
   * whatever box it is put in and still reads as one line across the whole
   * symbol rather than through its middle. Sized and coloured by CSS - see
   * .negate in ui.css - because the page has two colour schemes and a hex
   * written here would be right in one of them.
   *
   * aria-hidden, and deliberately: what the cross means belongs on the thing it
   * is over, in words, not on the decoration. The cell's own accessible name
   * carries it.
   */
</script>

<svg class="negate" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M12 12 L88 88 M88 12 L12 88"/></svg>
