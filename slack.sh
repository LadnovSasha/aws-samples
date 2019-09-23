#!/bin/bash

set -e
# set -x

msg_type=$1

source ci-common/functionsSource.sh

current_stage_file="${bamboo_build_working_directory}/${bamboo_gaas_current_stage_filename}"

if [ -f "${current_stage_file}" ]; then
    
    stage=$(cat ${current_stage_file})

    versiondb_update \
                -u "${bamboo_versiondb}"/"${bamboo_repository_name}" \
                -s "${stage}Result" \
                -m "Failed"
    
    rm -f ${current_stage_file}
fi

[ "${msg_type}" = "deploy" ] && slack_deploy_failed || slack_failed

exit 1