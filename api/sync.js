'use strict';
// Đồng bộ nhiều thiết bị. Mỗi "không gian" là một hash Redis, khoá là hash của
// mã đồng bộ (mã không bao giờ được lưu), mỗi field là một đơn vị dữ liệu nhỏ
// (một giải, một buổi chạy, một ô đã đánh dấu...) kèm mốc thời gian t. Hai máy
// ghi cùng một đơn vị thì cái có t lớn hơn thắng; bằng nhau thì giữ bản đã có.
const crypto = require('crypto');
const { getRedis, parseRecord } = require('../lib/store');

const CODE_RE = /^[A-Z2-9]{20}$/;
const UNIT_RE = /^[a-z]\|[\w.-]{1,64}(\|[\w.:-]{1,64})?$/;
const MAX_UNITS = 5000;          // số đơn vị tối đa trong một không gian
const MAX_PUSH = 600;            // số đơn vị tối đa trong một lần gửi
const MAX_UNIT_BYTES = 300 * 1024;
const TOMB_MS = 120 * 864e5;     // bia mộ (đơn vị đã xoá) giữ 120 ngày
const FUTURE_MS = 60 * 1000;     // chặn đồng hồ máy chạy quá nhanh đè mọi thứ

function readBody(req) {
  if (!req.body) return null;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return null; }
  }
  return req.body;
}

function spaceKey(code) {
  return 'bn27:sync:' + crypto.createHash('sha256').update('bn27-sync:' + code).digest('hex').slice(0, 40);
}

function cleanUnit(u, now) {
  if (!u || typeof u !== 'object' || typeof u.t !== 'number' || !isFinite(u.t) || u.t < 0) return null;
  const rec = { t: Math.min(Math.round(u.t), now + FUTURE_MS) };
  if (u.d) rec.d = 1;
  else {
    if (u.v === undefined) return null;
    rec.v = u.v;
  }
  if (JSON.stringify(rec).length > MAX_UNIT_BYTES) return null;
  return rec;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const redis = getRedis();
  if (!redis) return res.status(503).json({ error: 'storage_not_configured' });

  const body = readBody(req);
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'bad_body' });
  const code = typeof body.code === 'string' ? body.code : '';
  if (!CODE_RE.test(code)) return res.status(400).json({ error: 'bad_code' });
  const key = spaceKey(code);

  if (body.wipe) {
    await redis.del(key);
    return res.status(200).json({ ok: true, wiped: true });
  }

  const exists = (await redis.exists(key)) > 0;
  // Nhập mã từ máy khác mà không có không gian nào: gần như chắc là gõ sai mã.
  if (body.join && !exists) return res.status(404).json({ error: 'no_such_space' });

  const now = Date.now();
  // Máy đầu tiên bật đồng bộ có thể chưa có dữ liệu nào để gửi; vẫn phải tạo
  // không gian để máy khác nhập mã được (field bắt đầu bằng "_" không trả về cho máy).
  if (body.create && !exists) await redis.hset(key, { _space: JSON.stringify({ t: now, st: now }) });
  const since = Number(body.since) > 0 ? Number(body.since) : 0;

  const incoming = [];
  const units = body.units && typeof body.units === 'object' ? body.units : {};
  const names = Object.keys(units);
  if (names.length > MAX_PUSH) return res.status(413).json({ error: 'too_many_units' });
  for (const name of names) {
    if (!UNIT_RE.test(name)) continue;
    const rec = cleanUnit(units[name], now);
    if (rec) incoming.push([name, rec]);
  }

  if (incoming.length) {
    const cur = (await redis.hmget(key, ...incoming.map((x) => x[0]))) || {};
    const writes = {};
    let added = 0;
    for (const [name, rec] of incoming) {
      const old = parseRecord(cur[name]);
      if (old && !(rec.t > old.t)) continue;       // bản đã có thắng hoặc hoà
      if (!old) added++;
      writes[name] = JSON.stringify(Object.assign({}, rec, { st: now }));
    }
    if (added) {
      const total = (await redis.hlen(key)) || 0;
      if (total + added > MAX_UNITS) return res.status(413).json({ error: 'space_full' });
    }
    if (Object.keys(writes).length) await redis.hset(key, writes);
  }

  // Trả mọi đơn vị mới hơn mốc `since` của máy gọi; dọn bia mộ quá hạn.
  const all = (await redis.hgetall(key)) || {};
  const out = {};
  const stale = [];
  let count = 0;
  for (const name of Object.keys(all)) {
    if (name.charAt(0) === '_') continue;
    const rec = parseRecord(all[name]);
    if (!rec || typeof rec.t !== 'number') continue;
    if (rec.d && now - rec.t > TOMB_MS) { stale.push(name); continue; }
    count++;
    if ((rec.st || 0) > since) out[name] = rec.d ? { t: rec.t, d: 1 } : { t: rec.t, v: rec.v };
  }
  if (stale.length) await redis.hdel(key, ...stale);

  return res.status(200).json({ ok: true, now, exists, total: count, units: out });
};
