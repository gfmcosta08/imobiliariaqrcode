import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nome, email, mensagem, assunto } = body;
    const type = body.type || 'duvidas';

    if (!nome || !email || !mensagem) {
      return NextResponse.json(
        { ok: false, error: 'nome, email e mensagem são obrigatórios' },
        { status: 400 }
      );
    }

    // Send to the VPS bridge endpoint
    const response = await fetch(
      'https://193.203.174.173:5002/api/contato',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, nome, email, mensagem, assunto }),
        // Allow self-signed cert (VPS uses HTTP, not HTTPS)
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error('Bridge endpoint error:', response.status, text);
      return NextResponse.json(
        { ok: false, error: 'Erro ao enviar mensagem' },
        { status: 502 }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Contato API error:', error);
    return NextResponse.json(
      { ok: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
