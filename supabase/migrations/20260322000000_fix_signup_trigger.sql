-- ════════════════════════════════════════════════════════════════════════════
-- Fix signup: handle_new_user trigger
--
-- Run this in Supabase SQL Editor if signups show "Database error saving new user".
-- It drops any broken old trigger and creates a correct one.
-- ════════════════════════════════════════════════════════════════════════════

-- Drop any existing broken trigger / function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Create a robust handle_new_user function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    user_type,
    full_name,
    email,
    ca_verification_status
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'business_owner'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    CASE
      WHEN NEW.raw_user_meta_data->>'user_type' = 'chartered_accountant' THEN 'pending'
      ELSE 'not_applicable'
    END
  )
  ON CONFLICT (id) DO NOTHING;  -- safe if client-side insert already ran

  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
