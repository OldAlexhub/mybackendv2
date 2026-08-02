import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../app.js";
import { transitCache } from "../transit/cache.js";

const withServer = async (callback) => {
  const app = createApp();
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const address = server.address();
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
};

test("static transit endpoints work while MongoDB is disconnected", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/transit/signals?metric=upt`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.provenance, "static-artifact");
    assert.ok(Array.isArray(payload.data.items));
    assert.ok(payload.release.dataThrough);
  });
});

test("legacy database endpoints return a controlled 503 while transit stays online", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/getarticles`);
    assert.equal(response.status, 503);
    const payload = await response.json();
    assert.equal(payload.databaseRequired, true);
  });
});

test("mode and type-of-service combinations work from static artifacts during a DOT outage", async () => {
  transitCache.set("socrata:outage", { message: "test outage" }, 60_000);
  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(
        `${baseUrl}/transit/timeseries?modeGroup=Bus&tos=PT&start=2019-01-01&end=2026-05-01`
      );
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.provenance, "static-artifact");
      assert.ok(payload.data.length >= 80);
      assert.ok(payload.data.at(-1).upt > 0);
    });
  } finally {
    transitCache.clear();
  }
});
