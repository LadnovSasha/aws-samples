#!/bin/bash

set -e


access_key_id="${bamboo_aws_gaas_access_key_id}"
secret_access_key="${bamboo_aws_gaas_secret_access_key}"
aws_region="${bamboo_aws_default_region}"
serverless_salt="${bamboo_fitment_lambda_test_salt}"
authorizerproviderarn="${bamboo_fitment_lambda_test_authorizerproviderarn}"
vpcsecuritygroup="${bamboo_fitment_lambda_test_vpcsecuritygroup}"
dbsubnetgroup="${bamboo_fitment_lambda_test_dbsubnetgroup}"
nautilusbrowserapikey="${bamboo_fitment_lambda_test_nautilusbrowserapikey}"
nautilusbookapikey="${bamboo_fitment_lambda_test_nautilusbookapikey}"
vpcsubnet="${bamboo_fitment_lambda_test_vpcsubnet}"