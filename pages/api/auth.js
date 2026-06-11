// pages/api/auth.js
// FAS Server untuk openNDS Level 4 (HTTPS + Hash)
// Deploy ke Vercel

// ==============================================
// KONFIGURASI - SESUAIKAN DENGAN OPENWRT ANDA
// ==============================================
const FASKEY = 'efa6e135ae80bfdd3beb695780d156fc2896dab2ef2a132f11b352b02408587f';
const GATEWAY_IP = '10.0.0.1';
const GATEWAY_PORT = '2050';
// ==============================================

const crypto = require('crypto');

// Simpan daftar client yang sudah authenticated
const authenticatedClients = new Map();

// Helper: SHA256 hash
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Helper: Hapus expired entries (lebih dari 5 menit)
function cleanExpiredEntries() {
  const now = Date.now();
  for (const [key, value] of authenticatedClients.entries()) {
    if (now - value.createdAt > 5 * 60 * 1000) {
      authenticatedClients.delete(key);
    }
  }
}

// Helper: Ekstrak hid dari parameter fas (base64 encoded)
function extractHidFromFas(fasString) {
  if (!fasString) return null;
  try {
    const decoded = Buffer.from(fasString, 'base64').toString('utf-8');
    // Cari pola hid=xxxxx (hexadecimal)
    const match = decoded.match(/hid=([a-f0-9]+)/);
    return match ? match[1] : null;
  } catch (error) {
    console.error('Failed to decode fas:', error);
    return null;
  }
}

// Helper: Ekstrak originurl dari parameter fas
function extractOriginUrlFromFas(fasString) {
  if (!fasString) return null;
  try {
    const decoded = Buffer.from(fasString, 'base64').toString('utf-8');
    const match = decoded.match(/originurl=(.+?),/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Fungsi untuk menghasilkan Halaman HTML Splash
function getSplashPage(hid, originUrl) {
  const apiUrl = 'https://kota-cloud-fas.vercel.app/api/auth';
  
  return `<!DOCTYPE html>
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
        const hid = "${hid || ''}";
        const originUrl = "${originUrl || ''}";
        const apiUrl = "${apiUrl}";
        
        document.getElementById('continueBtn').onclick = async () => {
            const btn = document.getElementById('continueBtn');
            const msgDiv = document.getElementById('message');
            btn.disabled = true;
            btn.textContent = 'Memproses...';
            
            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        action: 'auth', 
                        hid: hid,
                        originurl: originUrl
                    })
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
                console.error('Fetch error:', error);
                msgDiv.textContent = 'Error: ' + error.message;
                btn.disabled = false;
                btn.textContent = '🌐 Lanjutkan ke Internet';
            }
        };
    </script>
</body>
</html>`;
}

export default async function handler(req, res) {
  // Set CORS headers untuk semua response
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
  if (req.method === 'GET' && req.query.auth_get === 'view') {
    cleanExpiredEntries();
    const rhids = Array.from(authenticatedClients.keys());
    console.log(`[Authmon] Polling: returning ${rhids.length} rhids`);
    
    // Format response: teks biasa, satu rhid per baris
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(rhids.join('\n'));
  }

  // ==============================================
  // 3. Handle Browser Splash (GET dengan hid ATAU fas)
  // ==============================================
  if (req.method === 'GET' && (req.query.hid || req.query.fas)) {
    let hid = req.query.hid;
    let originUrl = req.query.originurl;
    
    // Jika tidak ada hid, coba ekstrak dari parameter fas
    if (!hid && req.query.fas) {
      hid = extractHidFromFas(req.query.fas);
      if (!originUrl) {
        originUrl = extractOriginUrlFromFas(req.query.fas);
      }
    }
    
    if (hid) {
      console.log(`[Splash] Serving HTML page for hid: ${hid.substring(0, 16)}...`);
      return res.status(200)
        .setHeader('Content-Type', 'text/html')
        .send(getSplashPage(hid, originUrl));
    }
  }

  // ==============================================
  // 4. Handle Authentication (POST dengan action=auth)
  // ==============================================
  if (req.method === 'POST' && req.body?.action === 'auth') {
    const { hid, fas, originurl } = req.body;
    
    if (hid) {
      // Hitung rhid = sha256(hid + faskey)
      const rhid = sha256(hid + FASKEY);
      
      // Simpan rhid untuk diambil Authmon nanti
      authenticatedClients.set(rhid, {
        createdAt: Date.now(),
        hid: hid,
        fas: fas
      });
      
      console.log(`[Auth] Client authenticated: hid=${hid.substring(0, 16)}..., rhid=${rhid.substring(0, 16)}...`);
      
      // Redirect ke openNDS untuk menyelesaikan autentikasi
      let redirectUrl = `http://${GATEWAY_IP}:${GATEWAY_PORT}/opennds_auth/?tok=${rhid}`;
      
      if (originurl) {
        redirectUrl += `&redir=${encodeURIComponent(originurl)}`;
      }
      
      return res.redirect(302, redirectUrl);
    }
  }

  // ==============================================
  // 5. Default response untuk request lain
  // ==============================================
  console.log(`[Default] Unhandled request: ${req.method} ${req.url}`);
  res.status(200).json({ 
    status: 'ok', 
    message: 'FAS server is running',
    note: 'Endpoint for openNDS captive portal'
  });
}