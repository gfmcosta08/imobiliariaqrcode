import { NextRequest, NextResponse } from 'next/server';

const BRIDGE_URL = process.env.CONTATO_BRIDGE_URL || 'http://193.203.174.173:5002/api/contato';

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
    const response = await fetch(BRIDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, nome, email, mensagem, assunto }),
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });

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
