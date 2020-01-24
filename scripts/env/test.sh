#!/bin/bash

set -e

access_key_id="${bamboo_aws_gaas_access_key_id}"
secret_access_key="${bamboo_aws_gaas_secret_access_key}"
aws_region="${bamboo_aws_default_region}"

pg_user="${bamboo_fitment_lambda_test_pg_user}"
pg_password="${bamboo_fitment_lambda_test_pg_password}"

serverless_salt="${bamboo_fitment_lambda_test_salt}"
vpcsecuritygroup="${bamboo_fitment_lambda_test_vpcsecuritygroup}"
vpcsubnet="${bamboo_fitment_lambda_test_vpcsubnet}"

nautilusbrowserapikey="${bamboo_fitment_lambda_test_nautilusbrowserapikey}"
b2capikey="${bamboo_fitment_lambda_test_b2capikey}"
