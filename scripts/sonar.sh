#!/bin/bash

set -e

apt-get update && apt-get install jq wget openjdk-8-jdk-headless -y


wget https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-3.3.0.1492.zip -q && \
    unzip sonar-scanner-cli-3.3.0.1492.zip -d /opt && chmod 777 /opt/sonar-scanner-3.3.0.1492/bin/sonar-scanner  && \
    ln -s /opt/sonar-scanner-3.3.0.1492/bin/sonar-scanner /usr/local/bin


source "${bamboo_build_working_directory}/scripts/common.sh"


npm_pull_url="https://nexus.goodyear.eu/repository/gy-npm/"


npmrc="${bamboo_build_working_directory}/.npmrc"


set_npm_config \
        -u "${npm_pull_url}" \
        -t "${bamboo_nexus_npm_secret_token}" \
        -p "${npmrc}"


npm install
npm run lint
npm run test

rm -f "${npmrc}"


get_app_info


sonar_scanner \
        -k "${app_name}" \
        -u "${bamboo_sonar_url}" \
        -t "${bamboo_sonar_secret_token}"