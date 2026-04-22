-- Onboarding por convite: anúncios cortesia com QR Code pré-gerado.
-- O Admin gera um pacote (login numérico + senha numérica + QR Code impresso),
-- entrega ao corretor fisicamente. O corretor usa esses códigos para
-- ativar a conta e preencher os dados do imóvel.

-- 1. Adicionar 'reserved' como status válido de listing_status
ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_listing_status_check;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_listing_status_check
  CHECK (listing_status IN ('draft', 'published', 'printed', 'expired', 'removed', 'blocked', 'reserved'));

-- 2. Adicionar published_at na tabela properties
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- 3. Tabela de convites
CREATE TABLE IF NOT EXISTS public.broker_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login_code text UNIQUE NOT NULL,
  access_code_hash text NOT NULL,
  temp_auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  temp_email text NOT NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'claimed', 'expired')),
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '180 days',
  claimed_at timestamptz,
  claimed_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_broker_invitations_login_code
  ON public.broker_invitations (login_code);

CREATE INDEX IF NOT EXISTS idx_broker_invitations_temp_auth_user_id
  ON public.broker_invitations (temp_auth_user_id);

-- 4. RLS
ALTER TABLE public.broker_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_full_access_invitations" ON public.broker_invitations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Usuário autenticado pode ler seu próprio convite (para o middleware verificar must_complete_profile)
CREATE POLICY "owner_read_own_invitation" ON public.broker_invitations
  FOR SELECT USING (temp_auth_user_id = auth.uid());

-- 5. Trigger: ao publicar um imóvel originado de convite, define published_at
--    e expires_at = published_at + 90 dias (cortesia)
CREATE OR REPLACE FUNCTION public.fn_set_property_published_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.listing_status = 'published' AND (OLD.listing_status IS DISTINCT FROM 'published') THEN
    NEW.published_at := now();
    -- Imóveis originados de convite cortesia: expiração de 90 dias
    IF EXISTS (SELECT 1 FROM public.broker_invitations WHERE property_id = NEW.id) THEN
      NEW.expires_at := now() + interval '90 days';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_property_published_at ON public.properties;
CREATE TRIGGER trg_property_published_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_property_published_at();

-- 6. RPC para buscar o property_id do convite do usuário logado (para o onboarding)
CREATE OR REPLACE FUNCTION public.get_my_invitation_property()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT property_id
  FROM public.broker_invitations
  WHERE temp_auth_user_id = auth.uid()
    AND status = 'pending'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_invitation_property() TO authenticated;
