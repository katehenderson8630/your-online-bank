#!/usr/bin/env bash
# One-shot deploy script for Lyncrest Bank edge functions to your Supabase project.
#
# Prerequisites (one-time):
#   1. Install the Supabase CLI:  https://supabase.com/docs/guides/cli
#      macOS:   brew install supabase/tap/supabase
#      Linux:   npm i -g supabase   (or use the install script from the docs)
#      Windows: scoop install supabase
#   2. Get an access token: https://supabase.com/dashboard/account/tokens
#   3. Get your Resend API key: https://resend.com/api-keys
#
# Usage:
#   export SUPABASE_ACCESS_TOKEN=sbp_xxx
#   export RESEND_API_KEY=re_xxx
#   bash deploy.sh
#
set -euo pipefail

PROJECT_REF="octvuctmhszbtyhixxwd"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "ERROR: export SUPABASE_ACCESS_TOKEN=sbp_xxx  (get one at https://supabase.com/dashboard/account/tokens)"
  exit 1
fi
if [ -z "${RESEND_API_KEY:-}" ]; then
  echo "ERROR: export RESEND_API_KEY=re_xxx  (get one at https://resend.com/api-keys)"
  exit 1
fi
if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "ERROR: export SUPABASE_SERVICE_ROLE_KEY with your project's service role key"
  exit 1
fi

echo "==> Linking to project $PROJECT_REF"
supabase link --project-ref "$PROJECT_REF"

echo "==> Setting function secrets"
supabase secrets set \
  RESEND_API_KEY="$RESEND_API_KEY" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  --project-ref "$PROJECT_REF"

echo "==> Deploying public (no-JWT) functions"
supabase functions deploy request-password-reset --no-verify-jwt --project-ref "$PROJECT_REF"

echo "==> Deploying authenticated functions"
supabase functions deploy send-transactional-email --project-ref "$PROJECT_REF"
supabase functions deploy internal-transfer        --project-ref "$PROJECT_REF"
supabase functions deploy admin-action             --project-ref "$PROJECT_REF"

echo ""
echo "All active edge functions deployed to https://$PROJECT_REF.supabase.co"
echo "Verify at: https://supabase.com/dashboard/project/$PROJECT_REF/functions"
