-- pgTAP: tag_code.test.sql
-- Spec 003-tag-qr, T021 (contracts/tag-code.contract.md; research.md secao 2). Funcoes tag_normalize, tag_check_digit,
-- tag_is_valid e tag_format (migration 0021) contra a MESMA tabela de casos do TypeScript: os vetores sinteticos de
-- contracts/tag-code.vectors.json (copiados para o bloco abaixo; um teste do app confere que o bloco e o JSON
-- dizem a mesma coisa) e a tabela de casos obrigatorios do contrato. Nenhum codigo real do lote-001 aparece aqui.

BEGIN;

SELECT plan(45);

-- >>> vetores (gerado de contracts/tag-code.vectors.json; o teste tag-code.sql-sync.spec.ts compara; nao edite a mao)
CREATE TEMP TABLE v_valid (body text, check_digit text, code text, display text);
INSERT INTO v_valid VALUES
  ('7K3MQ9XA', 'C', '7K3MQ9XAC', '7K3M-Q9XA-C'),
  ('00000000', '0', '000000000', '0000-0000-0'),
  ('ZZZZZZZZ', '8', 'ZZZZZZZZ8', 'ZZZZ-ZZZZ-8'),
  ('0123456Z', '3', '0123456Z3', '0123-456Z-3'),
  ('ABCDEFGH', 'V', 'ABCDEFGHV', 'ABCD-EFGH-V'),
  ('JKMNPQRS', 'R', 'JKMNPQRSR', 'JKMN-PQRS-R'),
  ('TVWXYZ01', 'S', 'TVWXYZ01S', 'TVWX-YZ01-S'),
  ('10000000', 'Z', '10000000Z', '1000-0000-Z'),
  ('00000001', 'Y', '00000001Y', '0000-0001-Y'),
  ('1NDAN8EK', 'S', '1NDAN8EKS', '1NDA-N8EK-S'),
  ('W030F52J', '1', 'W030F52J1', 'W030-F52J-1'),
  ('BZCH5NVX', '1', 'BZCH5NVX1', 'BZCH-5NVX-1'),
  ('T6EVBXPY', 'W', 'T6EVBXPYW', 'T6EV-BXPY-W'),
  ('TJ279DDB', 'B', 'TJ279DDBB', 'TJ27-9DDB-B'),
  ('00440X4N', 'A', '00440X4NA', '0044-0X4N-A'),
  ('4N9YD7M5', 'J', '4N9YD7M5J', '4N9Y-D7M5-J'),
  ('NSYTHTDN', '7', 'NSYTHTDN7', 'NSYT-HTDN-7'),
  ('3DETGDAV', 'N', '3DETGDAVN', '3DET-GDAV-N'),
  ('TG8XG3K7', 'B', 'TG8XG3K7B', 'TG8X-G3K7-B'),
  ('PDVJW084', '4', 'PDVJW0844', 'PDVJ-W084-4'),
  ('SYAZFWH8', 'R', 'SYAZFWH8R', 'SYAZ-FWH8-R'),
  ('WAXPZGSW', 'M', 'WAXPZGSWM', 'WAXP-ZGSW-M'),
  ('H8ZWE5XG', 'H', 'H8ZWE5XGH', 'H8ZW-E5XG-H'),
  ('5909VKAR', 'T', '5909VKART', '5909-VKAR-T'),
  ('G59WE8K9', '1', 'G59WE8K91', 'G59W-E8K9-1'),
  ('ZXDJ8EEC', 'A', 'ZXDJ8EECA', 'ZXDJ-8EEC-A'),
  ('J1PHHBMY', 'V', 'J1PHHBMYV', 'J1PH-HBMY-V'),
  ('RVZB508F', 'H', 'RVZB508FH', 'RVZB-508F-H'),
  ('BBJQ3MQY', 'Y', 'BBJQ3MQYY', 'BBJQ-3MQY-Y'),
  ('P541YVDT', '3', 'P541YVDT3', 'P541-YVDT-3'),
  ('9EFXB5G3', '6', '9EFXB5G36', '9EFX-B5G3-6'),
  ('Q5Q1WDCX', '9', 'Q5Q1WDCX9', 'Q5Q1-WDCX-9'),
  ('1NG9QRHK', 'J', '1NG9QRHKJ', '1NG9-QRHK-J'),
  ('W5197ST9', '1', 'W5197ST91', 'W519-7ST9-1'),
  ('T7PTPHN7', 'H', 'T7PTPHN7H', 'T7PT-PHN7-H'),
  ('SFRPR9VM', 'P', 'SFRPR9VMP', 'SFRP-R9VM-P'),
  ('Q3G5V2V2', 'B', 'Q3G5V2V2B', 'Q3G5-V2V2-B'),
  ('J68PF6SD', 'Z', 'J68PF6SDZ', 'J68P-F6SD-Z'),
  ('MMXYWWPF', '0', 'MMXYWWPF0', 'MMXY-WWPF-0'),
  ('7YKK0A7F', '9', '7YKK0A7F9', '7YKK-0A7F-9'),
  ('EC2F1A3X', '7', 'EC2F1A3X7', 'EC2F-1A3X-7'),
  ('BTYQNYV2', '2', 'BTYQNYV22', 'BTYQ-NYV2-2'),
  ('3G9ADGR9', '7', '3G9ADGR97', '3G9A-DGR9-7'),
  ('SAD941QF', 'S', 'SAD941QFS', 'SAD9-41QF-S'),
  ('SZVJ6AFH', 'W', 'SZVJ6AFHW', 'SZVJ-6AFH-W'),
  ('YJFK0KDR', '2', 'YJFK0KDR2', 'YJFK-0KDR-2'),
  ('8TWC3YSM', 'D', '8TWC3YSMD', '8TWC-3YSM-D'),
  ('C9R3AS71', 'Y', 'C9R3AS71Y', 'C9R3-AS71-Y');
CREATE TEMP TABLE v_invalid (code text);
INSERT INTO v_invalid VALUES
  ('7K3MQ9XAD'),
  ('8K3MQ9XAC'),
  ('7K3MR9XAC'),
  ('000000001'),
  ('100000000'),
  ('000010000'),
  ('ZZZZZZZZ9'),
  ('0ZZZZZZZ8'),
  ('ZZZZ0ZZZ8'),
  ('0123456Z4'),
  ('1123456Z3'),
  ('0123556Z3'),
  ('ABCDEFGHW'),
  ('BBCDEFGHV'),
  ('ABCDFFGHV'),
  ('JKMNPQRSS'),
  ('KKMNPQRSR'),
  ('JKMNQQRSR'),
  ('TVWXYZ01T'),
  ('VVWXYZ01S'),
  ('TVWXZZ01S'),
  ('100000000'),
  ('20000000Z'),
  ('10001000Z'),
  ('00000001Z'),
  ('10000001Y'),
  ('00001001Y'),
  ('1NDAN8EKT'),
  ('2NDAN8EKS'),
  ('1NDAP8EKS'),
  ('W030F52J2'),
  ('X030F52J1'),
  ('W030G52J1'),
  ('BZCH5NVX2'),
  ('CZCH5NVX1'),
  ('BZCH6NVX1'),
  ('7K3MQ9XA'),
  ('7K3MQ9XACX'),
  (''),
  ('U2345678X'),
  ('7K3MQ9X?C'),
  ('7K3MQ9XA-');
CREATE TEMP TABLE v_norm (entrada text, esperado text);
INSERT INTO v_norm VALUES
  ('7K3M-Q9XA-C', '7K3MQ9XAC'),
  ('7k3m q9xa c', '7K3MQ9XAC'),
  (' 7k3m-q9xa-c ', '7K3MQ9XAC'),
  ('OIL0-1111-?', '01101111?'),
  ('oOiIlL', '001111'),
  ('https', 'HTTPS'),
  ('', '');
-- <<< vetores

-- ── Os vetores sinteticos ───────────────────────────────────────────────
SELECT is((SELECT count(*)::integer FROM v_valid), 48, 'vetores: 48 codigos validos');
SELECT is((SELECT count(*)::integer FROM v_invalid), 42, 'vetores: 42 entradas invalidas');
SELECT is((SELECT count(*)::integer FROM v_norm), 7, 'vetores: 7 pares de normalize');

SELECT is_empty($$ SELECT body FROM v_valid WHERE public.tag_check_digit(body) IS DISTINCT FROM check_digit $$,
  'valid: tag_check_digit(body) devolve o digito de cada vetor');
SELECT is_empty($$ SELECT code FROM v_valid WHERE code <> body || check_digit $$, 'valid: code = body + digito');
SELECT is_empty($$ SELECT code FROM v_valid WHERE NOT public.tag_is_valid(code) $$, 'valid: tag_is_valid(code) e verdadeiro para todos');
SELECT is_empty($$ SELECT display FROM v_valid WHERE NOT public.tag_is_valid(display) $$, 'valid: a forma de exibicao tambem e valida');
SELECT is_empty($$ SELECT code FROM v_valid WHERE public.tag_format(code::character(9)) IS DISTINCT FROM display $$,
  'valid: tag_format(code) devolve a forma de exibicao');
SELECT is_empty($$ SELECT code FROM v_invalid WHERE public.tag_is_valid(code) $$, 'invalid: tag_is_valid e falso para todos');
SELECT is_empty($$ SELECT entrada FROM v_norm WHERE public.tag_normalize(entrada) IS DISTINCT FROM esperado $$,
  'normalize: cada par confere');

-- ── Tabela de casos do contrato (normalize e isValid) ───────────────────
SELECT is(public.tag_normalize('7K3M-Q9XA-C'), '7K3MQ9XAC', 'normalize 7K3M-Q9XA-C');
SELECT is(public.tag_normalize('7k3m q9xa c'), '7K3MQ9XAC', 'normalize 7k3m q9xa c');
SELECT is(public.tag_normalize('7K3M-Q9XA-D'), '7K3MQ9XAD', 'normalize com digito trocado');
SELECT is(public.tag_normalize('OIL0-1111-?'), '01101111?', 'normalize OIL0-1111-? (O vira 0, I e L viram 1)');
SELECT is(public.tag_normalize(''), '', 'normalize da cadeia vazia');
SELECT is(public.tag_is_valid('7K3M-Q9XA-C'), true, 'valido: 7K3M-Q9XA-C');
SELECT is(public.tag_is_valid('7k3m q9xa c'), true, 'valido: 7k3m q9xa c');
SELECT is(public.tag_is_valid('7K3M-Q9XA-D'), false, 'invalido: digito trocado');
SELECT is(public.tag_is_valid('OIL0-1111-?'), false, 'invalido: ? nao e do alfabeto');
SELECT is(public.tag_is_valid('7K3MQ9XA'), false, 'invalido: 8 caracteres');
SELECT is(public.tag_is_valid('7K3MQ9XACX'), false, 'invalido: 10 caracteres');
SELECT is(public.tag_is_valid(''), false, 'invalido: cadeia vazia');
SELECT is(public.tag_is_valid('U2345678X'), false, 'invalido: tem U');

-- ── NULL nunca e valido (numa CHECK, NULL passaria) ─────────────────────
SELECT is(public.tag_is_valid(NULL), false, 'tag_is_valid(NULL) e false, nao NULL');
SELECT is(public.tag_normalize(NULL), NULL::text, 'tag_normalize(NULL) e NULL');
SELECT is(public.tag_check_digit(NULL), NULL::text, 'tag_check_digit(NULL) e NULL');
SELECT is(public.tag_format(NULL::character(9)), NULL::text, 'tag_format(NULL) e NULL');

-- ── tag_check_digit e tag_format ────────────────────────────────────────
SELECT is(public.tag_check_digit('7K3MQ9XA'), 'C', 'o digito de 7K3MQ9XA e C');
SELECT is(public.tag_check_digit('7K3MQ9X'), NULL::text, 'corpo de 7 caracteres: NULL');
SELECT is(public.tag_check_digit('7K3MQ9XAC'), NULL::text, 'corpo de 9 caracteres: NULL');
SELECT is(public.tag_check_digit('7K3MQ9XU'), NULL::text, 'corpo com U: NULL');
SELECT is(public.tag_check_digit('7k3mq9xa'), NULL::text, 'corpo em minusculas (nao normalizado): NULL');
SELECT is(public.tag_format('7K3MQ9XAC'), '7K3M-Q9XA-C', 'tag_format de um codigo valido');
SELECT is(public.tag_format('7K3MQ9XAD'), NULL::text, 'tag_format de codigo invalido: NULL (o TypeScript lanca erro)');

-- ── Mesma regra do TypeScript: so ASCII ─────────────────────────────────
SELECT is(public.tag_normalize('ß'), 'ß', 'normalize nao faz dobra de caixa Unicode');
SELECT is(public.tag_is_valid('ZZZZZZZß'), false, 'ß nao vira SS: 8 caracteres, invalido');
SELECT is(public.tag_is_valid('7K3M' || chr(160) || 'Q9XAC'), false, 'espaco nao-ASCII (NBSP) nao e removido');
SELECT is(public.tag_normalize('7K3M' || chr(9) || '-Q9XA' || chr(10) || '-C' || chr(13)), '7K3MQ9XAC', 'tab, LF, CR e hifen saem');
SELECT is(public.tag_normalize('7K3M' || chr(11) || 'Q9XA' || chr(12) || 'C'), '7K3MQ9XAC', 'VT e FF saem');
SELECT is(public.tag_normalize('oOiIlL'), '001111', 'o, O, i, I, l, L');

-- ── Funcoes puras e imutaveis (podem ser usadas em CHECK) ───────────────
SELECT is((SELECT count(*)::integer FROM pg_proc WHERE oid IN (
            'public.tag_normalize(text)'::regprocedure, 'public.tag_check_digit(text)'::regprocedure,
            'public.tag_is_valid(text)'::regprocedure, 'public.tag_format(character)'::regprocedure)
              AND provolatile = 'i'), 4, 'as quatro funcoes sao IMMUTABLE');

-- ── Propriedade (equivalente SQL do teste de 10.000 corpos do TypeScript) ──
CREATE TEMP TABLE r_bodies (n integer PRIMARY KEY, body text NOT NULL);
DO $$
DECLARE
  c_alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_body text;
  i integer;
  j integer;
BEGIN
  FOR i IN 1..3000 LOOP
    v_body := '';
    FOR j IN 1..8 LOOP
      v_body := v_body || substr(c_alphabet, 1 + floor(random() * 32)::integer, 1);
    END LOOP;
    INSERT INTO r_bodies VALUES (i, v_body);
  END LOOP;
END;
$$;

SELECT is((SELECT count(*)::integer FROM r_bodies WHERE NOT public.tag_is_valid(body || public.tag_check_digit(body))), 0,
  'propriedade: corpo + tag_check_digit e sempre valido (3.000 corpos aleatorios)');

CREATE TEMP TABLE r_result (acceptances integer NOT NULL, tried integer NOT NULL);
DO $$
DECLARE
  c_alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_code text;
  v_changed text;
  v_acc integer := 0;
  v_tried integer := 0;
  r record;
  pos integer;
  k integer;
BEGIN
  FOR r IN SELECT body FROM r_bodies WHERE n <= 300 LOOP
    v_code := r.body || public.tag_check_digit(r.body);
    FOR pos IN 1..9 LOOP
      FOR k IN 1..32 LOOP
        IF substr(c_alphabet, k, 1) <> substr(v_code, pos, 1) THEN
          v_changed := overlay(v_code placing substr(c_alphabet, k, 1) from pos for 1);
          v_tried := v_tried + 1;
          IF public.tag_is_valid(v_changed) THEN v_acc := v_acc + 1; END IF;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  INSERT INTO r_result VALUES (v_acc, v_tried);
END;
$$;
SELECT is((SELECT tried FROM r_result), 300 * 9 * 31, 'propriedade: 300 codigos x 9 posicoes x 31 trocas foram testados');
SELECT is((SELECT acceptances FROM r_result), 0, 'propriedade: nenhuma troca de um caractere continua valida');

-- O digito gerado nunca fica fora do alfabeto.
SELECT is((SELECT count(*)::integer FROM r_bodies WHERE public.tag_check_digit(body) !~ '^[0-9A-HJKMNP-TV-Z]$'), 0,
  'o digito gerado e sempre um caractere do alfabeto');

SELECT * FROM finish();
ROLLBACK;
