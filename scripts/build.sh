#!/bin/bash

set -e

npm_pull_url="https://nexus.goodyear.eu/repository/gy-npm/"
npm_push_url="https://nexus.goodyear.eu/repository/gaas-npm/"


NPMRC="${bamboo_build_working_directory}/.npmrc"
echo "NPMRC => ${NPMRC}"

echo "NPM GENERATE START"
echo "registry=${npm_pull_url}" > "${NPMRC}"
echo "_auth=${bamboo_nexus_npm_secret_token}" >> "${NPMRC}"
echo "strict-ssl=true" >> "${NPMRC}"
echo "always-auth=true" >> "${NPMRC}"
echo "email=gy@intellias.com" >> "${NPMRC}"
echo "unsafe-perm=true" >> "${NPMRC}"
echo "NPM END"


npm config list
npm install
npm run lint
npm run test
rm -f "${NPMRC}"


echo "NPM GENERATE START"
echo "registry=${npm_push_url}" > "${NPMRC}"
echo "_auth=${bamboo_nexus_npm_secret_token}" >> "${NPMRC}"
echo "strict-ssl=true" >> "${NPMRC}"
echo "always-auth=true" >> "${NPMRC}"
echo "email=gy@intellias.com" >> "${NPMRC}"
echo "unsafe-perm=true" >> "${NPMRC}"
echo "NPM END"

npm publish --loglevel silly
rm -f "${NPMRC}"


echo 1 > "${bamboo_build_working_directory}/result.txt"