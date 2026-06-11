// pages/api/auth.js
// FAS Server untuk openNDS Level 4 (HTTPS + Hash)
// Deploy ke Vercel, Netlify, atau server Node.js lainnya

// ==============================================
// KONFIGURASI - SESUAIKAN DENGAN OPENWRT ANDA
// ==============================================
// Gunakan faskey yang SAMA dengan yang Anda set di OpenWrt
// Cara generate: echo "RahasiaAnda" | sha256sum | cut -d' ' -f1
const FASKEY = 'efa6e135ae80bfdd3beb695780d156fc2896dab2ef2a132f11b352b02408587f';

// IP Gateway OpenWrt (LAN)
const GATEWAY_IP = '10.0.0.1';
const GATEWAY_PORT = '2050';
// ==============================================

const crypto = require('crypto');

// Simpan daftar client yang sudah authenticated
// NOTE: Dalam produksi, gunakan Redis atau database permanen
const authenticatedClients = new Map();

// Helper function: SHA256 hash
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Helper function: Hapus expired entries (lebih dari 5 menit)
function cleanExpiredEntries() {
  const now = Date.now();
  for (const [key, value] of authenticatedClients.entries()) {
    if (now - value.createdAt > 5 * 60 * 1000) {
      authenticatedClients.delete(key);
    }
  }
}

export default async function handler(req, res) {
  // Enable CORS untuk semua response
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // ==============================================
  // 1. Handle preflight OPTIONS request (dari browser)
  // ==============================================
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ==============================================
  // 2. Handle Authmon polling (GET dengan auth_get=view)
  // ==============================================
  // Authmon di openNDS secara periodik memanggil endpoint ini
  // untuk mengambil daftar rhid client yang sudah login
  if (req.method === 'GET' && req.query.auth_get === 'view') {
    cleanExpiredEntries();
    const rhids = Array.from(authenticatedClients.keys());
    console.log(`[Authmon] Polling: returning ${rhids.length} rhids`);
    
    // Format response: setiap rhid dalam baris terpisah
    // Format yang diharapkan openNDS: teks biasa, satu rhid per baris
    let response = rhids.join('\n');
    
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(response);
  }

  // ==============================================
  // 3. Handle request dari client browser (login)
  // ==============================================
  // Bisa berupa POST (JSON) atau GET (query string)
  if ((req.method === 'POST') || (req.method === 'GET' && req.query.hid)) {
    let hid, fas, originUrl;
    
    if (req.method === 'POST') {
      hid = req.body?.hid;
      fas = req.body?.fas;
      originUrl = req.body?.originurl;
    } else {
      hid = req.query.hid;
      fas = req.query.fas;
      originUrl = req.query.originurl;
    }
    
    if (hid) {
      // Hitung rhid = sha256(hid + faskey) - SESUAI DENGAN FORMULA OPENNDS
      const rhid = sha256(hid + FASKEY);
      
      // Simpan rhid untuk diambil Authmon nanti
      authenticatedClients.set(rhid, {
        createdAt: Date.now(),
        hid: hid,
        fas: fas
      });
      
      console.log(`[Auth] Client authenticated: hid=${hid.substring(0, 16)}..., rhid=${rhid.substring(0, 16)}...`);
      
      // Redirect ke openNDS untuk menyelesaikan autentikasi
      // openNDS akan membaca parameter 'tok' dari URL ini
      const redirectUrl = `http://${GATEWAY_IP}:${GATEWAY_PORT}/opennds_auth/?tok=${rhid}`;
      
      // Jika ada originUrl (halaman yang diminta user), tambahkan ke redirect
      const finalRedirect = originUrl ? `${redirectUrl}&redir=${encodeURIComponent(originUrl)}` : redirectUrl;
      
      return res.redirect(302, finalRedirect);
    }
  }

  // ==============================================
  // 4. Handle request ke root path (tampilan splash)
  // ==============================================
  if (req.method === 'GET' && req.url === '/') {
    // Render halaman splash HTML
    const splashHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KotaCloud DaaS - WiFi Access</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: system-ui, -apple-system, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .card {
            background: white;
            border-radius: 20px;
            padding: 40px;
            text-align: center;
            max-width: 450px;
            margin: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
        }
        h1 { font-size: 28px; margin-bottom: 16px; color: #333; }
        .badge { background: #4CAF50; color: white; padding: 8px 20px; border-radius: 40px; display: inline-block; font-size: 14px; margin-bottom: 20px; }
        p { color: #666; line-height: 1.6; margin-bottom: 24px; }
        button { background: #667eea; color: white; border: none; padding: 14px 28px; font-size: 16px; border-radius: 40px; cursor: pointer; width: 100%; font-weight: bold; }
        button:hover { background: #5a67d8; }
        .footer { font-size: 11px; color: #999; margin-top: 24px; }
        .error { color: #e74c3c; margin-top: 16px; font-size: 12px; }
    </style>
</head>
<body>
    <div class="card">
        <h1>☕ KotaCloud DaaS</h1>
        <div class="badge">✅ Sistem Berjalan</div>
        <p>Selamat datang di layanan WiFi KotaCloud.<br>Klik tombol di bawah untuk memulai.</p>
        <button id="continueBtn">🌐 Lanjutkan ke Internet</button>
        <div id="message" class="error"></div>
        <div class="footer">Dengan melanjutkan, Anda menyetujui Syarat & Ketentuan</div>
    </div>
    <script>
        const urlParams = new URLSearchParams(window.location.search);
        const hid = urlParams.get('hid');
        const fas = urlParams.get('fas');
        const originurl = urlParams.get('originurl');
        
        document.getElementById('continueBtn').onclick = async () => {
            const btn = document.getElementById('continueBtn');
            const msgDiv = document.getElementById('message');
            btn.disabled = true;
            btn.textContent = 'Memproses...';
            
            try {
                const response = await fetch('/api/auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ hid: hid, fas: fas, originurl: originurl })
                });
                
                if (response.redirected) {
                    window.location.href = response.url;
                } else {
                    const data = await response.json();
                    if (data.redirect) {
                        window.location.href = data.redirect;
                    } else {
                        msgDiv.textContent = data.error || 'Terjadi kesalahan, silakan coba lagi';
                        btn.disabled = false;
                        btn.textContent = '🌐 Lanjutkan ke Internet';
                    }
                }
            } catch (error) {
                msgDiv.textContent = 'Error: ' + error.message;
                btn.disabled = false;
                btn.textContent = '🌐 Lanjutkan ke Internet';
            }
        };
    </script>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(splashHtml);
  }

  // ==============================================
  // 5. Default response untuk request lain
  // ==============================================
  console.log(`[Unhandled] ${req.method} ${req.url}`);
  res.status(200).json({ 
    status: 'ok', 
    message: 'FAS server is running',
    note: 'Endpoint for openNDS captive portal'
  });
}