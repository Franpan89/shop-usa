import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Privileged client using the service role key — bypasses RLS entirely and
// can manage auth users (invite/create). Never import this from client code.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
