// pages/api/auth.js (VERSI FINAL)
const FASKEY = 'efa6e135ae80bfdd3beb695780d156fc2896dab2ef2a132f11b352b02408587f';
const GATEWAY_IP = '10.0.0.1';
const GATEWAY_PORT = '2050';
const crypto = require('crypto');

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function extractHidFromFas(fasString) {
  if (!fasString) return null;
  try {
    const decoded = Buffer.from(fasString, 'base64').toString('utf-8');
    const match = decoded.match(/hid=([a-f0-9]+)/);
    return match ? match[1] : null;
  } catch (error) {
    console.error('Failed to decode fas:', error);
    return null;
  }
}

const authenticatedClients = new Map();

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  console.log(`[REQUEST] ${req.method} ${req.url}`);

  // 1. Handle Authmon polling
  if (req.method === 'GET' && url.searchParams.get('auth_get') === 'view') {
    const rhids = Array.from(authenticatedClients.keys());
    console.log(`[AUTHMON] Returning ${rhids.length} rhids`);
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(rhids.join('\n'));
  }

  // 2. Handle Login action (redirect ke openNDS)
  if (url.searchParams.get('action') === 'login') {
    let hid = url.searchParams.get('hid');
    console.log(`[LOGIN] Received hid: ${hid}`);
    
    if (hid && hid !== 'undefined') {
      const rhid = sha256(hid + FASKEY);
      authenticatedClients.set(rhid, { createdAt: Date.now(), hid });
      console.log(`[LOGIN] Success - redirecting with rhid: ${rhid.substring(0,16)}...`);
      const redirectUrl = `http://${GATEWAY_IP}:${GATEWAY_PORT}/opennds_auth/?tok=${rhid}`;
      return res.redirect(302, redirectUrl);
    } else {
      console.log(`[LOGIN] ERROR: Invalid hid`);
      return res.status(400).send('Invalid hid parameter');
    }
  }

  // 3. Handle Splash Page (GET request)
  if (req.method === 'GET') {
    // Coba dapatkan hid dari parameter (langsung atau dari fas)
    let hid = url.searchParams.get('hid');
    if (!hid || hid === 'undefined') {
      const fas = url.searchParams.get('fas');
      if (fas) {
        hid = extractHidFromFas(fas);
        console.log(`[SPLASH] Extracted hid from fas: ${hid ? hid.substring(0,16)+'...' : 'null'}`);
      }
    }
    
    // Jika masih tidak ada, tampilkan error
    if (!hid || hid === 'undefined') {
      console.log(`[SPLASH] ERROR: No valid hid found`);
      return res.status(400).send('Missing hid parameter');
    }
    
    console.log(`[SPLASH] Serving page for hid: ${hid.substring(0,16)}...`);
    
    // Tampilkan halaman HTML dengan hid yang valid
    return res.status(200).setHeader('Content-Type', 'text/html').send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>KotaCloud DaaS</title>
        <style>
          *{margin:0;padding:0;box-sizing:border-box}
          body{font-family:system-ui;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;display:flex;justify-content:center;align-items:center;margin:0}
          .card{background:white;border-radius:20px;padding:40px;text-align:center;max-width:450px;margin:20px;box-shadow:0 20px 40px rgba(0,0,0,0.2)}
          h1{font-size:28px;margin-bottom:16px;color:#333}
          .badge{background:#4CAF50;color:white;padding:8px 20px;border-radius:40px;display:inline-block;font-size:14px;margin-bottom:20px}
          p{color:#666;line-height:1.6;margin-bottom:24px}
          button{background:#667eea;color:white;border:none;padding:14px 28px;font-size:16px;border-radius:40px;cursor:pointer;width:100%;font-weight:bold}
          button:hover{background:#5a67d8}
          .footer{font-size:11px;color:#999;margin-top:24px}
        </style>
      </head>
      <body>
        <div class="card">
          <h1>☕ KotaCloud DaaS</h1>
          <div class="badge">✅ Sistem Berjalan</div>
          <p>Selamat datang di layanan WiFi KotaCloud.<br>Klik tombol di bawah untuk memulai.</p>
          <button onclick="window.location.href='/api/auth?action=login&hid=${hid}'">🌐 Lanjutkan ke Internet</button>
          <div class="footer">Dengan melanjutkan, Anda menyetujui Syarat & Ketentuan</div>
        </div>
      </body>
      </html>
    `);
  }

  // 4. Default response
  console.log(`[DEFAULT] ${req.method} ${req.url}`);
  res.status(200).json({ status: 'ok', message: 'FAS server ready' });
}