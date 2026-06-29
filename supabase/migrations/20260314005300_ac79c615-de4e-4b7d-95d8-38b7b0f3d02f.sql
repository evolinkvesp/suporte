create policy "No direct read access to clients"
on public.clients
for select
to anon, authenticated
using (false);

create policy "No direct insert access to clients"
on public.clients
for insert
to anon, authenticated
with check (false);

create policy "No direct update access to clients"
on public.clients
for update
to anon, authenticated
using (false)
with check (false);

create policy "No direct delete access to clients"
on public.clients
for delete
to anon, authenticated
using (false);