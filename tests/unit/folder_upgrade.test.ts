/* A version-5 database with a connected folder, opened by code at version 6.
 *
 * The step to 6 brings every page up to five keys - and on a machine whose
 * Sammlungen live in a folder it used to be undone at once. main.ts calls
 * pullFromFolder() before anything else reads the database; opening it runs
 * the step; and the pull then replaced the browser's copy wholesale with the
 * folder's, which is the four-slot text the previous version wrote. The step
 * had also kept each record's `updatedAt`, so the folder mirror - which writes
 * only records whose `updatedAt` differs - would never have sent the new text
 * out either.
 *
 * Seeded the way store_upgrade.test.ts seeds: on disk, as version 5 built it,
 * with the folder standing in as a mock of data/folder.ts that hands back the
 * same records.
 */
import { beforeAll, expect, it, vi } from "vitest";
import { KEYS_PER_SET } from "../../src/device/layout_facts.js";
import { PAGE_KEY } from "../../src/core/types.js";

/* Version 5's shape: four slots, the page key's picture on the set. */
const old = {
  sleep_timeout_seconds: 600, language: "de",
  sets: [{ name: "Morning", symbol: "arasaac-2483.png",
    slots: [{ text: "hi", symbol: "" }, { text: "", symbol: "" },
            { text: "", symbol: "" }, { text: "x", symbol: "" }] }],
};
const ID = "c1";
const folder = {
  sammlungen: [{ id: ID, name: "Kitchen", updatedAt: 1000 }],
  layouts: [{ id: ID, text: JSON.stringify(old, null, 2) + "\n",
              version: "aaaa", updatedAt: 1000 }],
};

vi.mock("../../src/data/folder.js", () => ({
  isStore: () => true,
  adopted: async () => true,
  readKind: async (kind: "sammlungen" | "layouts") => structuredClone(folder[kind]),
  pushKind: async () => {},
  adopt: async () => ({ adopted: true }),
}));

function seed5(): Promise<void> {
  return new Promise((done, fail) => {
    const asked = indexedDB.open("vorlaut", 5);
    asked.onupgradeneeded = () => {
      const db = asked.result;
      db.createObjectStore("collections", { keyPath: "id" })
        .createIndex("updatedAt", "updatedAt");
      db.createObjectStore("layouts", { keyPath: "id" });
      db.createObjectStore("settings");
      db.createObjectStore("marks");
      db.createObjectStore("symbols");
      db.createObjectStore("speech").createIndex("usage", ["usedAt", "size"]);
    };
    asked.onerror = () => fail(asked.error);
    asked.onsuccess = () => {
      const db = asked.result;
      const tx = db.transaction(["collections", "layouts", "marks"], "readwrite");
      tx.objectStore("collections").put(folder.sammlungen[0]);
      tx.objectStore("layouts").put(folder.layouts[0]);
      tx.objectStore("marks").put(ID, "current");
      tx.oncomplete = () => { db.close(); done(); };
    };
  });
}

/** One record straight off the disk, past everything store.ts does. */
function raw(store: string, id: string): Promise<any> {
  return new Promise((done, fail) => {
    const asked = indexedDB.open("vorlaut");
    asked.onerror = () => fail(asked.error);
    asked.onsuccess = () => {
      const db = asked.result;
      const got = db.transaction(store).objectStore(store).get(id);
      got.onsuccess = () => { db.close(); done(got.result); };
      got.onerror = () => fail(got.error);
    };
  });
}

let store: typeof import("../../src/data/store.js");
beforeAll(async () => {
  await seed5();
  store = await import("../../src/data/store.js");
});

it("does not let the folder's old copy undo the step to 6", async () => {
  expect(await store.pullFromFolder()).toBe(true);
  const held = await store.readLayout();
  const page = (held.layout as any).sets[0];
  expect(page.slots).toHaveLength(KEYS_PER_SET);
  // The set's picture is on the page key, where the step puts it - not on a
  // fifth key padded in at the end.
  expect(page.slots[PAGE_KEY].symbol).toBe("arasaac-2483.png");
  expect(page.symbol).toBeUndefined();
  expect(page.slots[0].text).toBe("hi");
});

it("and moves updatedAt, so the next mirror writes the new text back", async () => {
  const layout = await raw("layouts", ID);
  const row = await raw("collections", ID);
  expect(layout.updatedAt).toBe(1001);
  expect(row.updatedAt).toBe(1001);
  // The stamp stays: adr/0023.
  expect(layout.version).toBe("aaaa");
});
