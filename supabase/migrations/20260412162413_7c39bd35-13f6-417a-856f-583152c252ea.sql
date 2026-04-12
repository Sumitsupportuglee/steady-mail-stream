ALTER TYPE public.subscription_plan_type ADD VALUE IF NOT EXISTS 'starter_monthly';
ALTER TYPE public.subscription_plan_type ADD VALUE IF NOT EXISTS 'starter_yearly';
ALTER TYPE public.subscription_plan_type ADD VALUE IF NOT EXISTS 'business_monthly';
ALTER TYPE public.subscription_plan_type ADD VALUE IF NOT EXISTS 'business_yearly';