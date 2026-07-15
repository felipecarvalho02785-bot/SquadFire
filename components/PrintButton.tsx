'use client';

// Botão que dispara a impressão (o navegador salva como PDF). Escondido no print.
export function PrintButton() {
  return (
    <button type="button" className="btn primary rel-noprint" onClick={() => window.print()}>
      Baixar PDF / Imprimir
    </button>
  );
}
