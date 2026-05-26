-- Phase 3: seed the standard exercise library. Seeded rows have created_by = null
-- and is_custom = false, so they're readable by everyone (per the exercises RLS).
-- Idempotent: re-running won't duplicate (unique index on lower(name) where seeded).

insert into exercises (name, muscle_group, is_custom, created_by) values
  -- Chest
  ('Barbell Bench Press',        'chest',     false, null),
  ('Incline Barbell Bench Press','chest',     false, null),
  ('Dumbbell Bench Press',       'chest',     false, null),
  ('Incline Dumbbell Press',     'chest',     false, null),
  ('Chest Fly',                  'chest',     false, null),
  ('Cable Crossover',            'chest',     false, null),
  ('Push-Up',                    'chest',     false, null),
  ('Chest Dip',                  'chest',     false, null),
  -- Back
  ('Deadlift',                   'back',      false, null),
  ('Pull-Up',                    'back',      false, null),
  ('Chin-Up',                    'back',      false, null),
  ('Lat Pulldown',               'back',      false, null),
  ('Bent-Over Barbell Row',      'back',      false, null),
  ('Seated Cable Row',           'back',      false, null),
  ('T-Bar Row',                  'back',      false, null),
  ('Single-Arm Dumbbell Row',    'back',      false, null),
  ('Face Pull',                  'back',      false, null),
  -- Shoulders
  ('Overhead Press',             'shoulders', false, null),
  ('Dumbbell Shoulder Press',    'shoulders', false, null),
  ('Arnold Press',               'shoulders', false, null),
  ('Lateral Raise',              'shoulders', false, null),
  ('Front Raise',                'shoulders', false, null),
  ('Rear Delt Fly',              'shoulders', false, null),
  ('Upright Row',                'shoulders', false, null),
  -- Arms
  ('Barbell Curl',               'arms',      false, null),
  ('Dumbbell Curl',              'arms',      false, null),
  ('Hammer Curl',                'arms',      false, null),
  ('Preacher Curl',              'arms',      false, null),
  ('Tricep Pushdown',            'arms',      false, null),
  ('Skull Crusher',              'arms',      false, null),
  ('Overhead Tricep Extension',  'arms',      false, null),
  ('Close-Grip Bench Press',     'arms',      false, null),
  -- Legs
  ('Back Squat',                 'legs',      false, null),
  ('Front Squat',                'legs',      false, null),
  ('Leg Press',                  'legs',      false, null),
  ('Romanian Deadlift',          'legs',      false, null),
  ('Walking Lunge',              'legs',      false, null),
  ('Bulgarian Split Squat',      'legs',      false, null),
  ('Leg Extension',              'legs',      false, null),
  ('Leg Curl',                   'legs',      false, null),
  ('Hip Thrust',                 'legs',      false, null),
  ('Standing Calf Raise',        'legs',      false, null),
  -- Core
  ('Plank',                      'core',      false, null),
  ('Crunch',                     'core',      false, null),
  ('Hanging Leg Raise',          'core',      false, null),
  ('Russian Twist',              'core',      false, null),
  ('Cable Crunch',               'core',      false, null),
  ('Ab Wheel Rollout',           'core',      false, null),
  -- Cardio
  ('Running',                    'cardio',    false, null),
  ('Cycling',                    'cardio',    false, null),
  ('Rowing Machine',             'cardio',    false, null),
  ('Jump Rope',                  'cardio',    false, null),
  ('Elliptical',                 'cardio',    false, null),
  -- Full body / olympic
  ('Clean and Jerk',             'full_body', false, null),
  ('Power Clean',                'full_body', false, null),
  ('Snatch',                     'full_body', false, null),
  ('Kettlebell Swing',           'full_body', false, null),
  ('Burpee',                     'full_body', false, null)
on conflict do nothing;
