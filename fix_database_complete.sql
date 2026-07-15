-- Complete database fix - adds missing columns and fixes RLS
-- Run this ONCE in Supabase SQL Editor

-- Add user_id column to clients table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add user_id column to anamneses table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'anamneses' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.anamneses ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can insert own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can delete own clients" ON public.clients;

DROP POLICY IF EXISTS "Users can view own anamneses" ON public.anamneses;
DROP POLICY IF EXISTS "Users can insert own anamneses" ON public.anamneses;
DROP POLICY IF EXISTS "Users can update own anamneses" ON public.anamneses;
DROP POLICY IF EXISTS "Users can delete own anamneses" ON public.anamneses;

-- Create new RLS policies with TO authenticated
CREATE POLICY "Users can view own clients"
  ON public.clients FOR SELECT
  TO authenticated
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can insert own clients"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Users can update own clients"
  ON public.clients FOR UPDATE
  TO authenticated
  USING ( auth.uid() = user_id )
  WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Users can delete own clients"
  ON public.clients FOR DELETE
  TO authenticated
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can view own anamneses"
  ON public.anamneses FOR SELECT
  TO authenticated
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can insert own anamneses"
  ON public.anamneses FOR INSERT
  TO authenticated
  WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Users can update own anamneses"
  ON public.anamneses FOR UPDATE
  TO authenticated
  USING ( auth.uid() = user_id )
  WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Users can delete own anamneses"
  ON public.anamneses FOR DELETE
  TO authenticated
  USING ( auth.uid() = user_id );

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anamneses ENABLE ROW LEVEL SECURITY;
