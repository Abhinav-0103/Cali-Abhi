-- Reverse lunge is a variation, not a harder step than split squat: give it its
-- own chain so the progression engine doesn't "level up" split squat → lunge.
-- Mirrors src/lib/exercises/library.ts.
update public.exercises set chain = 'lunge', chain_order = 1 where id = 'reverse_lunge';
-- Close the gap in the squat chain in two steps (avoids unique (chain, chain_order) clashes).
update public.exercises set chain_order = chain_order + 100 where chain = 'squat' and chain_order > 4;
update public.exercises set chain_order = chain_order - 101 where chain = 'squat' and chain_order > 100;
