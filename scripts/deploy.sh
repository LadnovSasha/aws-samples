#!/bin/bash

set -e


id
apt-get update
apt-get install -y jq python-pip > /dev/null
pip install awscli


npm_pull_url="https://nexus.goodyear.eu/repository/gy-npm/"
npmrc="${bamboo_build_working_directory}/.npmrc"

source "${bamboo_build_working_directory}/scripts/common.sh"

get_app_info


set_npm_config \
        -u "${npm_pull_url}" \
        -t "${bamboo_nexus_npm_secret_token}" \
        -p "${npmrc}"


npm install download-npm-package
node_modules/.bin/download-npm-package "${app_name}@${app_version}"


npmrc="${bamboo_build_working_directory}/${app_name}/.npmrc"


set_npm_config \
        -u "${npm_pull_url}" \
        -t "${bamboo_nexus_npm_secret_token}" \
        -p "${npmrc}"


cd ${app_name}
npm install
rm -f "${npmrc}"

ls -la

migrations="${bamboo_build_working_directory}/migrations"

if [ -d "${migrations}" ]; then
        echo "### Migrations section"
        ls -la "${migrations}"
        chmod 644 $(find "${migrations}" -type f)
        ls -la "${migrations}"

fi


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


deploytime=$(date +%s)


node_modules/.bin/serverless deploy \
                    --stage ${deploy_env} \
                    --salt=${serverless_salt} \
                    --vpcSecurityGroup="${vpcsecuritygroup}" \
                    --vpcSubnet="${vpcsubnet}" \
                    --pg-user="${pg_user}" \
                    --pg-password="${pg_password}" \
                    --commitHash="${bamboo_repository_revision_number}" \
                    --deployTime="${deploytime}" \
                    --version="${app_version}" \
                    --force


aws --version
aws configure set aws_access_key_id "ID"
aws configure set aws_secret_access_key "KEY"
aws configure set default.region "REGION"
aws configure list


touch  "${result_file}"