
CREATE OR REPLACE FUNCTION public.get_master_directory_categories()
RETURNS TABLE(category TEXT, lead_count BIGINT, unique_emails BIGINT, latest_entry TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COALESCE(NULLIF(TRIM(search_query), ''), 'Uncategorized') AS category,
    COUNT(*) AS lead_count,
    COUNT(DISTINCT unnested_email) AS unique_emails,
    MAX(created_at) AS latest_entry
  FROM public.master_business_directory
  LEFT JOIN LATERAL unnest(emails) AS unnested_email ON true
  GROUP BY COALESCE(NULLIF(TRIM(search_query), ''), 'Uncategorized')
  ORDER BY lead_count DESC;
$$;
