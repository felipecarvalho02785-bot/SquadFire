import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SquadFire · A Forja das Crias',
  description: 'CRM interno do Squad 08 (E3 Digital) — a Forja da Estruturação.',
};

// Aplica as preferências salvas (barra, tema, densidade, animações) antes da
// pintura — sem flash. As chaves são gravadas pela Forjaria e pela navbar.
const PREFS_INIT = `try{var d=document.documentElement,l=localStorage;
if(l.getItem('sf-rail')==='1')d.classList.add('sf-rail');
var t=l.getItem('sf-tema');
if(t==='claro'||(t==='sistema'&&matchMedia('(prefers-color-scheme: light)').matches))d.setAttribute('data-theme','light');
if(l.getItem('sf-densidade')==='compacto')d.classList.add('density-compact');
if(l.getItem('sf-reduz')==='1')d.classList.add('no-anim');
}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFS_INIT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
