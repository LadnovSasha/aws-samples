#!/bin/bash

set -e

source "${bamboo_build_working_directory}/scripts/common.sh"

npm_pull_url="https://nexus.goodyear.eu/repository/gy-npm/"
npm_push_url="https://nexus.goodyear.eu/repository/gaas-npm/"

npmrc="${bamboo_build_working_directory}/.npmrc"


set_npm_config \
        -u "${npm_pull_url}" \
        -t "${bamboo_nexus_npm_secret_token}" \
        -p "${npmrc}"


npm install
npm run lint
npm run test

rm -f "${npmrc}"


if [ "${bamboo_planRepository_branchName}" = "master" ]; then

    set_npm_config \
            -u "${npm_push_url}" \
            -t "${bamboo_nexus_npm_secret_token}" \
            -p "${npmrc}"

    npm publish --loglevel silly

    rm -f "${npmrc}"

fi


touch  "${result_file}"