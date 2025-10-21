-- Create client_intake_forms table
CREATE TABLE client_intake_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,

  -- Form fields from CSV
  medications TEXT,
  allergies TEXT,

  -- Pregnancy section
  is_pregnant BOOLEAN DEFAULT false,
  pregnancy_months INTEGER,
  pregnancy_due_date DATE,

  -- Medical supervision
  has_medical_supervision BOOLEAN DEFAULT false,
  medical_supervision_details TEXT,

  -- Medical conditions (array of selected conditions)
  medical_conditions JSONB DEFAULT '[]'::jsonb,

  -- Broken skin
  has_broken_skin BOOLEAN DEFAULT false,
  broken_skin_location TEXT,

  -- Joint replacement
  has_joint_replacement BOOLEAN DEFAULT false,
  joint_replacement_details TEXT,

  -- Additional info
  recent_injuries TEXT,
  other_conditions TEXT,

  -- Signature
  signature_data TEXT,

  -- Timestamps
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One form per booking
  CONSTRAINT unique_booking_intake_form UNIQUE(booking_id)
);

-- Index for quick lookups
CREATE INDEX idx_intake_forms_booking ON client_intake_forms(booking_id);
