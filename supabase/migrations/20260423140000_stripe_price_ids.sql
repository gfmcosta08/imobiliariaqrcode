-- Adiciona stripe_price_id à tabela plans
-- Preencher após criar os produtos no Stripe Dashboard
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS stripe_price_id text;

-- Adiciona stripe_customer_id à tabela accounts
-- Preenchido automaticamente na primeira sessão de checkout
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS stripe_customer_id text UNIQUE;

-- Índice para lookup rápido por customer Stripe
CREATE INDEX IF NOT EXISTS idx_accounts_stripe_customer_id
  ON public.accounts (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Garante que subscriptions.status aceita o valor 'solo_active'
-- (solo é pagamento único, não recorrente — status diferente de pro_active)
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check CHECK (status IN (
    'free',
    'solo_active',
    'pro_pending_activation',
    'pro_active',
    'past_due',
    'canceled',
    'expired'
  ));
