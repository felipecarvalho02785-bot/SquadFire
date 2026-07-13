import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SquadFire · A Forja das Crias',
  description: 'CRM interno do Squad 08 (E3 Digital) — a Forja da Estruturação.',
};

// Aplica o estado da barra (expandida/trilho) antes da pintura — sem flash.
const RAIL_INIT = `try{if(localStorage.getItem('sf-rail')==='1')document.documentElement.classList.add('sf-rail')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <script dangerouslySetInnerHTML={{ __html: RAIL_INIT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
