INSERT INTO assets (id, filename, storage_key, duration, fps, status)
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'sample_retakes.mp4', 'assets/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/source.mp4', 60.0, 30.0, 'READY')
ON CONFLICT (id) DO NOTHING;

INSERT INTO take_groups (id, asset_id, idx)
VALUES 
  ('g1', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 0),
  ('g2', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO segments (id, asset_id, idx, start_time, end_time, text, score, group_id)
VALUES 
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 0, 0.0, 5.0, 'Hello everyone, welcome back.', 0.92, 'g1'),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 1, 50.0, 55.0, 'Umm, hello everyone, wait let me redo.', 0.45, 'g1'),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 2, 5.0, 15.0, 'Today we explore AI video editing.', 0.95, 'g2')
ON CONFLICT (id) DO NOTHING;

UPDATE take_groups SET chosen_segment_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01' WHERE id = 'g1';
UPDATE take_groups SET chosen_segment_id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03' WHERE id = 'g2';

INSERT INTO transcripts (asset_id, words)
VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '[{"w": "Hello", "start": 0.0, "end": 0.5}, {"w": "everyone", "start": 0.5, "end": 1.0}, {"w": "um", "start": 1.1, "end": 1.4}, {"w": "welcome", "start": 1.5, "end": 2.0}]'::jsonb)
ON CONFLICT (asset_id) DO NOTHING;
