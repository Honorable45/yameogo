-- Remplace les références séquentielles générées automatiquement (TEL-0001, ACC-00001, PCE-00001)
-- par des références aléatoires (TEL-7K3QX9…) : elles ne révèlent plus le volume du stock
-- et ne permettent plus de parcourir les fiches publiques. Les références saisies à la main sont conservées.

-- 6 caractères tirés de gen_random_uuid() (aléa cryptographique), sans 0/O ni 1/I/L.
CREATE FUNCTION pg_temp.random_ref(prefix text) RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT prefix || '-' || string_agg(substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', (get_byte(decode(replace(gen_random_uuid()::text, '-', ''), 'hex'), i) % 31) + 1, 1), '' ORDER BY i)
  FROM generate_series(0, 5) AS i
$$;

-- Téléphones : la référence figure aussi à la fin de l'adresse publique (slug).
UPDATE "UsedPhone" p
SET "reference" = n.ref,
    "slug" = regexp_replace(p."slug", lower(p."reference") || '$', lower(n.ref))
FROM (SELECT "id", pg_temp.random_ref('TEL') AS ref FROM "UsedPhone" WHERE "reference" ~ '^TEL-D?[0-9]+$') n
WHERE p."id" = n."id";

UPDATE "Product" p
SET "sku" = n.ref
FROM (SELECT "id", pg_temp.random_ref(split_part("sku", '-', 1)) AS ref FROM "Product" WHERE "sku" ~ '^(ACC|PCE)-[0-9]+$') n
WHERE p."id" = n."id";
