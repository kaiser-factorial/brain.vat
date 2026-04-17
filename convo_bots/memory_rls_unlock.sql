-- Enable read access for the public (anon) on memory_concepts (sidebar)
CREATE POLICY "Enable read access for all users" ON "public"."memory_concepts"
AS PERMISSIVE FOR SELECT
TO anon
USING (true);

-- Enable read access for the public (anon) on memory_archive (Venn Diagram)
CREATE POLICY "Enable read access for all users" ON "public"."memory_archive"
AS PERMISSIVE FOR SELECT
TO anon
USING (true);

-- Ensure RLS is enabled on these tables
ALTER TABLE "public"."memory_concepts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."memory_archive" ENABLE ROW LEVEL SECURITY;
