import { Redis } from "@upstash/redis";

export type ChestState = "closed" | "grimoire" | "mimic";

export interface ArenaState {
  ubelHp: number;
  ubelMaxHp: number;
  ubelMp: number;
  ubelMaxMp: number;
  slashBonus: number;
  mpRegen: number;
  relicCount: number;
  empathy: number;
  combo: number;
  stageIdx: number;
  bossHp: number;
  bossMaxHp: number;
  bossBound: boolean;
  bossCharging: boolean;
  wardActive: boolean;
  frierenTrapped: boolean;
  endingReached: boolean;
  chapterTitle: string;
  storyBanner: string;
  lastDmg: number;
  activeRelic: string;
  activeRelicTier: string;
  activeRelicColor: string;
  activeRelicEffect: string;
  lastSpell: string;
  duelLog1: string;
  duelLog2: string;
  chests: [ChestState, ChestState, ChestState];
  lastChestIdx: number;
  chestLog1: string;
  chestLog2: string;
  history: string[];
  wins: number;
  grimoiresFound: number;
  mimicsTriggered: number;
  rescuesCount: number;
  turn: number;
  updatedAt: string;
}

export type StorageBackend = "upstash" | "memory";

export const ARENA_REDIS_KEY = "fitzz:arena:v4";

declare global {
  var __FITZZ_ARENA_V4__: ArenaState | undefined;
}

let cachedClient: Redis | null | undefined;

function getRedisClient(): Redis | null {
  if (cachedClient !== undefined) return cachedClient;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    cachedClient = null;
    return null;
  }
  cachedClient = new Redis({ url, token });
  return cachedClient;
}

export function resetRedisClientForTests(): void {
  cachedClient = undefined;
}

function sanitizeState(raw: Partial<ArenaState> | null | undefined, fallback: ArenaState): ArenaState {
  if (!raw || typeof raw !== "object") return fallback;
  const chestsRaw = Array.isArray(raw.chests) && raw.chests.length === 3 ? raw.chests : fallback.chests;
  const validChest = (c: unknown): ChestState =>
    c === "grimoire" || c === "mimic" ? c : "closed";
  return {
    ...fallback,
    ...raw,
    stageIdx: Number.isFinite(raw.stageIdx) ? Math.max(0, Math.floor(raw.stageIdx as number)) % 4 : fallback.stageIdx,
    chests: [validChest(chestsRaw[0]), validChest(chestsRaw[1]), validChest(chestsRaw[2])],
    history: Array.isArray(raw.history) ? raw.history.map(String).slice(-4) : fallback.history,
  };
}

export async function loadArenaState(
  createInitialState: () => ArenaState
): Promise<{ state: ArenaState; storage: StorageBackend }> {
  const client = getRedisClient();
  if (client) {
    try {
      const stored = await client.get<ArenaState | string>(ARENA_REDIS_KEY);
      if (stored) {
        const parsed = typeof stored === "string" ? (JSON.parse(stored) as Partial<ArenaState>) : stored;
        const hydrated = sanitizeState(parsed, createInitialState());
        globalThis.__FITZZ_ARENA_V4__ = hydrated;
        return { state: hydrated, storage: "upstash" };
      }
      const fresh = createInitialState();
      await client.set(ARENA_REDIS_KEY, JSON.stringify(fresh));
      globalThis.__FITZZ_ARENA_V4__ = fresh;
      return { state: fresh, storage: "upstash" };
    } catch (err) {
      console.error("[fitzz/redis] read failed, falling back to memory:", err);
    }
  }

  if (!globalThis.__FITZZ_ARENA_V4__) {
    globalThis.__FITZZ_ARENA_V4__ = createInitialState();
  }
  return { state: globalThis.__FITZZ_ARENA_V4__, storage: "memory" };
}

export async function saveArenaState(state: ArenaState): Promise<StorageBackend> {
  state.updatedAt = new Date().toISOString();
  globalThis.__FITZZ_ARENA_V4__ = state;
  const client = getRedisClient();
  if (!client) return "memory";
  try {
    // shortcut: single-key overwrite without CAS lock; upgrade to Redis Lua script if concurrent players exceed README traffic
    await client.set(ARENA_REDIS_KEY, JSON.stringify(state));
    return "upstash";
  } catch (err) {
    console.error("[fitzz/redis] write failed, state kept in memory:", err);
    return "memory";
  }
}
