import { describe, expect, it } from "vitest";
import {
  buildDevicePackage, sniffImageType, type DeviceSource,
} from "../../src/data/device_package.js";
import { KEYS_PER_SET } from "../../src/device/layout_facts.js";
import { PAGE_KEY } from "../../src/core/types.js";
import type { DiyLayout, Slot } from "../../src/core/types.js";

/* Three things about one board's document that device/fixtures/package/ does
 * not (yet) hold the writer to, each of them found by reading the code rather
 * than by a fixture failing:
 *
 *   - the page key's cross, which reached the talker only once a fixture asked
 *     for it - kept here too, because the pin can lag the fixture;
 *   - two references behind the same bytes, which collapsed into one entry;
 *   - an SVG with a comment or a DOCTYPE before its root, which was sniffed as
 *     octet-stream and drawn as the grey cross.
 */

const COLLECTION = { id: "sammlung-1", name: "Probe" };

const page = (slots: Slot[]): DiyLayout => ({
  language: "de",
  sleep_timeout_seconds: 600,
  sets: [{ name: "Eins", slots }],
});

const blank = (): Slot[] =>
  Array.from({ length: KEYS_PER_SET }, () => ({ text: "", symbol: "" }));

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const source = (key: string): DeviceSource =>
  ({ key, bytes: PNG, contentType: "image/png" });

describe("the page key crossed out", () => {
  it("carries ext_vorlaut_negated, as any of the other four does", () => {
    const slots = blank();
    slots[PAGE_KEY] = { text: "ja", symbol: "ja.png", negated: true };
    const board = buildDevicePackage({
      layout: page(slots), voice: "", collection: COLLECTION,
      sources: new Map([["ja.png", source("aaaa")]]), sounds: new Map(),
    }).boards[0]!;
    const key = board.buttons.find((one) => one.id === "set-1-set")!;
    expect(key.ext_vorlaut_negated).toBe(true);
  });
});

describe("two references behind the same bytes", () => {
  it("are two entries sharing one member, each keeping its own reference", () => {
    const slots = blank();
    slots[0] = { text: "a", symbol: "hund.png" };
    slots[1] = { text: "b", symbol: "metacom:Hund" };
    const same = source("abcd");
    const pkg = buildDevicePackage({
      layout: page(slots), voice: "", collection: COLLECTION,
      sources: new Map([["hund.png", same], ["metacom:Hund", same]]),
      sounds: new Map(),
    });
    const board = pkg.boards[0]!;
    expect(board.images).toHaveLength(2);
    const byId = new Map(board.images.map((one) => [one.id, one]));
    const [own, metacom] = [board.buttons[0]!, board.buttons[1]!];
    expect(byId.get(own.image_id!)!.symbol)
      .toEqual({ set: "vorlaut", filename: "hund.png" });
    expect(byId.get(metacom.image_id!)!.symbol)
      .toEqual({ set: "metacom", filename: "Hund" });
    // One file in the archive, which is what naming members by content is for.
    expect(new Set(board.images.map((one) => one.path))).toEqual(
      new Set(["images/abcd.png"]));
    expect([...pkg.files.keys()]).toEqual(["images/abcd.png"]);
  });

  it("and two unresolved references that fold to one id stay two", () => {
    const slots = blank();
    slots[0] = { text: "a", symbol: "metacom:Haus" };
    slots[1] = { text: "b", symbol: "metacom-Haus" };
    const board = buildDevicePackage({
      layout: page(slots), voice: "", collection: COLLECTION,
      sources: new Map(), sounds: new Map(),
    }).boards[0]!;
    expect(board.images).toHaveLength(2);
    expect(board.buttons[0]!.image_id).not.toBe(board.buttons[1]!.image_id);
  });

  it("while one reference used twice is still one entry", () => {
    const slots = blank();
    slots[0] = { text: "a", symbol: "hund.png" };
    slots[1] = { text: "b", symbol: "hund.png", negated: true };
    const board = buildDevicePackage({
      layout: page(slots), voice: "", collection: COLLECTION,
      sources: new Map([["hund.png", source("abcd")]]), sounds: new Map(),
    }).boards[0]!;
    expect(board.images.map((one) => one.id)).toEqual(["img-abcd"]);
  });
});

describe("an SVG, whatever stands before its root", () => {
  const svg = (text: string) => sniffImageType(new TextEncoder().encode(text));

  it.each([
    ["bare", "<svg xmlns='http://www.w3.org/2000/svg'/>"],
    ["declared", "<?xml version='1.0'?>\n<svg/>"],
    ["with a generator comment", "<!-- Generator: Illustrator -->\n<svg/>"],
    ["with a DOCTYPE",
     '<?xml version="1.0"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" ' +
     '"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg/>'],
    ["with an internal subset", "<!DOCTYPE svg [ <!ENTITY a 'b'> ]><svg>"],
    ["behind a byte-order mark", "﻿<svg/>"],
  ])("is image/svg+xml %s", (_, text) => {
    expect(svg(text)).toBe("image/svg+xml");
  });

  it("but an XML document that is not one is not", () => {
    // This used to be image/svg+xml on the strength of `<?xml` alone.
    expect(svg("<?xml version='1.0'?><html/>")).toBe("application/octet-stream");
    expect(svg("<svgfoo/>")).toBe("application/octet-stream");
  });
});
