insert into public.classes (name)
values
  ('1'),
  ('2'),
  ('3'),
  ('4'),
  ('5'),
  ('6')
on conflict (name) do nothing;

insert into public.streams (class_id, name)
select classes.id, streams.name
from public.classes
cross join (
  values
    ('A'),
    ('B'),
    ('C'),
    ('D'),
    ('E')
) as streams(name)
where classes.name in ('1', '2', '3', '4')
on conflict (class_id, name) do nothing;

insert into public.streams (class_id, name)
select classes.id, streams.name
from public.classes
cross join (
  values
    ('p'),
    ('b'),
    ('c'),
    ('e'),
    ('r'),
    ('d')
) as streams(name)
where classes.name in ('5', '6')
on conflict (class_id, name) do nothing;
