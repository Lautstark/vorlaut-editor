/* What ?sammlung= will and will not fetch.
 *
 * The id check is the reason this file exists. `?sammlung=` names an entry on
 * one shelf and never an address, so the only thing between a crafted link and
 * a fetch is the shape of that id — and a regex nobody tests is a regex that
 * gets relaxed by somebody who needed one more character through it.
 *
 * The cases below are the ones that would matter: a name that climbs out of the
 * path, an absolute address, a slash hidden inside an id, and capitals no id
 * has. None of them may reach fetch at all.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const adopt = vi.hoisted(() => vi.fn());
const status = vi.hoisted(() => vi.fn());

vi.mock("../../src/shell/adopt.js", () => ({
  adopt,
  adopted: () => "adopted",
  refusal: (error: unknown) => `refused: ${String(error)}`,
}));
vi.mock("../../src/shell/dom.js", () => ({ status, $: () => undefined }));
vi.mock("../../src/core/texts.js", () => ({ t: (key: string) => key }));
vi.mock("../../src/core/errors.js", () => ({ reason: (e: unknown) => String(e) }));

const { openNamed } = await import("../../src/shell/shelf.js");

/** An address carrying the given parameter value, and somewhere to record
 *  what the module asked to be forgotten. */
let forgotten: URL | null = null;
const forget = (url: URL) => { forgotten = url; };

const SUBJECT = "erste-woerter";

function at(sammlung: string | null): string {
  const url = new URL("https://lautstark.github.io/vorlaut-editor/");
  if (sammlung !== null) url.searchParams.set("sammlung", sammlung);
  return url.href;
}

describe("opening a Sammlung the address names", () => {
  beforeEach(() => {
    adopt.mockReset();
    status.mockReset();
    vi.restoreAllMocks();
    forgotten = null;
  });

  it("does nothing at all when the address names none", async () => {
    const fetching = vi.spyOn(globalThis, "fetch");
    await openNamed(at(null), forget);
    expect(fetching).not.toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it.each([
    ["../../etc/passwd", "climbing out of the path"],
    ["https://example.invalid/board.json", "an absolute address"],
    ["a/b", "a slash hidden inside an id"],
    ["Erste-Woerter", "capitals, which no id has"],
    ["", "nothing at all"],
  ])("never fetches %j — %s", async (wanted) => {
    const fetching = vi.spyOn(globalThis, "fetch");
    await openNamed(at(wanted), forget);
    expect(fetching).not.toHaveBeenCalled();
    expect(adopt).not.toHaveBeenCalled();
  });

  it("asks the shelf for a well-formed id, and only the shelf", async () => {
    const fetching = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }) as never);
    adopt.mockResolvedValue({ name: "Erste Wörter", pictures: 13 });

    await openNamed(at(SUBJECT), forget);

    expect(fetching).toHaveBeenCalledOnce();
    expect(String(fetching.mock.calls[0]![0]))
      .toBe("https://lautstark.tech/sammlungen/download/erste-woerter.json");
    expect(adopt).toHaveBeenCalledOnce();
    expect(status).toHaveBeenLastCalledWith("adopted");
  });

  it("says an entry is not there rather than showing a status code", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 404 }) as never);

    await openNamed(at("weg-damit"), forget);

    expect(adopt).not.toHaveBeenCalled();
    expect(status).toHaveBeenLastCalledWith("ui.shelf_unknown");
  });

  it("tells a shelf it could not reach from a file it could not read", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));

    await openNamed(at(SUBJECT), forget);

    expect(status).toHaveBeenLastCalledWith("ui.shelf_offline");
  });

  /* A reload must be a reload. The parameter is taken out of the address as
   * soon as it is read, or coming back to the tab makes a second copy of a
   * Sammlung somebody has since edited. */
  it("takes the parameter out of the address before doing anything with it", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }) as never);
    adopt.mockResolvedValue({ name: "x", pictures: 0 });

    await openNamed(at(SUBJECT), forget);

    expect(forgotten).not.toBeNull();
    expect(forgotten!.searchParams.has("sammlung")).toBe(false);
  });
});
