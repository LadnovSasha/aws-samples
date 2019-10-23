#!/bin/bash

set -e


result_file="${bamboo_build_working_directory}/result.txt"


function set_npm_config() {

    OPTIND=1
    echo "${FUNCNAME[0]} function has been started"

    while getopts u:t:p: option
        do 
            case "${option}" in
                u) npm_repo_url=${OPTARG};; 
                t) npm_secret_token=${OPTARG};; 
                p) npmrc_file_path=${OPTARG};;
                *) echo "Required options are: u, t, p"; exit 1;;
            esac
        done

    echo "registry=${npm_repo_url}" > "${npmrc_file_path}"
    echo "_auth=${npm_secret_token}" >> "${npmrc_file_path}"
    echo "strict-ssl=true" >> "${npmrc_file_path}"
    echo "always-auth=true" >> "${npmrc_file_path}"
    echo "email=gy@intellias.com" >> "${npmrc_file_path}"
    echo "unsafe-perm=true" >> "${npmrc_file_path}"

    npm config list

}


function get_app_info() {

    app_name=$(cat ./package.json | jq --raw-output '.name')
    app_version=$(cat ./package.json | jq --raw-output '.version')
    echo "Application name = ${app_name}"
    echo "Application version = ${app_version}"

}


function slack_send_msg() {
  OPTIND=1
  echo "Sending notification to slack"

  while getopts m:u:i: option; do

      case "${option}" in
          m) msg=${OPTARG};;
          u) user=${OPTARG};;
          i) icon=${OPTARG};;
          *) echo "Required options are: m, u, i"; exit 1;;
      esac

  done

  curl -X POST --data-urlencode "payload={\"channel\": \"#gaas-ci\",
                        \"username\": \"${user}\",
                        \"text\": \"${msg}\",
                        \"icon_emoji\": \"${icon}\"}" \
                        "${bamboo_gaas_slack_secret_url}"

}


function slack_build_success() {

    slack_send_msg \
            -m "${bamboo_planName},  Build result: SUCCESS, triggered by ${bamboo_ManualBuildTriggerReason_userName}, Build logs - ${bamboo_resultsUrl}" \
            -u "Bamboo" \
            -i ":large_blue_circle:"

}


function slack_build_failed() {

    slack_send_msg \
            -m "${bamboo_planName},  Build FAILED, triggered by ${bamboo_ManualBuildTriggerReason_userName}, Build logs - ${bamboo_resultsUrl}" \
            -u "Bamboo" \
            -i ":red_circle:"

}


function slack_deploy_success() {

    slack_send_msg \
            -m "${bamboo_deploy_project}, Deploy result: SUCCESS, Env ${bamboo_gaas_deploy_stage}, triggered by ${bamboo_ManualBuildTriggerReason_userName}, Build logs - ${bamboo_resultsUrl}" \
            -u "Bamboo" \
            -i ":sunny:"

}


function slack_deploy_failed() {

    slack_send_msg \
            -m "${bamboo_deploy_project}, Deploy result FAILED, Env ${bamboo_gaas_deploy_stage}, triggered by ${bamboo_ManualBuildTriggerReason_userName}, Build logs - ${bamboo_resultsUrl}" \
            -u "Bamboo" \
            -i ":rain_cloud:"

}


function sonar_scanner() {

    OPTIND=1
    echo "${FUNCNAME[0]} function has been started"

    while getopts k:u:t: option
        do 
            case "${option}" in
                k) projectKey=${OPTARG};; 
                u) hostUrl=${OPTARG};; 
                t) login=${OPTARG};;
                *) echo "Required options are: k, u, t"; exit 1;;
            esac
        done

    java -version

    sonar-scanner --version

    sonar-scanner \
        -Dsonar.projectKey=gaas-${projectKey} \
        -Dsonar.sources=. \
        -Dsonar.java.binaries=. \
        -Dsonar.exclusions="node_modules/**/*" \
        -Dsonar.host.url=${hostUrl} \
        -Dsonar.login=${login} \
        -Dsonar.javascript.lcov.reportPaths=reports/coverage/lcov.info \
        -Dsonar.typescript.lcov.reportPaths=reports/coverage/lcov.info \
        > sonar.log
    
    if grep -q "EXECUTION SUCCESS" sonar.log ; then echo "Sonar has no errors" ; else echo "Sonar error detected, breaking.." && exit 1; fi

}