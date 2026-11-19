# Public collection sharing

DevLens public collections are read-only snapshots. Publishing never makes a private collection row or account profile public.

## Publishing flow

1. The signed-in owner selects Share on a collection.
2. The client invokes the authenticated publish-collection Supabase Edge Function.
3. The function validates the caller's Supabase session and reads the collection through the caller's RLS-scoped client.
4. A server-side service-role client writes a sanitized snapshot. The service-role key stays inside the Edge Function runtime.
5. The function returns an opaque share slug. Re-publishing keeps the existing slug and refreshes the snapshot.

## Snapshot rules

- Only request name, method, URL, safe headers, and JSON request bodies are considered.
- Authorization, cookies, API keys, passwords, tokens, secrets, credentials, environment data, history, owner IDs, and account/profile fields are removed.
- Sensitive URL query values and URL user-info are redacted.
- Non-JSON request bodies are omitted.
- Request count is capped at 500.
- Public visitors read only the public_collections view. The view exposes slug, title, sanitized snapshot, and publication time.
- Anonymous and authenticated roles have column-level read access only. They cannot write snapshots.
- Unpublishing deletes the snapshot. The old link stops resolving.

## Important

A public collection is visible to anyone who has its link. Review the sanitized snapshot before sharing. Never publish private production credentials or private customer data.
