// pages/api/auth.js (LENGKAP, SIAP PAKAI)
const FASKEY = 'efa6e135ae80bfdd3beb695780d156fc2896dab2ef2a132f11b352b02408587f';
const GATEWAY_IP = '10.0.0.1';
const GATEWAY_PORT = '2050';
const crypto = require('crypto');

const authenticatedClients = new Map();

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function cleanExpiredEntries() {
  const now = Date.now();
  for (const [key, value] of authenticatedClients.entries()) {
    if (now - value.createdAt > 5 * 60 * 1000) authenticatedClients.delete(key);
  }
}

// Fungsi untuk menghasilkan Halaman HTML Splash
function getSplashPage(hid, fas, originurl) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>KotaCloud DaaS</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; justify-content: center; align-items: center; }
  .card { background: white; border-radius: 20px; padding: 40px; text-align: center; max-width: 450px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
  h1 { font-size: 28px; margin-bottom: 16px; color: #333; }
  .badge { background: #4CAF50; color: white; padding: 8px 20px; border-radius: 40px; display: inline-block; font-size: 14px; margin-bottom: 20px; }
  p { color: #666; line-height: 1.6; margin-bottom: 24px; }
  button { background: #667eea; color: white; border: none; padding: 14px 28px; font-size: 16px; border-radius: 40px; cursor: pointer; width: 100%; font-weight: bold; }
  button:hover { background: #5a67d8; }
  .footer { font-size: 11px; color: #999; margin-top: 24px; }
</style>
</head>
<body>
<div class="card">
  <h1>☕ KotaCloud DaaS</h1>
  <div class="badge">✅ Sistem Berjalan</div>
  <p>Selamat datang di layanan WiFi KotaCloud.<br>Klik tombol di bawah untuk memulai.</p>
  <button id="continueBtn">🌐 Lanjutkan ke Internet</button>
  <div class="footer">Dengan melanjutkan, Anda menyetujui Syarat & Ketentuan</div>
</div>
<script>
  const hid = "${hid || ''}";
  const fas = "${fas || ''}";
  const originurl = "${originurl || ''}";
  document.getElementById('continueBtn').onclick = async () => {
    const btn = document.getElementById('continueBtn');
    btn.disabled = true;
    btn.textContent = 'Memproses...';
    try {
      const response = await fetch(window.location.origin + '/api/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auth', hid, fas, originurl })
      });
      if (response.redirected) window.location.href = response.url;
      else { const data = await response.json(); if (data.redirect) window.location.href = data.redirect; }
    } catch(e) { alert('Error: ' + e.message); }
  };
</script>
</body>
</html>`;
}

export default async function handler(req, res) {
  // Set CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 1. Handle preflight OPTIONS
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 2. Handle Authmon polling (GET, auth_get=view)
  if (req.method === 'GET' && req.query.auth_get === 'view') {
    cleanExpiredEntries();
    const rhids = Array.from(authenticatedClients.keys());
    console.log(`[Authmon] Polling: returning ${rhids.length} rhids`);
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(rhids.join('\n'));
  }

  // 3. Handle Browser Splash (GET, dengan hid)
  if (req.method === 'GET' && req.query.hid) {
    const { hid, fas, originurl } = req.query;
    console.log(`[Splash] Serving HTML page for hid: ${hid?.substring(0, 16)}...`);
    return res.status(200).setHeader('Content-Type', 'text/html').send(getSplashPage(hid, fas, originurl));
  }

  // 4. Handle Authentication (POST, action=auth)
  if (req.method === 'POST' && req.body?.action === 'auth') {
    const { hid, fas, originurl } = req.body;
    if (hid) {
      const rhid = sha256(hid + FASKEY);
      authenticatedClients.set(rhid, { createdAt: Date.now(), hid, fas });
      console.log(`[Auth] Client authenticated: hid: ${hid.substring(0,16)}..., rhid: ${rhid.substring(0,16)}...`);
      const redirectUrl = `http://${GATEWAY_IP}:${GATEWAY_PORT}/opennds_auth/?tok=${rhid}${originurl ? `&redir=${encodeURIComponent(originurl)}` : ''}`;
      return res.redirect(302, redirectUrl);
    }
  }

  // 5. Default (untuk akses akar atau request lain)
  console.log(`[Default] Unhandled request: ${req.method} ${req.url}`);
  res.status(200).json({ status: 'ok', message: 'FAS server is running', note: 'Endpoint for openNDS' });
}