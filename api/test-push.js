'use strict';
// Bắn một thông báo đẩy thật ngay lập tức, không chờ cron. Dùng để kiểm tra
// đường đi của push sau khi cấu hình xong.
//
// Hai cách gọi:
//   1. Từ nút "Gửi thử" trong app: POST kèm { subscription } của chính máy đó.
//   2. Từ dòng lệnh: GET/POST kèm header Authorization: Bearer <CRON_SECRET>,
//      gửi tới mọi máy đã đăng ký.
const webpush = require('web-push');
const { getRedis, allSubs, dropSub, subId } = require('../lib/store');

function readBody(req) {
  if (!req.body) return null;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return null; }
  }
  return req.body;
}

module.exports = async (req, res) => {
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return res.status(503).json({ error: 'push_not_configured' });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:run@example.com', pub, priv);

  const redis = getRedis();
  if (!redis) return res.status(503).json({ error: 'storage_not_configured' });

  const body = readBody(req) || {};
  const secret = process.env.CRON_SECRET;
  const isAdmin = !!secret && req.headers.authorization === 'Bearer ' + secret;

  let targets = [];
  if (body.subscription && body.subscription.endpoint) {
    const id = subId(body.subscription.endpoint);
    const found = (await allSubs(redis)).find((x) => x.id === id);
    if (!found) return res.status(404).json({ error: 'subscription_not_registered' });
    targets = [found];
  } else if (isAdmin) {
    targets = await allSubs(redis);
  } else {
    return res.status(401).json({ error: 'need_subscription_or_secret' });
  }

  if (!targets.length) return res.status(404).json({ error: 'no_subscriptions' });

  const payload = JSON.stringify({
    title: body.title || 'Thử thông báo đẩy',
    body: body.body || 'Thông báo này đến từ máy chủ. Nhắc chạy đã chạy được.',
    url: '/index.html',
    tag: 'bn27-test'
  });

  let sent = 0, dropped = 0;
  const errors = [];
  for (const { id, rec } of targets) {
    try {
      await webpush.sendNotification(rec.sub, payload, { TTL: 600 });
      sent++;
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) {
        await dropSub(redis, id);
        dropped++;
      }
      errors.push({ status: (e && e.statusCode) || 0, message: (e && e.message) || 'unknown' });
    }
  }

  return res.status(200).json({ ok: sent > 0, total: targets.length, sent, dropped, errors });
};
