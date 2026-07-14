import { Topbar } from '@/components/Topbar';
import { FaiscaPageChat } from '@/components/FaiscaPageChat';

export const dynamic = 'force-dynamic';

export default function FaiscaPage() {
  return (
    <div className="main">
      <Topbar title="Faísca" sub="a IA da squad" />
      <div className="content">
        <div className="pagehead">
          <div>
            <div className="eye">Gestão · Inteligência</div>
            <h2>Faísca</h2>
            <p>A IA da squad — consulta, redige, organiza e provoca. Roda no Google Gemini (chat, ingestão e escrita), server-side (chaves nunca no browser).</p>
          </div>
        </div>

        <FaiscaPageChat />
      </div>
    </div>
  );
}
