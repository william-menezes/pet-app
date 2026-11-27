-- Migration: 0032_storage_pet_photos.sql
-- Spec 003-tag-qr, T028 (data-model.md "Bucket pet-photos"; contracts/rls-expectations.md linha `storage`).
-- Bucket PRIVADO das fotos dos pets. Caminho: `<tutor_id>/<pet_id>/<arquivo>`. O tutor so le e grava dentro da propria
-- pasta (`<auth.uid()>/`); `anon` nao tem politica nenhuma; o admin tambem nao le fotos por aqui (a pagina publica
-- recebe URL assinada gerada pela Edge Function `resolve-tag` com a role de servico, que ignora a RLS).
-- O limite de 5 MB e os tipos permitidos (image/jpeg, image/png, image/webp) entram com o endurecimento
-- (`0035_endurecimento_tags.sql`, contracts/security-hardening.contract.md secao 4), nao aqui.

INSERT INTO storage.buckets (id, name, public)
VALUES ('pet-photos', 'pet-photos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Primeiro segmento do caminho = id do tutor autenticado. `storage.foldername(name)` devolve os segmentos de pasta.
CREATE POLICY pet_photos_tutor_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'pet-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY pet_photos_tutor_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pet-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY pet_photos_tutor_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'pet-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'pet-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY pet_photos_tutor_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'pet-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
