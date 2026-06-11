// pages/index.js
import { useRouter } from 'next/router';
import { useState } from 'react';

export default function Home() {
  const router = useRouter();
  const { hid, fas, originurl } = router.query;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'auth', 
          hid: hid,
          fas: fas,
          originurl: originurl 
        })
      });
      
      if (response.redirected) {
        window.location.href = response.url;
      } else {
        const data = await response.json();
        if (data.redirect) {
          window.location.href = data.redirect;
        } else {
          setError(data.error || 'Terjadi kesalahan');
        }
      }
    } catch (err) {
      setError('Error: ' + err.message);
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
          ✅ Sistem Berjalan
        </div>
        <p style={{ color: '#666', lineHeight: '1.6', marginBottom: '24px' }}>
          Selamat datang di layanan WiFi KotaCloud.<br />Klik tombol di bawah untuk memulai.
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
          {loading ? 'Memproses...' : '🌐 Lanjutkan ke Internet'}
        </button>
        {error && <p style={{ marginTop: '16px', fontSize: '12px', color: '#e74c3c' }}>{error}</p>}
        <div style={{ fontSize: '11px', color: '#999', marginTop: '24px' }}>
          Dengan melanjutkan, Anda menyetujui Syarat & Ketentuan
        </div>
      </div>
    </div>
  );
}