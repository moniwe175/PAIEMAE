-- Complete RLS fix for clients and anamneses tables
-- Run this in Supabase SQL Editor

-- Fix clients table RLS policies
DROP POLICY IF EXISTS "Users can view own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can insert own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can delete own clients" ON public.clients;

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

-- Fix anamneses table RLS policies
DROP POLICY IF EXISTS "Users can view own anamneses" ON public.anamneses;
DROP POLICY IF EXISTS "Users can insert own anamneses" ON public.anamneses;
DROP POLICY IF EXISTS "Users can update own anamneses" ON public.anamneses;
DROP POLICY IF EXISTS "Users can delete own anamneses" ON public.anamneses;

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

-- Enable RLS on both tables (in case it was disabled)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anamneses ENABLE ROW LEVEL SECURITY;
