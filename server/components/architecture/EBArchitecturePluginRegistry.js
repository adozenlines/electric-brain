/*
 Electric Brain is an easy to use platform for machine learning.
 Copyright (C) 2016 Electric Brain Software Corporation

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Affero General Public License for more details.

 You should have received a copy of the GNU Affero General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";


/**
 * The purpose of this class is to keep track of all the registered architecture plugins
 */
class EBArchitecturePluginRegistry
{
    /**
     * This creates the plugin registry
     */
    constructor()
    {
        this.architectures = {};
    }

    /**
     * This registers the given plugin
     *
     * @param {string} name The name of the plugin
     * @param {EBArchitecturePluginBase} plugin An instantiated architecture plugin object
     */
    registerPlugin(name, plugin)
    {
        this.architectures[name] = plugin;
    }

    /**
     * This method returns the architecture plugin for the given EBArchitecture sub-class object
     *
     * @param {EBArchitecture} architecture An object which is the sub-class of EBArchitecture
     * @return {EBArchitecturePluginBase} An instantiated architecture plugin object
     */
    getPluginForArchitecture(architecture)
    {
        if (architecture.classType === 'EBTransformArchitecture')
        {
            return this.architectures['EBTransformArchitecturePlugin'];
        }
        else if (architecture.classType === 'EBMatchingArchitecture')
        {
            return this.architectures['EBMatchingArchitecturePlugin'];
        }
        else
        {
            throw new Error(`Unrecognized architecture class: ${architecture.classType}`);
        }
    }
};


module.exports = EBArchitecturePluginRegistry;

