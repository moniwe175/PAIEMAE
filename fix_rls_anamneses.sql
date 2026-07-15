-- Fix RLS policies for anamneses table
-- Run this in Supabase SQL Editor

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own anamneses" ON public.anamneses;
DROP POLICY IF EXISTS "Users can insert own anamneses" ON public.anamneses;
DROP POLICY IF EXISTS "Users can update own anamneses" ON public.anamneses;
DROP POLICY IF EXISTS "Users can delete own anamneses" ON public.anamneses;

-- Create new policies that allow authenticated users to manage their own data
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
