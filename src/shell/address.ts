/* What an address is, apart from the boxes it is typed into.
 *
 * Four numbers, and the two rules about them: what one box may hold, and how a
 * whole address comes apart into four. shell/pieces/AddressRow.svelte draws
 * them and shell/tabletSend.svelte.ts sends to what they come to, and neither of those
 * two is where a reader would look for the rule.
 */
export const OCTETS = 4;

/** Whether one box holds a number an address can have in it. */
export const octet = (text: string): boolean =>
  /^\d{1,3}$/.test(text) && Number(text) <= 255;

/** `a.b.c.d` split into four, or four empty strings for anything else. */
export function split(address: string): string[] {
  const parts = address.split(".");
  if (parts.length !== OCTETS || !parts.every(octet)) {
    return Array<string>(OCTETS).fill("");
  }
  return parts;
}
