# Biblioteca ligada ao Google Drive

A página **Biblioteca** mostra dois acervos juntos:

- **Google Drive** — uma pasta compartilhada da squad (a fonte principal), lida
  pelo servidor via **conta de serviço** (um "robô" do Google), somente leitura.
- **Acervo manual** — os roteiros/criativos que a Brigada adiciona pelo próprio
  app (tabela `biblioteca_item` no Supabase). Continua funcionando como antes.

O Drive é **opcional**: sem as variáveis abaixo, a Biblioteca mostra só o acervo
manual (nada quebra).

## Por que conta de serviço (e não o login Google)

O login Google dos membros só tem permissão de **Agenda**. Para um acervo
**compartilhado** (todo mundo vê a mesma biblioteca), a conta de serviço é o
caminho certo: é server-to-server, não depende do login de ninguém, não tem tela
de consentimento e o acesso não expira por inatividade. Basta compartilhar a
pasta com o e-mail do robô.

## Setup (uma vez)

### 1. Criar a conta de serviço + chave

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) e escolha
   (ou crie) um projeto.
2. **APIs e serviços → Biblioteca** → habilite a **Google Drive API**.
3. **APIs e serviços → Credenciais → Criar credenciais → Conta de serviço**.
   Dê um nome (ex.: `squadfire-biblioteca`) e crie.
4. Abra a conta de serviço → aba **Chaves → Adicionar chave → Criar nova chave →
   JSON**. Baixa um arquivo `.json`. **Guarde com segurança — é um segredo.**
5. Anote o e-mail da conta de serviço (algo como
   `squadfire-biblioteca@SEU-PROJETO.iam.gserviceaccount.com`).

### 2. Compartilhar a pasta com o robô

No Google Drive, abra a pasta **"Biblioteca de arquivos"** (a que tem as
subpastas `Roteiros` e `Criativos`) → **Compartilhar** → adicione o **e-mail da
conta de serviço** com permissão de **Leitor**.

Copie o **ID da pasta**: é o trecho da URL depois de `/folders/`, por exemplo em
`https://drive.google.com/drive/folders/1gmbGrE2F-1WiFDIzkXlQglA1KvMPAb_g` o ID é
`1gmbGrE2F-1WiFDIzkXlQglA1KvMPAb_g`.

### 3. Configurar as variáveis na Vercel

Em **Vercel → Project → Settings → Environment Variables**, adicione:

| Variável | Valor |
| --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | o **conteúdo** do `.json` da chave (cole o JSON inteiro; base64 também é aceito) |
| `BIBLIOTECA_DRIVE_FOLDER_ID` | o ID da pasta compartilhada |

> Dica: se colar o JSON cru der problema de quebra de linha no painel, rode
> `base64 -w0 chave.json` (Linux) / `base64 -i chave.json` (macOS) e cole o
> resultado — o app aceita os dois formatos.

Faça um **redeploy** para as variáveis entrarem em vigor.

## Como o app organiza o Drive

O servidor varre a árvore da pasta e classifica cada arquivo:

- **Roteiro × Criativo**: pela ramificação em que o arquivo está (`Roteiros` vs
  `Criativos`); se estiver fora dessas pastas, pelo tipo do arquivo (imagem/vídeo
  = criativo; documento/pdf = roteiro).
- **Tema**: a primeira subpasta abaixo da categoria (ex.: `Previdenciário`,
  `Salário Maternidade`) — vira um filtro na página.

Imagens ganham **preview** (miniatura) servida pelo próprio app; os demais
arquivos abrem direto no Drive.

## Segurança e limites

- A chave da conta de serviço vive **só** nas variáveis de ambiente do servidor
  (Vercel). Nunca vai pro cliente nem pro repositório.
- O preview de imagens passa por um proxy que **só** serve arquivos que já fazem
  parte da biblioteca varrida — não é um proxy aberto pro Drive — e exige membro
  logado.
- A varredura é **cacheada por 60s** e limitada (tempo/quantidade) para respeitar
  o teto de 60s das funções no plano Hobby da Vercel.
- Acesso somente leitura (`drive.readonly`). O app nunca escreve no Drive.
