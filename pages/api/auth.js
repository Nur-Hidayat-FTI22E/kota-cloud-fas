// pages/api/auth.js
const FASKEY = '328411b33fe55127421fa394995711658526ed47d0affad3fe56a0b3930c8689';
const GATEWAY_IP = '10.0.0.1';
const GATEWAY_PORT = '2050';
const crypto = require('crypto');

// === JANGAN UBAH FUNGSI DI BAWAH INI ===
function sha256(data) { return crypto.createHash('sha256').update(data).digest('hex'); }
function extractHidFromFas(fasString) { /* ... sama seperti kode sebelumnya ... */ }
// === SAMPAI SINI ===

const authenticatedClients = new Map();

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  console.log(`[REQUEST] Method: ${req.method}, URL: ${req.url}`);

  // 1. Handle Authmon (GET with auth_get=view)
  if (req.method === 'GET' && url.searchParams.get('auth_get') === 'view') {
    const rhids = Array.from(authenticatedClients.keys());
    console.log(`[AUTHMON] Returning ${rhids.length} rhids:`, rhids);
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(rhids.join('\n'));
  }

  // 2. Handle Splash Page (GET)
  if (req.method === 'GET') {
    let hid = url.searchParams.get('hid');
    if (!hid) {
      const fas = url.searchParams.get('fas');
      if (fas) hid = extractHidFromFas(fas);
    }

    console.log(`[SPLASH] Serving HTML for hid: ${hid ? hid.substring(0,16)+'...' : 'null'}`);
    // Tampilkan Halaman HTML Splash (Anda bisa ubah sesuai keinginan)
    return res.status(200).setHeader('Content-Type', 'text/html').send(`
      <!DOCTYPE html>
      <html>
      <head><title>KotaCloud DaaS</title><meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;display:flex;justify-content:center;align-items:center;margin:0}
      .card{background:white;border-radius:20px;padding:40px;text-align:center;max-width:450px;margin:20px;box-shadow:0 20px 40px rgba(0,0,0,0.2)}
      h1{font-size:28px;margin-bottom:16px;color:#333}.badge{background:#4CAF50;color:white;padding:8px 20px;border-radius:40px;display:inline-block;font-size:14px;margin-bottom:20px}
      button{background:#667eea;color:white;border:none;padding:14px 28px;font-size:16px;border-radius:40px;cursor:pointer;width:100%;font-weight:bold}
      .footer{font-size:11px;color:#999;margin-top:24px}</style>
      </head>
      <body>
      <div class="card">
        <h1>☕ KotaCloud DaaS</h1>
        <div class="badge">✅ Sistem Berjalan</div>
        <p>Selamat datang! Klik tombol di bawah untuk memulai.</p>
        <button onclick="window.location.href='/api/auth?action=login&hid=${hid}'">🌐 Lanjutkan</button>
        <div class="footer">Dengan melanjutkan, Anda menyetujui Syarat & Ketentuan</div>
      </div>
      </body>
      </html>
    `);
  }

  // 3. Handle Login (GET or POST)
  if ((req.method === 'GET' || req.method === 'POST') && url.searchParams.get('action') === 'login') {
    const hid = url.searchParams.get('hid');
    if (hid) {
      const rhid = sha256(hid + FASKEY);
      authenticatedClients.set(rhid, { createdAt: Date.now() });
      console.log(`[AUTH] Client logged in. hid: ${hid.substring(0,16)}..., rhid: ${rhid}`);
      const redirectUrl = `http://${GATEWAY_IP}:${GATEWAY_PORT}/opennds_auth/?tok=${rhid}`;
      return res.redirect(302, redirectUrl);
    }
  }

  // 4. Default
  console.log(`[DEFAULT] Unhandled request: ${req.method} ${req.url}`);
  res.status(200).json({ status: 'ok', message: 'FAS server ready' });
}