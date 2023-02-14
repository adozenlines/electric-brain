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

const EBArchitecturePluginBase = require("../../../server/components/architecture/EBArchitecturePluginBase"),
    EBCustomTransformation = require("../../../shared/components/architecture/EBCustomTransformation"),
    EBDataSource = require("../../../shared/models/EBDataSource"),
    EBSchema = require("../../../shared/models/EBSchema"),
    EBMatchingTorchProcess = require("./EBMatchingTorchProcess"),
    EBTorchCustomModule = require("../../../shared/components/architecture/EBTorchCustomModule"),
    EBNeuralNetworkEditorModule = require("../../../shared/models/EBNeuralNetworkEditorModule"),
    EBNeuralNetworkComponentBase = require("../../../shared/components/architecture/EBNeuralNetworkComponentBase"),
    EBTorchModule = require("../../../shared/components/architecture/EBTorchModule"),
    EBTorchNode = require("../../../shared/components/architecture/EBTorchNode"),
    matchingTrainingScriptTemplate = require("../../../build/torch/matching_training_script"),
    path = require('path');

/**
 * This is the main plugin entry point for the matching network plugin.
 */
class EBMatchingArchitecturePlugin extends EBArchitecturePluginBase
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
     * @param {EBMatchingArchitecture} architecture An EBMatchingArchitecture object
     * @param {string} [scriptFolder] Optional script folder for the files to go
     *
     * @returns {EBMatchingTorchProcess} A matching torch process object
     */
    getTorchProcess(architecture, scriptFolder)
    {
        return new EBMatchingTorchProcess(architecture, this, scriptFolder);
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
        const self = this;

        const primarySchema = this.registry.getInterpretation('object').transformSchemaForNeuralNetwork(architecture.primarySchema.filterIncluded());
        const secondarySchema = this.registry.getInterpretation('object').transformSchemaForNeuralNetwork(architecture.secondarySchema.filterIncluded());

        const primaryModuleName = `${architecture.machineName}PrimaryModule`;
        const secondaryModuleName = `${architecture.machineName}SecondaryModule`;

        // Create a list of files that need to be written
        const files = [];

        const primaryInputNode = new EBTorchNode(new EBTorchModule("nn.Identity", []), null, `${primaryModuleName}_primaryInput`);
        const secondaryInputNode = new EBTorchNode(new EBTorchModule("nn.Identity", []), null, `${secondaryModuleName}_secondaryInput`);

        const primaryInputStack = this.neuralNetworkComponentDispatch.generateInputStack(primarySchema, primaryInputNode, 'primary');
        const secondaryInputStack = this.neuralNetworkComponentDispatch.generateInputStack(secondarySchema, secondaryInputNode, 'secondary');

        // Create summary nodes for the primary and secondary stacks
        const primarySummaryModule = EBNeuralNetworkComponentBase.createSummaryModule(primaryInputStack.outputTensorSchema);
        const primarySummaryNode = new EBTorchNode(primarySummaryModule.module, primaryInputStack.outputNode, `primary_summaryNode`);

        const secondarySummaryModule = EBNeuralNetworkComponentBase.createSummaryModule(secondaryInputStack.outputTensorSchema);
        const secondarySummaryNode = new EBTorchNode(secondarySummaryModule.module, secondaryInputStack.outputNode, `secondary_summaryNode`);

        // Create the fully connected layers for the primary and secondary trees
        const primaryFullyConnectedStack = EBNeuralNetworkEditorModule.createModuleChain(architecture.primaryFixedLayers, primarySummaryModule.tensorSchema, {
            outputSize: 200
        });
        const secondaryFullyConnectedStack = EBNeuralNetworkEditorModule.createModuleChain(architecture.secondaryFixedLayers, secondarySummaryModule.tensorSchema, {
            outputSize: 200
        });
        const primaryLinearUnit = new EBTorchNode(primaryFullyConnectedStack.module, primarySummaryNode, `primary_linearUnit`);
        const secondaryLinearUnit = new EBTorchNode(secondaryFullyConnectedStack.module, secondarySummaryNode, `secondary_linearUnit`);

        const primaryModule = new EBTorchCustomModule(primaryModuleName, primaryInputNode, primaryLinearUnit, (primaryInputStack.additionalModules.map((module) => module.name)));
        const secondaryModule = new EBTorchCustomModule(secondaryModuleName, secondaryInputNode, secondaryLinearUnit, (secondaryInputStack.additionalModules.map((module) => module.name)));

        const allModules = [primaryModule, secondaryModule].concat(primaryInputStack.additionalModules).concat(secondaryInputStack.additionalModules);

        // Create a file for each module
        allModules.forEach((module) =>
        {
            const file = {
                path: module.filename,
                data: module.generateLuaCode()
            };

            files.push(file);
        });
        
        // Generate the training script
        files.push({
            path: "TrainingScript.lua",
            data: matchingTrainingScriptTemplate({
                primarySchema: primarySchema,
                secondarySchema: secondarySchema,
                primaryModuleName: primaryModuleName,
                secondaryModuleName: secondaryModuleName,
                wordVectorDBPath: path.join(__dirname, '..', '..', '..', 'data', 'english_word_vectors.sqlite3'),
                convertDataIn: this.neuralNetworkComponentDispatch.generateTensorInputCode.bind(this.neuralNetworkComponentDispatch),
                convertDataOut: this.neuralNetworkComponentDispatch.generateTensorOutputCode.bind(this.neuralNetworkComponentDispatch),
                prepareBatch: this.neuralNetworkComponentDispatch.generatePrepareBatchCode.bind(this.neuralNetworkComponentDispatch),
                unwindBatchOutput: this.neuralNetworkComponentDispatch.generateUnwindBatchCode.bind(this.neuralNetworkComponentDispatch),
                generateLocalizeFunction: (schema, name) =>
                {
                    return this.neuralNetworkComponentDispatch.getTensorSchema(schema).generateLocalizeFunction(name);
                }
            })
        });

        return files;
    }
}

module.exports = EBMatchingArchitecturePlugin;
