#!/usr/bin/env bash
set -e

# Electric Brain is an easy to use platform for machine learning.
# Copyright (C) 2016 Electric Brain Software Corporation
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
# This script is used for installation of Electric Brain.
#
# Portions of this script were adapted from the Torch (http://torch.ch) installation script.


install_dependencies_darwin() {
    # Install Homebrew (pkg manager):
    if [[ `which brew` == '' ]]; then
        ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
    fi

    # Install dependencies:
    brew update
    brew install mongodb rabbitmq node@4 graphviz sqlite
    brew link node@4 --force
    brew services start mongodb
    brew services start rabbitmq
}

install_redhat_epel() {
    # Add EPEL repository
    rpm -Uvh --replacepkgs https://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm
}

install_rabbitmq_redhat() {
    # Download and install Erlang
    yum install -y erlang

    # Install Rabbit by directly pulling from their website
    wget https://github.com/rabbitmq/rabbitmq-server/releases/download/rabbitmq_v3_6_6/rabbitmq-server-3.6.6-1.el7.noarch.rpm

    # Add the necessary keys for verification:
    rpm --import https://www.rabbitmq.com/rabbitmq-signing-key-public.asc

    # Install the .RPM package using YUM:
    rpm -Uvh --replacepkgs rabbitmq-server-3.6.6-1.el7.noarch.rpm
}


install_dependencies_redhat() {
    # Install the redhat EPEL repository
    install_redhat_epel

    # Now install nodejs, mongodb
    sudo yum -y update
    sudo yum -y install mongodb mongodb-server nodejs git graphviz gcc-c++ sqlite3-devel

    install_rabbitmq_redhat

    sudo service rabbitmq-server start
    sudo service mongod start
}


install_dependencies_ubuntu() {
    # Install the nodesource repository
    curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -

    sudo apt update
    sudo apt install mongodb rabbitmq-server nodejs graphviz git build-essential libsqlite3-dev -y
}


install_torch() {
    if [[ `which th` == '' ]]; then
        # Install torch and then clean up
        cd /tmp
        git clone https://github.com/torch/distro.git /tmp/torch --recursive
        cd /tmp/torch; bash install-deps;
        sudo PREFIX=/usr/local ./install.sh -b
        cd ..
        sudo rm -rf /tmp/torch

        # Torch Activate and install Lua dependencies
        /usr/local/bin/torch-activate
        sudo /usr/local/bin/luarocks install json
        sudo /usr/local/bin/luarocks install distlearn
        sudo /usr/local/bin/luarocks install ipc
        sudo /usr/local/bin/luarocks install rnn
        sudo /usr/local/bin/luarocks install underscore
        sudo /usr/local/bin/luarocks install luasocket
        sudo /usr/local/bin/luarocks install lsqlite3
    fi
}

install_electric_brain() {
    sudo npm install electricbrain -g
}


installation_main()
{
    if [[ `uname` == 'Darwin' ]]; then
        install_dependencies_darwin
        install_torch
        # Must be run without sudo on mac
        npm install electricbrain -g
    elif [[ `uname` == 'Linux' ]]; then
        if [[ -r /etc/os-release ]]; then
            # this will get the required information without dirtying any env state
            DIST_VERS="$( ( . /etc/os-release &>/dev/null
                            echo "$ID $VERSION_ID") )"
            DISTRO="${DIST_VERS%% *}" # get our distro name
            VERSION="${DIST_VERS##* }" # get our version number
        elif [[ -r /etc/redhat-release ]]; then
            DIST_VERS=( $( cat /etc/redhat-release ) ) # make the file an array
            DISTRO="${DIST_VERS[0],,}" # get the first element and get lcase
            VERSION="${DIST_VERS[2]}" # get the third element (version)
        elif [[ -r /etc/lsb-release ]]; then
            DIST_VERS="$( ( . /etc/lsb-release &>/dev/null
                            echo "${DISTRIB_ID,,} $DISTRIB_RELEASE") )"
            DISTRO="${DIST_VERS%% *}" # get our distro name
            VERSION="${DIST_VERS##* }" # get our version number
        else # well, I'm out of ideas for now
            echo '==> Failed to determine distro and version.'
            exit 1
        fi

        # Installation for fedora / centos
        if [[ "$DISTRO" = "fedora" ||  "$DISTRO" = "centos" ]]; then
            install_dependencies_redhat
            install_torch
            install_electric_brain
        # Installation for Ubuntu
        elif [[ "$DISTRO" = "ubuntu" ]]; then
            install_dependencies_ubuntu
            install_torch
            install_electric_brain
        else
            echo '==> Only Ubuntu, Fedora, and CentOS are supported.'
            exit 1
        fi
    fi
}

# Kick off the installation
installation_main