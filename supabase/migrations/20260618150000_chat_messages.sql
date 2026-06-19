-- Chat "Fale Conosco" — mensagens persistidas para visitantes e respostas Hermes/sistema.
-- Escrita anônima apenas via API routes com service role.

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  visitor_name text NULL,
  visitor_email text NULL,
  direction text NOT NULL CHECK (direction IN ('visitor', 'hermes', 'system')),
  kind text NOT NULL CHECK (kind IN ('duvida', 'sugestao', 'reclamacao', 'resposta', 'outro')),
  content text NOT NULL CHECK (char_length(content) <= 1000),
  is_read_by_costa boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NULL
);

CREATE INDEX chat_messages_session_created_idx
  ON public.chat_messages (session_id, created_at DESC);

CREATE INDEX chat_messages_unread_costa_idx
  ON public.chat_messages (is_read_by_costa, created_at);

CREATE INDEX chat_messages_user_id_idx
  ON public.chat_messages (user_id);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_messages_authenticated_select_own
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.chat_messages IS
  'Mensagens do chat Fale Conosco. Anônimos acessam via API com service role; authenticated lê apenas user_id = auth.uid().';
