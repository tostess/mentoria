import { NextResponse } from 'next/server';

import { getAdmin } from '@/lib/firebase/admin';

/**
 * Teste de fumaca da conexao com o Firestore: escreve, le de volta e devolve o
 * que leu. Nao e endpoint de produto — serve para provar que credencial,
 * projeto e (quando ligados) emuladores estao conversando.
 *
 * `_health` nao tem regra propria em `firestore.rules`, entao cai no deny
 * padrao: so o Admin SDK chega aqui, que e exatamente o que queremos testar.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const { db } = getAdmin();
    const ref = db.collection('_health').doc('ping');

    await ref.set({ at: new Date().toISOString() });
    const snapshot = await ref.get();

    return NextResponse.json({ ok: true, data: snapshot.data() });
  } catch (error) {
    // Só a mensagem. Sem stack, sem process.env — o erro de env ja diz o nome
    // da variavel que falta, e nada alem disso deve sair daqui.
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
