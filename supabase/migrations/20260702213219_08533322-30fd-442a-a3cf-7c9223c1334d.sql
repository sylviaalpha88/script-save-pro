-- Allow pharmacy staff (same pharmacy) and directors to create buyer orders
-- and buyer order items on behalf of buyers. Existing buyer-side INSERT
-- policies remain unchanged.

CREATE POLICY "staff inserts buyer orders"
ON public.buyer_orders
FOR INSERT
TO authenticated
WITH CHECK (pharmacy_id = current_pharmacy_id() OR is_director(auth.uid()));

CREATE POLICY "staff inserts buyer order items"
ON public.buyer_order_items
FOR INSERT
TO authenticated
WITH CHECK (pharmacy_id = current_pharmacy_id() OR is_director(auth.uid()));