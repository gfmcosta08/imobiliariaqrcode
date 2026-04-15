-- Seed opcional após migrations.
select 1;

-- Exemplo (comentado): criar parceiro e vincular a um usuário existente.
-- insert into public.partners (name, code) values ('Parceiro Demo', 'demo-partner');
-- insert into public.partner_users (partner_id, profile_id)
-- select p.id, pr.id from public.partners p, public.profiles pr
-- where p.code = 'demo-partner' and pr.email = 'seu-email@exemplo.com';
