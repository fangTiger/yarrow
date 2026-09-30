import assert from "node:assert/strict";
import test from "node:test";

import { decodePredicateConfig } from "../src/predicate-config.js";

test("viem 的命名 struct 返回按字段解码，不要求对象可迭代", () => {
  const decoded = decodePredicateConfig({
    resolver: "0x1111111111111111111111111111111111111111",
    schemaHash: `0x${"22".repeat(32)}`,
    querentControllable: false,
    tier: 0,
    enabled: true,
  });

  assert.equal(decoded.resolver, "0x1111111111111111111111111111111111111111");
  assert.equal(decoded.tier, 0);
  assert.equal(decoded.enabled, true);
});
