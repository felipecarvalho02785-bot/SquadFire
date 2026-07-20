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
    // servidor). Junto com o prefetch da Sidebar, a navegação fica instantânea.
    // Mutações (revalidatePath) invalidam o cache; o pull-on-view + webhook
    // mantêm o frescor, então 45s é um bom equilíbrio (rápido, sem ficar velho).
    staleTimes: {
      dynamic: 45,
      static: 300,
    },
  },
};

export default nextConfig;
