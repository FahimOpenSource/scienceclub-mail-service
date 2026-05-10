insert into public.classes (name)
values
  ('1'),
  ('2'),
  ('3'),
  ('4'),
  ('5'),
  ('6')
on conflict (name) do nothing;

insert into public.streams (name)
values
  ('A'),
  ('B'),
  ('C'),
  ('D'),
  ('E'),
  ('p'),
  ('b'),
  ('c'),
  ('e'),
  ('r'),
  ('d')
on conflict (name) do nothing;

insert into public.class_streams (class_id, stream_id)
select classes.id, streams.id
from public.classes
join public.streams
  on streams.name in ('A', 'B', 'C', 'D', 'E')
where classes.name in ('1', '2', '3', '4')
on conflict (class_id, stream_id) do nothing;

insert into public.class_streams (class_id, stream_id)
select classes.id, streams.id
from public.classes
join public.streams
  on streams.name in ('p', 'b', 'c', 'e', 'r', 'd')
where classes.name in ('5', '6')
on conflict (class_id, stream_id) do nothing;
