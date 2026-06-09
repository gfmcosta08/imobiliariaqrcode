'use client';

import { useState, FormEvent } from 'react';

export default function ContatoPage() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [status, setStatus] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setStatus(null);

    try {
      const res = await fetch('/api/contato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'duvidas', nome, email, mensagem }),
      });

      const data = await res.json();

      if (data.ok) {
        setStatus({ tipo: 'sucesso', texto: 'Mensagem enviada com sucesso! Responderemos em breve.' });
        setNome('');
        setEmail('');
        setMensagem('');
      } else {
        setStatus({ tipo: 'erro', texto: data.error || 'Erro ao enviar mensagem.' });
      }
    } catch {
      setStatus({ tipo: 'erro', texto: 'Erro de conexão. Tente novamente.' });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: '#e2e8f0',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid #334155',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <a href="/" style={{
          color: '#3b82f6',
          textDecoration: 'none',
          fontSize: '20px',
          fontWeight: 700,
        }}>
          ImobQR
        </a>
        <span style={{ color: '#64748b' }}>|</span>
        <span style={{ color: '#94a3b8' }}>Fale Conosco</span>
      </header>

      {/* Content */}
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: '48px 24px',
      }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: 700,
          marginBottom: '8px',
        }}>
          Fale Conosco
        </h1>
        <p style={{ color: '#94a3b8', marginBottom: '32px', fontSize: '16px' }}>
          Tem uma dúvida, sugestão ou problema? Mande sua mensagem.
        </p>

        {status && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '24px',
            backgroundColor: status.tipo === 'sucesso' ? '#064e3b' : '#7f1d1d',
            border: `1px solid ${status.tipo === 'sucesso' ? '#059669' : '#dc2626'}`,
            color: status.tipo === 'sucesso' ? '#a7f3d0' : '#fecaca',
          }}>
            {status.texto}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}>
          <div>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#cbd5e1',
            }}>
              Nome *
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #334155',
                backgroundColor: '#1e293b',
                color: '#e2e8f0',
                fontSize: '15px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#334155'}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#cbd5e1',
            }}>
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #334155',
                backgroundColor: '#1e293b',
                color: '#e2e8f0',
                fontSize: '15px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#334155'}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: '6px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#cbd5e1',
            }}>
              Mensagem *
            </label>
            <textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              required
              rows={5}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #334155',
                backgroundColor: '#1e293b',
                color: '#e2e8f0',
                fontSize: '15px',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#334155'}
            />
          </div>

          <button
            type="submit"
            disabled={enviando}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: enviando ? '#64748b' : '#3b82f6',
              color: '#fff',
              fontSize: '16px',
              fontWeight: 600,
              cursor: enviando ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
            }}
          >
            {enviando ? 'Enviando...' : 'Enviar Mensagem'}
          </button>
        </form>

        <p style={{
          marginTop: '32px',
          fontSize: '13px',
          color: '#64748b',
          textAlign: 'center',
        }}>
          Seu contato será respondido em até 24h úteis.
        </p>
      </div>
    </div>
  );
}
