/* The sidebar's one remembered preference, when the store will not remember it.
 *
 * Whether the column is open is kept in the settings record, so both reading
 * it at boot and writing it on a press are a trip to IndexedDB - and both were
 * left to reject unhandled: the read as a `.then` with no `.catch`, the write
 * as an `await` under a `void` in two buttons. The column itself was never the
 * problem, it is already where it was asked to be; what was missing was the
 * line that says the choice will not outlast the tab.
 *
 * The backend is a stand-in that refuses, because a refusing IndexedDB is not
 * something fake-indexeddb can be asked for, and the status line is the
 * recorded call the shelf's test uses for the same seam.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const status = vi.hoisted(() => vi.fn());
vi.mock("../../src/shell/dom.js", () => ({ status }));
vi.mock("../../src/core/texts.js", () => ({
  t: (key: string, said?: { error?: string }) => `${key}: ${said?.error ?? ""}`,
}));
vi.mock("../../src/backend/index.js", () => ({
  readSettings: () => Promise.reject(new Error("store closed")),
  writeSettings: () => Promise.reject(new Error("quota")),
}));

const { columnOpen, restoreColumn, showColumn } =
  await import("../../src/shell/sidebar.svelte.js");

describe("the column, when the store refuses", () => {
  beforeEach(() => { status.mockClear(); });

  it("stays open on a read that fails, and says so", async () => {
    restoreColumn();
    await vi.waitFor(() => expect(status).toHaveBeenCalledWith("ui.data_failed: store closed"));
    expect(columnOpen()).toBe(true);
  });

  it("moves on a press whose write fails, and says the press was not kept", async () => {
    await expect(showColumn(false)).resolves.toBeUndefined();
    expect(columnOpen()).toBe(false);
    expect(status).toHaveBeenCalledWith("ui.data_failed: quota");
  });
});
