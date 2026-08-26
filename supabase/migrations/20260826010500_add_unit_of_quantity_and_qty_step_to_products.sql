-- Bring products in line with the documented ERD: each product declares the
-- unit its quantity is counted in and the step size stakes must be multiples of.
ALTER TABLE products
  ADD COLUMN unit_of_quantity TEXT NOT NULL,
  ADD COLUMN qty_step NUMERIC NOT NULL CHECK (qty_step > 0);
