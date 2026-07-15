/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // A integração ClickUp (integracao/**) é Node puro, fora do bundle do Next.
  outputFileTracingExcludes: {
    '*': ['./design/**', './docs/**'],
  },
  experimental: {
    // Cache do roteador no CLIENTE (por sessão do navegador, sem vazar entre
    // usuários): páginas dinâmicas já visitadas ficam reutilizáveis por N
    // segundos, então RE-NAVEGAR entre abas é instantâneo (zero ida ao
    // servidor). Mutações (server actions com revalidatePath) invalidam o
    // cache normalmente — o dado não fica preso; no máximo fica alguns segundos
    // "atrasado" ao voltar numa aba sem ter editado nada.
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
};

export default nextConfig;
