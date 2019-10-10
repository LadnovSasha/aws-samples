#!/bin/bash

set -e


plan_type=$1


source "${bamboo_build_working_directory}/scripts/common.sh"


if [ "${plan_type}" == "build" ]; then

    [ -f "${result_file}" ] && slack_build_success || slack_build_failed

fi


if [ "${plan_type}" == "deploy" ]; then

    [ -f "${result_file}" ] && slack_deploy_success || slack_deploy_failed

fi

