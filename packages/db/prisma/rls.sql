-- Optional defense-in-depth RLS policy layer for tenant isolation.
-- Run manually after migrations in PostgreSQL.

ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExtractionJob" ENABLE ROW LEVEL SECURITY;

CREATE POLICY transaction_tenant_isolation ON "Transaction"
USING ("organizationId" = current_setting('app.current_organization_id', true));

CREATE POLICY extraction_job_tenant_isolation ON "ExtractionJob"
USING ("organizationId" = current_setting('app.current_organization_id', true));
