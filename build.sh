#!/bin/bash

set -e

function inject_ssh_key() {

    echo "${FUNCNAME[0]} function has been started"
    functionStartTime=$(date +"%s")

    local ssh_dir_path="/root/.ssh"
    local id_rsa_file_path="/root/.ssh/id_rsa"
    local known_hosts_file_path="/root/.ssh/known_hosts"

    if [ -d "${ssh_dir_path}" ]; then 
        rm -rf "${ssh_dir_path}"
    fi

    mkdir "${ssh_dir_path}"

    echo "${bamboo_gy_ttu_ssh_key_secret}" | base64 --decode > "${id_rsa_file_path}"

    if [ ! -s "${id_rsa_file_path}" ]; then
        echo -e "${id_rsa_file_path} is empty, breaking.."
        exit 1
    fi

    chmod 400 "${id_rsa_file_path}"


    for i in {1..10}; do

        sleep $i
        echo "ssh-keyscan bitbucket.org $i time"
        ssh-keyscan bitbucket.org > "${known_hosts_file_path}"
    
        if [ -s "${known_hosts_file_path}" ]; then
            cat "${known_hosts_file_path}"
            echo "ssh-keyscan has been finished successfully"
            break
        fi

    done

    if [ ! -s "${known_hosts_file_path}" ]; then

        echo "${known_hosts_file_path} is empty, breaking.."
        exit 1
    
    fi

    functionEndTime=$(date +"%s")
    runtime=$((functionEndTime-functionStartTime))

    echo "${FUNCNAME[0]} function has been finished with status: SUCCESS in ${runtime} sec"

}


inject_ssh_key
git submodule update --init --recursive --remote


# if [ ! -f ci-common/functionsSource.sh ]; then echo "Submodules directory is empty" && exit 1; fi
# echo "Listing bamboo default workspace dir after moving sources.."
ls -lAp "${bamboo_build_working_directory}"


cp ci-common/cleanWorkspace.py /tmp/cleanWorkspace.py
python /tmp/cleanWorkspace.py --git_repo_url "${bamboo_gaas_example_lambda_git_url}"

cd "${bamboo_build_working_directory}"
git submodule update --init --recursive --remote

source ci-common/functionsSource.sh


example_lambda_build