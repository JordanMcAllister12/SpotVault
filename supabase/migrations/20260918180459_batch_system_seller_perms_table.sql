/*
# Seller permissions table
*/
CREATE TABLE IF NOT EXISTS public.sv_seller_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  spots boolean NOT NULL DEFAULT false,
  video boolean NOT NULL DEFAULT false,
  multi_spot_analysis boolean NOT NULL DEFAULT false,
  hh_bundles boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sv_seller_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seller_perm_select_own" ON public.sv_seller_permissions;
CREATE POLICY "seller_perm_select_own"
  ON public.sv_seller_permissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_seller_permissions_user
  ON public.sv_seller_permissions(user_id);