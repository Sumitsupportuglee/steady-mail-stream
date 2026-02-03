-- 1. Create an enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, role)
);

-- 3. Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 5. RLS policies for user_roles table
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 6. Add approval and rate limit fields to profiles
ALTER TABLE public.profiles
ADD COLUMN is_approved boolean DEFAULT false,
ADD COLUMN daily_send_limit integer DEFAULT 100,
ADD COLUMN hourly_send_limit integer DEFAULT 20,
ADD COLUMN emails_sent_today integer DEFAULT 0,
ADD COLUMN emails_sent_this_hour integer DEFAULT 0,
ADD COLUMN last_daily_reset timestamp with time zone DEFAULT now(),
ADD COLUMN last_hourly_reset timestamp with time zone DEFAULT now();

-- 7. Admin policy for profiles (admins can view/update all profiles)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 8. Admin policies for sender_identities
CREATE POLICY "Admins can view all sender identities"
ON public.sender_identities
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all sender identities"
ON public.sender_identities
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));