#!/usr/bin/env bash
#
# Provisions the disposable MySQL test database used by the
# credit-checks library integration tests (see
# src/lib/application/credit-checks.service.integration.spec.ts).
#
# This script is idempotent and non-destructive: it creates the
# test database if it is missing, grants the application
# database user access to it, and applies pending migrations
# with `prisma migrate deploy` (forward-only, no resets).
#
# It requires the MySQL root account from docker-compose.yml
# and the local docker container named `loan-portal-mysql`.
#
# Usage:
#   libs/api/credit-checks/prisma/setup-test-database.sh
#
# Then run the integration tests with:
#   CREDIT_CHECKS_TEST_DATABASE_URL="mysql://loan_user:loan_password@localhost:3306/loan_portal_credit_checks_test?schema=public" \
#     nx test credit-checks

set -euo pipefail

TEST_DB="loan_portal_credit_checks_test"
TEST_DB_URL="mysql://loan_user:loan_password@localhost:3306/${TEST_DB}?schema=public"
MYSQL_CONTAINER="loan-portal-mysql"
MYSQL_ROOT_PASSWORD="root_password"

echo "==> Creating disposable test database '${TEST_DB}' (if missing) and granting access"
docker exec "${MYSQL_CONTAINER}" mysql -u root -p"${MYSQL_ROOT_PASSWORD}" \
  -e "CREATE DATABASE IF NOT EXISTS \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
      GRANT ALL PRIVILEGES ON \`${TEST_DB}\`.* TO 'loan_user'@'%';
      FLUSH PRIVILEGES;"

echo "==> Applying pending migrations to '${TEST_DB}'"
cd "$(dirname "$0")/../../database"
DATABASE_URL="${TEST_DB_URL}" \
  pnpm exec prisma migrate deploy --config prisma/config.ts --schema=prisma/schema.prisma

echo "==> Test database ready: ${TEST_DB_URL}"
