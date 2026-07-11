# SquadFire · Banco de dados (Supabase / Postgres)

Materialização de [`docs/modelo-de-dados.md`](../docs/modelo-de-dados.md) em migrations reais.
Validado contra Postgres 16 (triggers + RLS + seed).

## Estrutura

```
supabase/
├── config.toml                 # config do Supabase CLI (auth Google, storage, migrations)
├── seed.sql                    # catálogos fixos + rotinas + admin inicial
└── migrations/
    ├── 0001_extensions_e_helpers.sql   # pgcrypto, citext, schema app, set_updated_at()
    ├── 0002_enums.sql                  # todos os tipos enumerados
    ├── 0003_membros_e_rotinas.sql      # membro, membro_papel, rotina, rotina_papel + regra 6
    ├── 0004_crias.sql                  # cria, contrato, comentario
    ├── 0005_forja_lenha_gargalos.sql   # fase, forja, fase_da_forja, gargalo, plano, briefing, lenha
    ├── 0006_regras_de_negocio.sql      # triggers: cria→forja, contrato→prazos, avancar_fase
    ├── 0007_auth_e_rls.sql             # helpers de auth (JWT→membro) + políticas RLS
    └── 0008_grants.sql                 # grants dos papéis anon/authenticated/service_role
```

## Regras de negócio implementadas (triggers/funções)

| Regra | Onde | Efeito |
|---|---|---|
| 1 · Cadastro dispara a Estruturação | `trg_cria_cria_forja` | ao inserir `cria` cria `forja` + 7 `fase_da_forja` + Lenhas de Forja padrão |
| 2 · Contrato define os prazos | `trg_contrato_confirmado` → `app.aplicar_data_inicio` | confirmar contrato seta `forja.data_inicio` e calcula os prazos das 7 fases em cascata (7 dias cada) |
| 3 · Avanço manual + checklist | `app.avancar_fase(forja_id)` | só avança com as Lenhas da fase concluídas; move o ponteiro; gate de papel (Projetos/Admin) |
| 6 · Papel primário válido | `trg_membro_sync_papel` + `trg_membro_papel_protege` | garante `papel_primario ∈ membro_papel` e impede removê-lo |
| — · updated_at | `app.set_updated_at` | mantém `updated_at` em todas as tabelas com histórico |

## RLS (resumo)

Leitura ampla (todo membro ativo lê tudo); escrita por papel + `is_admin`. O membro é
resolvido pelo claim `email` do JWT do Google SSO contra a allowlist `membro.email`.
O `service_role` (integração ClickUp / jobs) bypassa RLS. Ver
[`docs/modelo-de-dados.md § Permissões`](../docs/modelo-de-dados.md#permissões-por-papel-base-pra-rls).

## Aplicar

**Com o Supabase CLI** (recomendado):

```bash
supabase link --project-ref <ref>
supabase db push          # aplica as migrations
psql "$DATABASE_URL" -f supabase/seed.sql   # ou supabase db reset em dev
```

**Direto no Postgres** (ex.: validação local):

```bash
for f in supabase/migrations/000*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done
psql "$DATABASE_URL" -f supabase/seed.sql
```

> Pré-requisito p/ rodar fora do Supabase: os papéis `anon`, `authenticated`,
> `service_role` precisam existir (o Supabase já os provê).

## Segredos

Nunca commitar chaves. Credenciais do Google OAuth, `service_role key` e connection string
vivem em variáveis de ambiente / painel do Supabase. Ver [`.env.example`](../.env.example).
