import { describe, expect, it } from "vitest";
import { zipBytes } from "../../src/data/zip.js";

describe("an archive past what classic zip can count", () => {
  /* The member count is sixteen bits in the end record. Past it, the setter
     wrapped to 0 and the archive claimed to be empty. */
  it("refuses rather than writing a count that wrapped", async () => {
    const members = Array.from({ length: 0x10000 }, (_, at) => ({
      name: `m${at}.txt`, data: new Uint8Array(0),
    }));
    await expect(zipBytes(members)).rejects.toThrow(RangeError);
  });

  it("still writes one at the limit", async () => {
    const members = Array.from({ length: 0xffff }, (_, at) => ({
      name: `m${at}.txt`, data: new Uint8Array(0),
    }));
    const bytes = await zipBytes(members);
    const tail = new DataView(bytes.buffer, bytes.length - 22);
    expect(tail.getUint16(10, true)).toBe(0xffff);
  });
});
