/* What the editor does with what the address asked for.
 *
 * The id check is not here any more. It is `@lautstark/werkzeuge/sammlung`'s,
 * along with its own tests, because mitreden and bildhaft read the same links
 * and a regex nobody tests is a regex somebody relaxes. What is left is the
 * half that is vorlaut's: four answers, four things to say, and only one of
 * them touching the store.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const wanted = vi.hoisted(() => vi.fn());
const adopt = vi.hoisted(() => vi.fn());
const status = vi.hoisted(() => vi.fn());

vi.mock("@lautstark/werkzeuge/sammlung", () => ({ wanted }));
vi.mock("../../src/shell/adopt.js", () => ({
  adopt,
  adopted: ({ name }: { name: string }) => `adopted ${name}`,
  refusal: (error: unknown) => `refused ${String(error)}`,
}));
vi.mock("../../src/shell/dom.js", () => ({ status, $: () => undefined }));
vi.mock("../../src/core/texts.js", () => ({ t: (key: string) => key }));
vi.mock("../../src/core/errors.js", () => ({ reason: (e: unknown) => String(e) }));
vi.mock("../../src/data/backup.js", () => ({ BACKUP_FORMAT: "vorlaut-backup" }));

/** A Sicherung of one Sammlung, as the shelf publishes them. */
const sicherung = (name = "erste-woerter.json") =>
  new File([JSON.stringify({ format: "vorlaut-backup", version: 2, boards: [] })], name);

const { openNamed } = await import("../../src/shell/shelf.js");

const HERE = "https://editor.lautstark.tech/?sammlung=erste-woerter";

describe("a Sammlung the address named", () => {
  beforeEach(() => {
    wanted.mockReset();
    adopt.mockReset();
    status.mockReset();
  });

  it("says nothing at all when the address named none", async () => {
    wanted.mockResolvedValue({ kind: "none" });
    await openNamed(HERE);
    expect(status).not.toHaveBeenCalled();
    expect(adopt).not.toHaveBeenCalled();
  });

  it("says an entry is not there, and touches nothing", async () => {
    wanted.mockResolvedValue({ kind: "unknown", id: "weg-damit" });
    await openNamed(HERE);
    expect(status).toHaveBeenLastCalledWith("ui.shelf_unknown");
    expect(adopt).not.toHaveBeenCalled();
  });

  it("tells a shelf it could not reach apart from an entry that is gone", async () => {
    wanted.mockResolvedValue({ kind: "offline", id: "x", error: new Error("nope") });
    await openNamed(HERE);
    expect(status).toHaveBeenLastCalledWith("ui.shelf_offline");
    expect(adopt).not.toHaveBeenCalled();
  });

  it("adopts the file, and falls back to the id for a name", async () => {
    const file = sicherung();
    wanted.mockResolvedValue({ kind: "file", id: "erste-woerter", file });
    adopt.mockResolvedValue({ name: "First words", pictures: 13 });

    await openNamed(HERE);

    expect(adopt).toHaveBeenCalledWith(file, "erste-woerter");
    expect(status).toHaveBeenLastCalledWith("adopted First words");
  });

  /* A file that will not go in is a sentence about the file, not about the
   * link — so it is adopt.ts's refusal and not one of the three above. */
  it("reports a file that will not go in as the import would", async () => {
    wanted.mockResolvedValue({ kind: "file", id: "x", file: sicherung("x.json") });
    adopt.mockRejectedValue(new Error("backup:not-one"));

    await openNamed(HERE);

    expect(status).toHaveBeenLastCalledWith("refused Error: backup:not-one");
  });
});

/* One address shape, four products' entries, and nothing in ?sammlung=<id>
 * saying which is which. A mitreden link opened here used to succeed: the
 * talker's OBF reader took a list of sentences for a board and made an empty
 * five-key set of it. Silent nonsense is the worst answer of the four. */
describe("a Sammlung that belongs to another program", () => {
  beforeEach(() => { wanted.mockReset(); adopt.mockReset(); status.mockReset(); });

  it("is refused rather than read as an empty talker set", async () => {
    wanted.mockResolvedValue({
      kind: "file",
      id: "spiegel-und-ei",
      file: new File([JSON.stringify({ collection: "Spiegel und Ei", sentences: [{ text: "a word" }] })],
        "spiegel-und-ei.json"),
    });

    await openNamed(HERE);

    expect(adopt).not.toHaveBeenCalled();
    expect(status).toHaveBeenLastCalledWith("ui.shelf_elsewhere");
  });

  it("still takes a zip, which is a talker package and ours", async () => {
    wanted.mockResolvedValue({
      kind: "file",
      id: "morgens",
      file: new File([new Uint8Array([0x50, 0x4b, 3, 4])], "morgens.obz"),
    });
    adopt.mockResolvedValue({ name: "Morgens", pictures: 0 });

    await openNamed(HERE);

    expect(adopt).toHaveBeenCalledOnce();
  });
});
