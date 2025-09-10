-- SQL query to check existing RLS policies
SELECT
    n.nspname AS schema,
    c.relname AS table,
    pol.polname AS policy_name,
    CASE
        WHEN pol.polpermissive THEN 'PERMISSIVE'
        ELSE 'RESTRICTIVE'
    END AS permissive,
    CASE
        WHEN pol.polroles = '{0}' THEN 'PUBLIC'
        ELSE array_to_string(array(SELECT rolname FROM pg_roles WHERE oid = ANY(pol.polroles)), ', ')
    END AS roles,
    pg_catalog.pg_get_expr(pol.polqual, pol.polrelid) AS expression,
    pg_catalog.pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check,
    CASE pol.polcmd
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        WHEN '*' THEN 'ALL'
    END AS command
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
ORDER BY schema, "table", policy_name;
