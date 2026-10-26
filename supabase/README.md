# Backend setup

1. Create a Supabase project and copy its project ref, URL, and public anon key.
2. Run `npx supabase link --project-ref <ref>` and `npx supabase db push`.
3. Run `npm run sync:shared` and `npm run check:functions`.
4. Set `npx supabase secrets set SWEEP_SECRET=<random-secret>`. Optionally set `ALLOWED_ORIGIN=https://your-domain`.
5. Run `npx supabase functions deploy leetcode` and `npx supabase functions deploy sweep`.
6. In the SQL editor, create the two Vault secrets:
   ```sql
   select vault.create_secret('https://<ref>.supabase.co/functions/v1/sweep', 'sweep_url');
   select vault.create_secret('<same-random-secret>', 'sweep_secret');
   ```
7. Set Auth Site URL to your public origin and add its URLs to the redirect allowlist. Add `http://localhost:5173` for development.
8. Configure custom SMTP in Auth settings, for example with Resend.
9. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_SITE_URL` in Vercel, then deploy.
10. Add your domain in Vercel and update the Auth URLs and optional `ALLOWED_ORIGIN`.

The hourly job reads Vault. The private `proofs` bucket and its policies are created by migrations. Verification and settlement run in Edge Functions; the browser cannot write verified solves or markers. Payments affect balances only after the recipient confirms.

Antes are server-written only: migration `0009_server_only_antes.sql` removes client inserts, and the `leetcode` function attaches photos and captions to the caller's verified ante.

Discord webhooks are optional and configured in the profile sheet. Notification claims prevent duplicate posts during concurrent runs. A crash after claiming a notification can lose that message; check function logs for failed webhook requests.
