import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SquadFire · A Forja das Crias',
  description: 'CRM interno do Squad 08 (E3 Digital) — a Forja da Estruturação.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
