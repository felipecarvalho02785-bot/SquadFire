-- ─────────────────────────────────────────────────────────────
-- SquadFire · 0029 — UNIQUE em comentario.clickup_comment_id
-- ─────────────────────────────────────────────────────────────
-- Bug (auditoria): sem índice único, a corrida push↔eco criava 2 linhas do
-- mesmo comentário do ClickUp. Daí o anti-eco (maybeSingle) estourava (>1
-- linha), era tratado como "não achei" e a duplicação virava bola de neve.
-- Deduplica o que já existir (mantém a linha mais antiga por ctid) e cria um
-- índice único parcial (só quando o id não é nulo — comentários nativos ficam
-- livres). Backstop de idempotência: mesmo numa corrida, o 2º insert falha.

delete from comentario c
  using comentario d
 where c.clickup_comment_id is not null
   and c.clickup_comment_id = d.clickup_comment_id
   and c.ctid > d.ctid;

create unique index if not exists uq_comentario_clickup_comment_id
  on comentario (clickup_comment_id)
  where clickup_comment_id is not null;
