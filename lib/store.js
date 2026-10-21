'use strict';
// Kho lưu subscription. Dùng Upstash Redis qua REST nên chạy được trên
// serverless mà không cần giữ kết nối.
const crypto = require('crypto');
const { Redis } = require('@upstash/redis');

const HASH_KEY = 'bn27:subs';
const MAX_SUBS = 50;

function getRedis() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function subId(endpoint) {
  return crypto.createHash('sha256').update(String(endpoint)).digest('hex').slice(0, 24);
}

function parseRecord(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

async function putSub(redis, id, record) {
  const all = await redis.hgetall(HASH_KEY);
  const count = all ? Object.keys(all).length : 0;
  if (count >= MAX_SUBS && !(all && all[id])) {
    const err = new Error('too_many_subscriptions');
    err.code = 'too_many_subscriptions';
    throw err;
  }
  await redis.hset(HASH_KEY, { [id]: JSON.stringify(record) });
}

async function allSubs(redis) {
  const all = await redis.hgetall(HASH_KEY);
  if (!all) return [];
  return Object.keys(all)
    .map((id) => ({ id, rec: parseRecord(all[id]) }))
    .filter((x) => x.rec && x.rec.sub && x.rec.sub.endpoint);
}

async function dropSub(redis, id) {
  await redis.hdel(HASH_KEY, id);
}

module.exports = { getRedis, subId, putSub, allSubs, dropSub, HASH_KEY };
