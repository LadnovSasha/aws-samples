#!/bin/bash

set -e

npm_pull_url="https://nexus.goodyear.eu/repository/gy-npm/"

app_name=$(cat ./package.json | jq --raw-output '.name')
app_version=$(cat ./package.json | jq --raw-output '.version')
echo "Application name = ${app_name}"
echo "Application version = ${app_version}"


npmrc="${bamboo_build_working_directory}/.npmrc"
echo "### npmrc => ${npmrc}"


echo "NPM GENERATE CONFIG"
echo "registry=${npm_pull_url}" > "${npmrc}"
echo "_auth=${bamboo_nexus_npm_secret_token}" >> "${npmrc}"
echo "strict-ssl=true" >> "${npmrc}"
echo "always-auth=true" >> "${npmrc}"
echo "email=gy@intellias.com" >> "${npmrc}"
echo "unsafe-perm=true" >> "${npmrc}"
echo "NPM END"


npm install download-npm-package
node_modules/.bin/download-npm-package "${app_name}@${app_version}"
npm config list


npmrc="${bamboo_build_working_directory}/${app_name}/.npmrc"
echo "### npmrc => ${npmrc}"


echo "NPM GENERATE CONFIG"
echo "registry=${npm_pull_url}" > "${npmrc}"
echo "_auth=${bamboo_nexus_npm_secret_token}" >> "${npmrc}"
echo "strict-ssl=true" >> "${npmrc}"
echo "always-auth=true" >> "${npmrc}"
echo "email=gy@intellias.com" >> "${npmrc}"
echo "unsafe-perm=true" >> "${npmrc}"
echo "NPM END"


cd ${app_name}
npm install
rm -f "${npmrc}"


echo "### Bamboo Deployment Env -> ${bamboo_deploy_environment}"
rm -f "${npmrc}"


deploy_env=$(echo ${bamboo_deploy_environment} | tr '[:upper:]' '[:lower:]')
echo "### Env Source File -> ${deploy_env}"

echo "### "

source "${bamboo_build_working_directory}/scripts/env/${deploy_env}.sh"
echo "### Var TEST (vpcsubnet) -> ${vpcsubnet}"


aws --version
aws configure set aws_access_key_id ${access_key_id}
aws configure set aws_secret_access_key ${secret_access_key}
aws configure set default.region ${aws_region}
aws configure list
aws sts get-caller-identity



node_modules/.bin/serverless print \
                    --stage ${deploy_env} \
                    --salt=${serverless_salt} \
                    --authorizerProviderArn="${authorizerproviderarn}" \
                    --vpcSecurityGroup="${vpcsecuritygroup}" \
                    --dbSubnetGroup="${dbsubnetgroup}" \
                    --nautilusBrowserApiKey="${nautilusbrowserapikey}" \
                    --nautilusBookApiKey="${nautilusbookapikey}" \
                    --commitHash="${bamboo_repository_revision_number}" \
                    --deployTime="${functionStartTime}" \
                    --version="${app_version}" \
                    --vpcSubnet="${vpcsubnet}" \



aws --version
aws configure set aws_access_key_id "ID"
aws configure set aws_secret_access_key "KEY"
aws configure set default.region "REGION"
aws configure list


echo 1 > "${bamboo_build_working_directory}/result.txt"