'use strict';
// Kiểm tra nhanh xem phần push đã cấu hình đủ chưa. Chỉ trả về có/không,
// không bao giờ lộ giá trị của biến môi trường.
const { getRedis, HASH_KEY } = require('../lib/store');

module.exports = async (req, res) => {
  const out = {
    vapidPublic: !!process.env.VAPID_PUBLIC_KEY,
    vapidPrivate: !!process.env.VAPID_PRIVATE_KEY,
    vapidSubject: !!process.env.VAPID_SUBJECT,
    cronSecret: !!process.env.CRON_SECRET,
    storage: 'missing_env',
    subscriptions: 0
  };

  // Chỉ liệt kê TÊN biến, không bao giờ kèm giá trị. Tích hợp Upstash trên
  // Vercel đặt tên khác nhau tuỳ cách nối, nhìn tên là biết thiếu đúng cái gì.
  out.envKeys = Object.keys(process.env)
    .filter((k) => /^(KV_|UPSTASH_|REDIS_|VAPID_|CRON_)/.test(k))
    .sort();

  const redis = getRedis();
  if (redis) {
    try {
      out.subscriptions = (await redis.hlen(HASH_KEY)) || 0;
      out.storage = 'ok';
    } catch (e) {
      out.storage = 'unreachable';
      out.storageError = (e && e.message ? String(e.message) : 'unknown').slice(0, 200);
    }
  } else if (out.envKeys.some((k) => /^(REDIS_URL|KV_URL)$/.test(k))) {
    // Có kho nhưng là kiểu kết nối redis://, client REST không dùng được.
    out.storage = 'wrong_env_shape';
    out.hint = 'Kho đã nối nhưng chỉ có biến kiểu redis://. Vào Upstash → tab REST API, copy UPSTASH_REDIS_REST_URL và UPSTASH_REDIS_REST_TOKEN rồi thêm vào Vercel.';
  }

  out.ready = out.vapidPublic && out.vapidPrivate && out.storage === 'ok';
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(out);
};
