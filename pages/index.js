cat > pages/index.js << 'EOF'
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';

export default function Home() {
  const router = useRouter();
  const { fas, hid, from } = router.query;
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Jika tidak ada parameter FAS, ini halaman biasa
    if (!fas && !hid && from !== 'opennds') {
      setMessage('Mode pengujian - tidak ada parameter FAS');
    }
  }, [fas, hid, from]);

  const handleContinue = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      // Kirim request autentikasi ke API
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hid: hid, fas: fas, action: 'auth' }),
      });
      
      // Jika response redirect, ikuti redirectnya
      if (response.redirected) {
        window.location.href = response.url;
      } else {
        const data = await response.json();
        if (data.redirect) {
          window.location.href = data.redirect;
        } else if (data.error) {
          setMessage('Error: ' + data.error);
        } else {
          setMessage('Autentikasi berhasil, silakan tunggu...');
          // Tunggu 2 detik, lalu coba akses internet
          setTimeout(() => {
            window.location.href = 'http://neverssl.com';
          }, 2000);
        }
      }
    } catch (error) {
      setMessage('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '40px',
        textAlign: 'center',
        maxWidth: '450px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
      }}>
        <h1 style={{ fontSize: '28px', marginBottom: '16px', color: '#333' }}>☕ KotaCloud DaaS</h1>
        <div style={{ background: '#4CAF50', color: 'white', padding: '8px 20px', borderRadius: '40px', display: 'inline-block', fontSize: '14px', marginBottom: '20px' }}>
          Sistem Berjalan
        </div>
        <p style={{ color: '#666', lineHeight: '1.6', marginBottom: '24px' }}>
          Selamat datang di layanan WiFi KotaCloud.<br />
          Klik tombol di bawah untuk memulai.
        </p>
        <button
          onClick={handleContinue}
          disabled={loading}
          style={{
            background: '#667eea',
            color: 'white',
            border: 'none',
            padding: '14px 28px',
            fontSize: '16px',
            borderRadius: '40px',
            cursor: loading ? 'not-allowed' : 'pointer',
            width: '100%',
            fontWeight: 'bold',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? 'Memproses...' : 'Lanjutkan ke Internet'}
        </button>
        {message && (
          <p style={{ marginTop: '20px', fontSize: '12px', color: message.includes('berhasil') ? '#4CAF50' : '#e74c3c' }}>
            {message}
          </p>
        )}
        <div style={{ fontSize: '11px', color: '#999', marginTop: '24px' }}>
          Dengan melanjutkan, Anda menyetujui Syarat & Ketentuan
        </div>
      </div>
    </div>
  );
}