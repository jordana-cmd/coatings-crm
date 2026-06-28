-- 00057_contacts_last_contacted_at.sql
-- Add stored last_contacted_at to contacts, replacing live derivation.
-- Backfill from activities + contact_notes, then keep current via triggers.

-- 1. Add column + index
ALTER TABLE contacts ADD COLUMN last_contacted_at timestamptz;
CREATE INDEX idx_contacts_last_contacted ON contacts (last_contacted_at) WHERE last_contacted_at IS NOT NULL;

-- 2. Backfill from existing history
UPDATE contacts SET last_contacted_at = sub.latest
FROM (
  SELECT ct.id AS contact_id, GREATEST(
    (SELECT MAX(a.logged_at) FROM activities a WHERE a.contact_id = ct.id),
    (SELECT MAX(cn.created_at) FROM contact_notes cn WHERE cn.contact_id = ct.id)
  ) AS latest
  FROM contacts ct
) sub
WHERE contacts.id = sub.contact_id AND sub.latest IS NOT NULL;

-- 3. Trigger: update last_contacted_at when an activity is inserted with a contact_id
CREATE OR REPLACE FUNCTION trg_activity_touch_contact()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL THEN
    UPDATE contacts
       SET last_contacted_at = GREATEST(last_contacted_at, NEW.logged_at)
     WHERE id = NEW.contact_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER activity_touch_contact
  AFTER INSERT ON activities
  FOR EACH ROW
  EXECUTE FUNCTION trg_activity_touch_contact();

-- 4. Trigger: update last_contacted_at when a contact_note is inserted
CREATE OR REPLACE FUNCTION trg_contact_note_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE contacts
     SET last_contacted_at = GREATEST(last_contacted_at, NEW.created_at)
   WHERE id = NEW.contact_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER contact_note_touch
  AFTER INSERT ON contact_notes
  FOR EACH ROW
  EXECUTE FUNCTION trg_contact_note_touch();
