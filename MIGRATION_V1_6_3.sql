-- Fit4Us V1.6.3 Migration
-- Keine Nutzerdaten werden gelöscht.
update public.challenge_pool
set description='Sag heute mindestens einer Person konkret, welche Leistung oder welchen Einsatz du an ihr anerkennst.'
where challenge_type='daily' and name='Anerkennung';
