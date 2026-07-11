# Deploy — SquadFire no ar (Supabase + Vercel)

Guia direto pra subir o SquadFire. O código já está pronto e o build passa;
o que falta é **provisionar as contas** (Supabase + Google OAuth + Vercel) e
**preencher as variáveis de ambiente**. ~30–45 min na primeira vez.

> Por LGPD, use a região **São Paulo (sa-east-1)** no Supabase.

---

## 1. Supabase (banco + auth + storage)

1. Crie um projeto em https://supabase.com (região South America / São Paulo).
2. **Aplicar o schema** — com o [Supabase CLI](https://supabase.com/docs/guides/cli):
   ```bash
   supabase link --project-ref <SEU_REF>
   supabase db push                      # aplica supabase/migrations/*
   psql "$DATABASE_URL" -f supabase/seed.sql
   ```
   (ou cole cada arquivo de `supabase/migrations/` + `seed.sql` no **SQL Editor**,
   em ordem 0001→0008 e depois o seed.)
3. **Auth › Providers › Google**: habilite e preencha Client ID/Secret (passo 2).
   Em **Auth › URL Configuration**, adicione as URLs de redirect:
   - `http://localhost:3000/auth/callback` (dev)
   - `https://<seu-app>.vercel.app/auth/callback` (prod)
4. **Auth › Providers**: desligue "Enable email signups" — o acesso é por
   allowlist (`membro`). Só quem está na tabela `membro` entra.
5. **Storage**: aplique [`supabase/storage.sql`](../supabase/storage.sql) no SQL Editor — cria os
   buckets `contratos`, `briefings`, `entregaveis` (privados) e as policies de acesso da squad.
   (Fica fora de `migrations/` porque o schema `storage` só existe no Supabase.)
6. Anote em **Project Settings › API**: `Project URL`, `anon key`, `service_role key`.

## 2. Google OAuth (SSO)

1. Google Cloud Console › **APIs & Services › Credentials › Create OAuth client ID**
   (Web application).
2. **Authorized redirect URIs**: `https://<SEU_REF>.supabase.co/auth/v1/callback`.
3. Copie **Client ID** e **Client Secret** para o provider Google do Supabase (1.3).
4. Tela de consentimento: tipo **Interno** (E3 Digital) — restringe ao domínio.

## 3. Primeiro membro (admin)

O `seed.sql` já insere um admin (`e3digital.software@gmail.com`). Ajuste o email
para o do dono e adicione a squad:
```sql
-- exemplo: adicionar um Gestor de Contas
insert into membro (nome,email,papel_primario,is_admin)
values ('Fulano','fulano@e3.com.br','gestor_contas',false);
-- o membro_papel do papel primário é criado automaticamente (trigger)
```

## 4. Vercel (app)

1. Importe o repositório na https://vercel.com (framework detectado: Next.js).
2. **Environment Variables** (Production + Preview) — de `.env.example`:
   | Variável | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL (1.6) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key (1.6) |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key (1.6) — **secreta** |
   | `NEXT_PUBLIC_SITE_URL` | `https://<seu-app>.vercel.app` |
   | `CLICKUP_API_TOKEN` | token do ClickUp (sync) |
   | `CRON_SECRET` | um segredo forte (protege `/api/clickup/sync`) |
   | `ANTHROPIC_API_KEY`, `GOOGLE_*` | quando ligar a Faísca (P1) |
3. **Deploy**. Rode o build; a home redireciona pra `/login`.

## 5. Sync do ClickUp (cron)

Agende o sync (Vercel Cron ou chamada externa):
```bash
curl -X POST https://<seu-app>.vercel.app/api/clickup/sync \
  -H "Authorization: Bearer $CRON_SECRET"
```
Isso materializa as Crias (Squad 08) e dispara a Forja de cada nova task.
Cadência sugerida: 15–30 min. (`vercel.json` › `crons`, ou um agendador externo.)

---

## Rodar local (dev)

```bash
npm install
cp .env.example .env.local     # preencha com as chaves reais
npm run dev                    # http://localhost:3000
```
Sem `.env.local`, o app sobe em **modo demonstração** (banner + estados vazios),
útil pra ver a UI sem banco.

## O que ainda é P1 (não bloqueia o "no ar")

Extração de contrato (Gemini), pipeline de briefing (áudio→IA→ClickUp), motor de
recorrência das Lenhas, Google Calendar (agenda do dia + Roda de Fogo) e a Faísca
com tool-calling. Ver [`roteiro-producao.md`](roteiro-producao.md).
