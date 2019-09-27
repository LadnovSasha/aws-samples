#!/bin/bash

set -e

serverless_salt="${bamboo_fitment_lambda_prod_salt}"
authorizerproviderarn="${bamboo_fitment_lambda_prod_authorizerproviderarn}"
vpcsecuritygroup="${bamboo_fitment_lambda_prod_vpcsecuritygroup}"
dbsubnetgroup="${bamboo_fitment_lambda_prod_dbsubnetgroup}"
nautilusbrowserapikey="${bamboo_fitment_lambda_prod_nautilusbrowserapikey}"
nautilusbookapikey="${bamboo_fitment_lambda_prod_nautilusbookapikey}"
vpcsubnet="${bamboo_fitment_lambda_prod_vpcsubnet}"