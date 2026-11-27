-- pgTAP: seed_tags.test.sql
-- Spec 003-tag-qr, T020. Confere o trecho `-- >>> 003-tag-qr` do supabase/seed.sql depois do `supabase db reset` / `supabase start`
-- (o CI sempre carrega o seed). Nao depende dos codigos gerados: so do vetor sintetico do Paçoca (7K3M-Q9XA-C) e da
-- estrutura. PINs: as tres tags available do seed tem PINs DE DESENVOLVIMENTO fixos (decisao de 2026-11-22; codigos sinteticos
-- do lote-900, so em banco local ou de CI, nunca em producao); as outras tres recebem um PIN aleatorio, descartado.

BEGIN;

SELECT plan(20);

SELECT is((SELECT count(*)::integer FROM public.tag_codes), 6, 'seed: select count(*) from tag_codes devolve 6');
SELECT is((SELECT quantity FROM public.tag_batches WHERE id = 'lote-900'), 6, 'seed: o lote de teste lote-900 declara 6 codigos');
SELECT is((SELECT count(*)::integer FROM public.tag_codes WHERE batch_id = 'lote-900'), 6, 'seed: os 6 codigos sao do lote-900');
SELECT is((SELECT string_agg(status || ':' || n, ',' ORDER BY status) FROM (SELECT status, count(*) AS n FROM public.tag_codes GROUP BY status) s),
  'assigned:1,available:3,blocked:1,void:1', 'seed: 1 vinculado, 3 disponiveis, 1 bloqueado e 1 anulado');
SELECT is((SELECT count(*)::integer FROM public.tag_codes WHERE NOT public.tag_is_valid(code::text)), 0, 'seed: todos os codigos passam em tag_is_valid');
SELECT is((SELECT count(*)::integer FROM public.tag_codes WHERE activation_pin_hash !~ '^\$2[abxy]\$12\$'), 0, 'seed: todo hash de PIN e bcrypt de custo 12');
-- PINs de desenvolvimento de e2e/fixtures/seed-codes.json (campo devPins): conferem com o hash das tres tags available.
SELECT is((SELECT extensions.crypt('N6Y9GC', activation_pin_hash) = activation_pin_hash FROM public.tag_codes WHERE code = '5P8NMRXYW'), true, 'seed: o PIN de desenvolvimento de available confere com o hash');
SELECT is((SELECT extensions.crypt('JH6V9Y', activation_pin_hash) = activation_pin_hash FROM public.tag_codes WHERE code = 'N473QHBHE'), true, 'seed: o PIN de desenvolvimento de available2 confere com o hash');
SELECT is((SELECT extensions.crypt('42HD9Q', activation_pin_hash) = activation_pin_hash FROM public.tag_codes WHERE code = '7C6G5NHR8'), true, 'seed: o PIN de desenvolvimento de available3 confere com o hash');

SELECT is((SELECT status FROM public.tag_codes WHERE code = '7K3MQ9XAC'), 'assigned', 'seed: 7K3M-Q9XA-C (vetor sintetico) e o codigo do Paçoca e esta assigned');
SELECT is((SELECT p.name || '/' || a.tutor_id::text FROM public.tag_assignments a JOIN public.pets p ON p.id = a.pet_id
            WHERE a.tag_code = '7K3MQ9XAC' AND a.ended_at IS NULL),
  'Paçoca/00000000-0000-0000-0000-000000000001', 'seed: o vinculo ativo de 7K3M-Q9XA-C e do Paçoca, do tutor A (Ana)');
SELECT is((SELECT started_at FROM public.tag_assignments WHERE tag_code = '7K3MQ9XAC'), '2026-11-02 14:00:00-03'::timestamptz, 'seed: tag ativa desde 02 nov');
SELECT is((SELECT count(*)::integer FROM public.pets WHERE tutor_id = '00000000-0000-0000-0000-000000000001'), 2, 'seed: a Ana (tutor A) tem 2 pets, Paçoca e Mel');
SELECT is((SELECT count(*)::integer FROM public.tag_assignments a JOIN public.pets p ON p.id = a.pet_id WHERE p.name = 'Mel'), 0, 'seed: a Mel nao tem tag');
SELECT is((SELECT count(*)::integer FROM public.pets WHERE tutor_id = '00000000-0000-0000-0000-000000000002')
        + (SELECT count(*)::integer FROM public.tag_assignments WHERE tutor_id = '00000000-0000-0000-0000-000000000002'), 0,
  'seed: o tutor B nao ganha pet nem tag');

SELECT is((SELECT show_tutor_first_name::text || show_whatsapp::text || show_phone::text || lost_mode::text FROM public.rescue_profiles rp JOIN public.pets p ON p.id = rp.pet_id WHERE p.name = 'Paçoca'),
  'truetruefalsefalse', 'seed: Paçoca mostra o primeiro nome e o WhatsApp, sem telefone e fora do modo perdido');

SELECT is((SELECT string_agg(geo_method, ',' ORDER BY geo_method) FROM public.scan_events WHERE assignment_id = '00000000-0000-0000-0000-0000000b0001'),
  'gps,ip,none', 'seed: 3 scans do Paçoca (GPS, aproximado por IP e sem localizacao)');
SELECT is((SELECT count(*)::integer FROM public.scan_events WHERE geo_method = 'none' AND (lat IS NOT NULL OR city IS NOT NULL)), 0, 'seed: scan sem localizacao nao tem coordenada nem cidade');
SELECT is((SELECT count(*)::integer FROM public.scan_events WHERE ip_hash ~ '^[0-9.:a-f]+$' AND ip_hash ~ '[.:]'), 0, 'seed: nenhum IP cru em ip_hash');
SELECT is((SELECT count(*)::integer FROM public.scan_events), 3, 'seed: so os 3 scans do Paçoca');

SELECT * FROM finish();
ROLLBACK;
