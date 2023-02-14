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

const Promise = require('bluebird');

/**
 * This is an abstract base class representing the different types of neural network architectures that are supported by Electric Brain.
 *
 * The server-side functionality can all be accessed (to some extent) through this common interface
 */
class EBArchitecturePluginBase
{
    /**
     * This constructs the plugin
     *
     * @param {EBInterpretationRegistry} registry The registry for the transformation stream
     * @param {EBNeuralNetworkComponentDispatch} neuralNetworkComponentDispatch A reference the the globally initialized componentDispatch method
     */
    constructor(registry, neuralNetworkComponentDispatch)
    {
        this.registry = registry;
        this.neuralNetworkComponentDispatch = neuralNetworkComponentDispatch;
    }
    
    
    /**
     * This method creates an EBTorchProcessBase object for this architecture.
     *
     * @param {EBArchitecture} architecture An EBArchitecture object
     * @param {string} [scriptFolder] Optional script folder for the files to go
     * 
     * @returns {EBTorchProcessBase} A torch process object
     */
    getTorchProcess(architecture, scriptFolder)
    {
        throw new Error("Unimplemented");
    }


    /**
     * This method generates all the files for this neural network architecture
     *
     * @param {EBTransformArchitecture} architecture An EBTransformArchitecture object
     * @returns {[object]} The an array of objects describing the generated files.
     *                     Each object has two properties, 'path' for the files
     *                     path and filename, and 'data' for the contents of the
     *                     file
     */
    generateFiles(architecture)
    {
        throw new Error("Unimplemented");
    }
}

module.exports = EBArchitecturePluginBase;
