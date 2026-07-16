-- 00065_add_federal_pipeline.sql
-- Adds FEDERAL as the 4th pipeline type.
-- Postgres forbids using a new enum value in the same transaction it was
-- added in, so the valid_stage_for_pipeline() update lives in a later
-- migration (00071) that runs after this one has committed.

ALTER TYPE pipeline_type ADD VALUE 'FEDERAL';
