import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/** Fotos de productos: bucket público (rutas con UUID, sin información sensible). */
export const PRODUCT_BUCKET = 'product-photos';
/** Comprobantes de pago: bucket privado, se leen con URLs firmadas de corta duración. */
export const PROOF_BUCKET = 'payment-proofs';

const ensured = new Set<string>();

async function ensureBucket(name: string, isPublic: boolean) {
  if (ensured.has(name)) return;
  const admin = createAdminClient();
  const { error } = await admin.storage.createBucket(name, {
    public: isPublic,
    fileSizeLimit: 8 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  });
  // "already exists" no es un error para nosotros.
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(`No se pudo preparar el almacenamiento: ${error.message}`);
  }
  ensured.add(name);
}

export async function createUploadTarget(kind: 'product' | 'proof', ext: string) {
  const bucket = kind === 'product' ? PRODUCT_BUCKET : PROOF_BUCKET;
  await ensureBucket(bucket, kind === 'product');
  const safeExt = ext.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 5) || 'jpg';
  const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${safeExt}`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`No se pudo preparar la subida: ${error?.message ?? 'sin respuesta'}`);

  return {
    bucket,
    path,
    token: data.token,
    publicUrl: kind === 'product' ? admin.storage.from(bucket).getPublicUrl(path).data.publicUrl : null,
  };
}

/** URL temporal para ver un comprobante (1 hora). */
export async function signedProofUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const admin = createAdminClient();
  const { data } = await admin.storage.from(PROOF_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** Varios comprobantes de una vez (listados). */
export async function signedProofUrls(paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  const out = new Map<string, string>();
  if (unique.length === 0) return out;
  const admin = createAdminClient();
  const { data } = await admin.storage.from(PROOF_BUCKET).createSignedUrls(unique, 3600);
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  }
  return out;
}
