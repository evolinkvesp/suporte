create extension if not exists pgcrypto;

create type public.client_service_status as enum ('Ativo', 'Em Manutenção', 'Pausado');

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  nome_cliente_empresa text not null check (char_length(trim(nome_cliente_empresa)) between 1 and 140),
  site_url text,
  automacoes text not null default '',
  credenciais_encriptadas text not null,
  ultima_manutencao date,
  proxima_manutencao date not null,
  status_servico public.client_service_status not null default 'Ativo',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index clients_nome_idx on public.clients (nome_cliente_empresa);
create index clients_proxima_manutencao_idx on public.clients (proxima_manutencao);

alter table public.clients enable row level security;

create or replace function public.set_clients_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_clients_updated_at
before update on public.clients
for each row
execute function public.set_clients_updated_at();