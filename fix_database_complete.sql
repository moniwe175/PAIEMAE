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

-- Fix client_id type in anamneses if it's still integer
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'anamneses' AND column_name = 'client_id' AND data_type = 'integer'
  ) THEN
    ALTER TABLE public.anamneses DROP CONSTRAINT IF EXISTS anamneses_client_id_fkey;
    ALTER TABLE public.anamneses ALTER COLUMN client_id TYPE uuid USING client_id::text::uuid;
    ALTER TABLE public.anamneses 
      ADD CONSTRAINT anamneses_client_id_fkey 
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
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
