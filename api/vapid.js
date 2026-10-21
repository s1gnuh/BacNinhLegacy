'use strict';
// Trả khoá công khai VAPID cho trình duyệt. Khoá riêng không bao giờ rời server.
module.exports = (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(503).json({ error: 'push_not_configured' });
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).json({ key });
};
