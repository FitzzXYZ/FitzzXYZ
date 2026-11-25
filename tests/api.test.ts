import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import gameHandler from "../api/game.js";
import clockHandler from "../api/clock.js";
import { resetRedisClientForTests } from "../lib/redis.js";

function createMockRes() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body = "";
  const res = {
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = String(v);
      return res;
    },
    status(code: number) {
      statusCode = code;
      return res;
    },
    send(payload: string) {
      body = String(payload);
      return res;
    },
    end() {
      return res;
    },
  };
  return {
    res: res as unknown as VercelResponse,
    getHeaders: () => headers,
    getStatus: () => statusCode,
    getBody: () => body,
  };
}

function mockReq(query: Record<string, string>): VercelRequest {
  return { query } as unknown as VercelRequest;
}

test("clock endpoint returns valid live SVG and falls back on invalid timezone", () => {
  const ok = createMockRes();
  clockHandler(mockReq({ tz: "Asia/Jakarta" }), ok.res);
  assert.equal(ok.getStatus(), 200);
  assert.match(ok.getHeaders()["content-type"], /^image\/svg\+xml/);
  assert.ok(ok.getBody().startsWith("<svg "));
  assert.ok(ok.getBody().includes("ASIA/JAKARTA"));

  const fallback = createMockRes();
  clockHandler(mockReq({ tz: "Invalid/Zone" }), fallback.res);
  assert.equal(fallback.getStatus(), 200);
  assert.ok(fallback.getBody().includes("ASIA/JAKARTA"));
});

test("game endpoint handles all 14 actions, inline JS compilation, and Stage IV auto-ending", async () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  resetRedisClientForTests();

  const standalone = createMockRes();
  await gameHandler(mockReq({}), standalone.res);
  assert.equal(standalone.getStatus(), 200);
  assert.match(standalone.getHeaders()["content-type"], /^image\/svg\+xml/);
  assert.equal(standalone.getHeaders()["x-fitzz-storage"], "memory");
  assert.ok(standalone.getBody().startsWith("<svg "));

  const acts = [
    "reelseiden",
    "sorganeil",
    "ward",
    "chest1",
    "chest2",
    "chest3",
    "rescue",
    "stage0",
    "stage1",
    "stage2",
    "stage3",
    "ending",
    "reelseiden",
    "reset",
  ];

  for (const act of acts) {
    const htmlRes = createMockRes();
    await gameHandler(mockReq({ act, crit: "1" }), htmlRes.res);
    assert.equal(htmlRes.getStatus(), 200);
    const scriptMatch = htmlRes.getBody().match(/<script>([\s\S]*?)<\/script>/);
    assert.ok(scriptMatch, `Missing <script> for act=${act}`);
    new vm.Script(scriptMatch[1], { filename: `inline-${act}.js` });

    const jsonRes = createMockRes();
    await gameHandler(mockReq({ act, json: "1" }), jsonRes.res);
    const parsed = JSON.parse(jsonRes.getBody()) as {
      svg: string;
      storage: string;
      endingReached: boolean;
    };
    assert.ok(parsed.svg.startsWith("<svg"), `Invalid SVG in JSON for act=${act}`);
    assert.equal(parsed.storage, "memory");
  }

  await gameHandler(mockReq({ act: "stage3" }), createMockRes().res);
  let reachedEnding = false;
  for (let i = 0; i < 8; i++) {
    await gameHandler(mockReq({ act: "sorganeil", json: "1" }), createMockRes().res);
    const hit = createMockRes();
    await gameHandler(mockReq({ act: "reelseiden", crit: "1", json: "1" }), hit.res);
    if ((JSON.parse(hit.getBody()) as { endingReached: boolean }).endingReached) {
      reachedEnding = true;
      break;
    }
  }
  assert.equal(reachedEnding, true, "Defeating Stage IV Frieren must auto-trigger Grand Ending");

  await gameHandler(mockReq({ act: "reset" }), createMockRes().res);
});

