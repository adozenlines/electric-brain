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

const
    async = require('async'),
    criterionTemplate = require("../../../build/torch/criterion"),
    deepcopy = require('deepcopy'),
    EBArchitecturePluginBase = require("../../../server/components/architecture/EBArchitecturePluginBase"),
    EBCustomTransformation = require("../../../shared/components/architecture/EBCustomTransformation"),
    EBDataSource = require("../../../shared/models/EBDataSource"),
    EBSchema = require("../../../shared/models/EBSchema"),
    EBTorchCustomModule = require("../../../shared/components/architecture/EBTorchCustomModule"),
    EBTorchModule = require("../../../shared/components/architecture/EBTorchModule"),
    EBTorchNode = require("../../../shared/components/architecture/EBTorchNode"),
    EBTransformTorchProcess = require('./EBTransformTorchProcess'),
    path = require('path'),
    Promise = require('bluebird'),
    stream = require('stream'),
    transformTrainingScriptTemplate = require("../../../build/torch/transform_training_script"),
    underscore = require('underscore');


class EBTransformArchitecture extends EBArchitecturePluginBase
{
    /**
     * This constructs the plugin
     *
     * @param {EBInterpretationRegistry} registry The registry for the transformation stream
     * @param {EBNeuralNetworkComponentDispatch} neuralNetworkComponentDispatch A reference the the globally initialized componentDispatch method
     */
    constructor(registry, neuralNetworkComponentDispatch)
    {
        super(registry, neuralNetworkComponentDispatch);
        this.registry = registry;
        this.neuralNetworkComponentDispatch = neuralNetworkComponentDispatch;
    }


    /**
     * This method creates an EBTorchProcessBase object for this architecture.
     *
     * @param {EBTransformArchitecture} architecture An EBTransformArchitecture object
     * @param {string} [scriptFolder] Optional script folder for the files to go
     *
     * @returns {EBTransformTorchProcess} A matching torch process object
     */
    getTorchProcess(architecture, scriptFolder)
    {
        return new EBTransformTorchProcess(architecture, this, scriptFolder);
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
        const inputSchema = this.registry.getInterpretation('object').transformSchemaForNeuralNetwork(architecture.inputSchema.filterIncluded());
        const outputSchema = this.registry.getInterpretation('object').transformSchemaForNeuralNetwork(architecture.outputSchema.filterIncluded());

        const rootModuleName = `${architecture.machineName}Module`;
        const rootCriterionName = `${architecture.machineName}Criterion`;

        // Create a list of files that need to be written
        const files = [];

        const inputNode = new EBTorchNode(new EBTorchModule("nn.Identity", []), null, `${rootModuleName}_input`);
        const inputStack = this.neuralNetworkComponentDispatch.generateInputStack(inputSchema, inputNode, 'main');
        const outputStack = this.neuralNetworkComponentDispatch.generateOutputStack(outputSchema, inputStack.outputNode, inputStack.outputTensorSchema, "main");
        const mainModule = new EBTorchCustomModule(rootModuleName, inputNode, outputStack.outputNode, (inputStack.additionalModules.concat(outputStack.additionalModules).map((module) => module.name)));

        const allModules = [mainModule].concat(inputStack.additionalModules).concat(outputStack.additionalModules);

        // Create a file for each module
        allModules.forEach((module) =>
        {
            const file = {
                path: module.filename,
                data: module.generateLuaCode()
            };

            files.push(file);
        });


        // Create a file for the criterion
        files.push({
            path: `${rootCriterionName}.lua`,
            // Create the criterion template for the output schema
            data: criterionTemplate({
                criterionName: rootCriterionName,
                mainCriterion: this.neuralNetworkComponentDispatch.generateCriterion(outputSchema)
            })
        });

        files.push({
            path: "TrainingScript.lua",
            data: transformTrainingScriptTemplate({
                convertDataIn: this.neuralNetworkComponentDispatch.generateTensorInputCode.bind(this.neuralNetworkComponentDispatch),
                convertDataOut: this.neuralNetworkComponentDispatch.generateTensorOutputCode.bind(this.neuralNetworkComponentDispatch),
                prepareBatch: this.neuralNetworkComponentDispatch.generatePrepareBatchCode.bind(this.neuralNetworkComponentDispatch),
                unwindBatchOutput: this.neuralNetworkComponentDispatch.generateUnwindBatchCode.bind(this.neuralNetworkComponentDispatch),
                generateLocalizeFunction: (schema, name) =>
                {
                    return this.neuralNetworkComponentDispatch.getTensorSchema(schema).generateLocalizeFunction(name);
                },
                rootModuleName: rootModuleName,
                rootCriterionName: rootCriterionName,
                wordVectorDBPath: path.join(__dirname, '..', '..', '..', 'data', 'english_word_vectors.sqlite3'),
                inputSchema,
                outputSchema
            })
        });

        return files;
    }
}


module.exports = EBTransformArchitecture;