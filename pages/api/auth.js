// Konfigurasi - HARUS SAMA DENGAN DI OPENWRT
const FASKEY = '3f5a8c9d2e1b4f7a6c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b';
const crypto = require('crypto');

// Simpan rhid (return hashed id) - dalam produksi pakai Redis/database
const authenticatedClients = new Map();

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export default async function handler(req, res) {
  // Handle Authmon polling (GET request dengan auth_get=view)
  if (req.method === 'GET' && req.query.auth_get === 'view') {
    const rhids = Array.from(authenticatedClients.keys());
    console.log(`Authmon polling: returning ${rhids.length} rhids`);
    
    // Format yang diharapkan openNDS: setiap rhid dalam baris terpisah, diapit <rhid>
    let response = '';
    rhids.forEach(rhid => {
      response += `<rhid>${rhid}</rhid>\n`;
    });
    return res.status(200).send(response);
  }

  // Handle request dari client (browser)
  if (req.method === 'POST') {
    const { fas, hid, action } = req.body;

    if (action === 'auth' && hid) {
      // Hitung rhid = sha256(hid + faskey)
      const rhid = sha256(hid + FASKEY);
      
      // Simpan rhid untuk diambil Authmon
      authenticatedClients.set(rhid, {
        createdAt: Date.now(),
        hid: hid
      });
      
      console.log(`Client authenticated: hid=${hid}, rhid=${rhid}`);
      
      // Hapus expired entries (lebih dari 5 menit)
      const now = Date.now();
      for (const [key, value] of authenticatedClients.entries()) {
        if (now - value.createdAt > 5 * 60 * 1000) {
          authenticatedClients.delete(key);
        }
      }
      
      // Redirect ke Authmon endpoint (openNDS)
      const redirectUrl = `http://status.client:2050/opennds_auth/?tok=${rhid}`;
      return res.status(200).json({ success: true, redirect: redirectUrl });
    }
  }

  // Method tidak dikenal
  res.status(405).json({ error: 'Method not allowed' });
}
