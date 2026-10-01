import { expect, it } from "vitest";
import * as store from "../../src/data/store.js";
import { exportEverything, importBackup } from "../../src/data/backup.js";

/* A Sicherung put back keeps the order the sidebar had. A restore used to
 * stamp every Sammlung with one Date.now(), so they all tied and the list
 * came back in UUID order - which is no order anybody chose. */

const page = (name: string) => ({
  sleep_timeout_seconds: 600, language: "de", voice: "",
  sets: [{ name, slots: Array.from({ length: 5 }, () => ({ text: "", symbol: "" })) }],
}) as any;

const names = async () =>
  (await store.readCollections()).collections.map((one) => one.name).join("");

it("restores the sidebar in the order it was backed up", async () => {
  for (const name of ["A", "B", "C", "D", "E", "F"]) {
    await store.createCollection(name, page(name));
  }
  const before = await names();
  const backup = await exportEverything("n");
  await importBackup(JSON.parse(JSON.stringify(backup)));
  expect(await names()).toBe(before);
});

it("and keeps the file's order for a Sicherung that carries no times", async () => {
  const backup = await exportEverything("n");
  const before = await names();
  for (const board of backup.boards) delete board.updatedAt;
  await importBackup(JSON.parse(JSON.stringify(backup)));
  expect(await names()).toBe(before);
});
