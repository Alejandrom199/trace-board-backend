ALTER TABLE investigations
  ADD COLUMN board_content jsonb,
  ADD COLUMN board_revision integer NOT NULL DEFAULT 0 CHECK (board_revision BETWEEN 0 AND 2147483646),
  ADD CONSTRAINT board_content_object CHECK (board_content IS NULL OR jsonb_typeof(board_content) = 'object');
