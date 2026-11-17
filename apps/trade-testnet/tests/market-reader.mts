// Parser checks only. Native discovery/recovery verification lives in tests/native.mts.
import assert from "node:assert/strict";
import {
  marketIdentity,
  routeFromUrl,
  routeUrl,
} from "../lib/market-reader.ts";
const id = "0x" + "ab".repeat(32);
for (const value of [
  id,
  " " + id + " ",
  "/market/" + id,
  "https://example.invalid/market/" + id + "?claim=1",
  "https://example.invalid/?market=" + id,
])
  assert.equal(marketIdentity(value), id);
for (const value of [
  "",
  "0x12",
  "https://example.invalid/market/not-an-id",
  "../x",
])
  assert.throws(() => marketIdentity(value));
assert.deepEqual(routeFromUrl("/"), { view: "Markets" });
assert.deepEqual(routeFromUrl("/market/" + id + "?claim=1"), {
  view: "Market",
  id,
  claim: 1,
});
for (const claim of ["-1", "1024", "1.5", "abc"])
  assert.deepEqual(routeFromUrl("/market/" + id + "?claim=" + claim), {
    view: "Market",
    id,
  });
for (const view of [
  "Markets",
  "My Positions",
  "Create Market",
  "Activity",
] as const)
  assert.deepEqual(routeFromUrl(routeUrl({ view })), { view });
assert.equal(
  routeUrl({ view: "Market", id, claim: 0 }),
  "/market/" + id + "?claim=0",
);
console.log("MARKET_ROUTE_PARSER_PASS");
