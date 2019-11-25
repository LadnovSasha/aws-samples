#!/bin/bash

set -e

access_key_id="${bamboo_aws_gaas_staging_access_key_id}"
secret_access_key="${bamboo_aws_gaas_staging_secret_access_key}"
aws_region="${bamboo_aws_default_region}"

pg_user="${bamboo_fitment_lambda_staging_pg_user}"
pg_password="${bamboo_fitment_lambda_staging_pg_password}"

serverless_salt="${bamboo_fitment_lambda_staging_salt}"
vpcsecuritygroup="${bamboo_fitment_lambda_staging_vpcsecuritygroup}"
dbsubnetgroup="${bamboo_fitment_lambda_staging_dbsubnetgroup}"
vpcsubnet="${bamboo_fitment_lambda_staging_vpcsubnet}"

nautilusbrowserapikey="${bamboo_fitment_lambda_staging_nautilusbrowserapikey}"
