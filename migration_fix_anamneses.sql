-- Migration to fix anamneses table client_id type from integer to uuid
-- Run this in Supabase SQL Editor

-- Step 1: Drop the foreign key constraint
ALTER TABLE public.anamneses DROP CONSTRAINT IF EXISTS anamneses_client_id_fkey;

-- Step 2: Alter the column type from integer to uuid
ALTER TABLE public.anamneses ALTER COLUMN client_id TYPE uuid USING client_id::uuid;

-- Step 3: Re-add the foreign key constraint with the correct type
ALTER TABLE public.anamneses 
ADD CONSTRAINT anamneses_client_id_fkey 
FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
