'use strict';
// Vercel Cron gọi mỗi ngày. Với từng subscription, tính ngày/giờ theo múi giờ
// của máy đã đăng ký rồi đẩy thông báo nếu hôm nay còn buổi chạy chưa xong.
const webpush = require('web-push');
const { getRedis, allSubs, dropSub } = require('../lib/store');

function localNow(tz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false
  }).formatToParts(new Date());
  const get = (t) => (parts.find((p) => p.type === t) || {}).value;
  return { date: get('year') + '-' + get('month') + '-' + get('day'), hour: Number(get('hour')) };
}

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== 'Bearer ' + secret) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return res.status(503).json({ error: 'push_not_configured' });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:run@example.com', pub, priv);

  const redis = getRedis();
  if (!redis) return res.status(503).json({ error: 'storage_not_configured' });

  const subs = await allSubs(redis);
  let sent = 0, skipped = 0, dropped = 0;

  for (const { id, rec } of subs) {
    if (rec.on === false) { skipped++; continue; }

    const now = localNow(rec.tz || 'Asia/Ho_Chi_Minh');
    const wanted = Number(String(rec.time || '18:00').split(':')[0]);
    if (now.hour < wanted) { skipped++; continue; }

    const hit = (rec.days || []).find((d) => d.date === now.date && !d.done);
    if (!hit) { skipped++; continue; }

    const payload = JSON.stringify({
      title: 'Hôm nay có buổi chạy',
      body: hit.title,
      url: '/index.html',
      tag: 'bn27-remind'
    });

    try {
      await webpush.sendNotification(rec.sub, payload, { TTL: 10 * 60 * 60 });
      sent++;
    } catch (e) {
      // 404/410: trình duyệt đã huỷ đăng ký, bỏ khỏi kho cho sạch
      if (e && (e.statusCode === 404 || e.statusCode === 410)) {
        await dropSub(redis, id);
        dropped++;
      } else {
        skipped++;
      }
    }
  }

  return res.status(200).json({ ok: true, total: subs.length, sent, skipped, dropped });
};
