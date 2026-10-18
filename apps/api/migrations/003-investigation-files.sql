CREATE TABLE investigation_files (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  public_id uuid NOT NULL UNIQUE,
  investigation_id bigint NOT NULL REFERENCES investigations(id),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 250),
  mime text NOT NULL CHECK (mime IN ('application/pdf','image/png','image/jpeg','image/gif','image/webp')),
  size integer NOT NULL CHECK (size BETWEEN 1 AND 10485760),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  content bytea NOT NULL CHECK (octet_length(content) = size),
  created_at timestamptz NOT NULL,
  UNIQUE (investigation_id, name, sha256)
);
