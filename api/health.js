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

  const redis = getRedis();
  if (redis) {
    try {
      out.subscriptions = (await redis.hlen(HASH_KEY)) || 0;
      out.storage = 'ok';
    } catch (e) {
      out.storage = 'unreachable';
      out.storageError = (e && e.message ? String(e.message) : 'unknown').slice(0, 200);
    }
  }

  out.ready = out.vapidPublic && out.vapidPrivate && out.storage === 'ok';
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(out);
};
