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
    assert = require('assert'),
    EBNeuralNetworkComponentBase = require('../../../shared/components/architecture/EBNeuralNetworkComponentBase'),
    EBNeuralNetworkEditorModule = require("../../../shared/models/EBNeuralNetworkEditorModule"),
    EBTorchCustomModule = require('../../../shared/components/architecture/EBTorchCustomModule'),
    EBTorchModule = require('../../../shared/components/architecture/EBTorchModule'),
    EBTorchNode = require('../../../shared/components/architecture/EBTorchNode'),
    EBTensorSchema = require('../../../shared/models/EBTensorSchema'),
    underscore = require('underscore');

/**
 * This is a base class for various neural network components
 */
class EBNeuralNetworkSequenceComponent extends EBNeuralNetworkComponentBase
{
    /**
     * Constructor. Takes a neural network component dispatch
     */
    constructor(neuralNetworkComponentDispatch)
    {
        super(neuralNetworkComponentDispatch);
        this.neuralNetworkComponentDispatch = neuralNetworkComponentDispatch;
    }


    /**
     * Method returns the tensor schema for input data to the network
     *
     * @param {EBSchema} schema The regular schema from which we will determine the tensor schema
     * @returns {EBTensorSchema} The mapping of tensors.
     */
    getTensorSchema(schema)
    {
        // Preliminary assertions
        assert(schema.isArray);

        return new EBTensorSchema({
            "type": "array",
            "variableName": schema.variableName,
            "items": this.neuralNetworkComponentDispatch.getTensorSchema(schema.items)
        });
    }


    /**
     * Method generates Lua code to create a tensor from the JSON of this variable
     *
     * @param {EBSchema} schema The schema to generate this conversion code for.
     * @param {string} name The name of the lua function to be generated.
     */
    generateTensorInputCode(schema, name)
    {
        // First, ensure that the schema we are dealing with is an array
        assert(schema.isArray);

        let code = '';

        code += `local ${name} = function (input)\n`;

        let subFunctionName = `${name}_items`;

        let itemSchemaCode = this.neuralNetworkComponentDispatch.generateTensorInputCode(schema.items, subFunctionName);
        itemSchemaCode = "    " + itemSchemaCode.replace(/\n/g, "\n    ");

        code += itemSchemaCode;
        
        code += `local transformed = {torch.Tensor(1):fill(#input), {}}\n`;
        code += `    for n=1,#input do\n`;
        code += `        local item = ${subFunctionName}(input[n])\n`;
        code += `        table.insert(transformed[2], item)\n`;
        code += `    end\n`;
        code += `    return transformed\n`;
        code += `end\n`;

        return code;
    }


    /**
     * Method generates Lua code to turn a tensor back into a JSON
     *
     * @param {EBSchema} schema The schema to generate this conversion code for
     * @param {string} name The name of the Lua function to be generated
     */
    generateTensorOutputCode(schema, name)
    {
        // First, ensure that the schema we are dealing with is an array
        assert(schema.isArray);

        let code = '';

        code += `local ${name} = function (input)\n`;

        let subFunctionName = `${name}_items`;

        let itemSchemaCode = this.neuralNetworkComponentDispatch.generateTensorOutputCode(schema.items, subFunctionName);
        itemSchemaCode = `    ${itemSchemaCode.replace(/\n/g, "\n    ")}`;

        code += itemSchemaCode;

        code += `local transformed = {}\n`;
        code += `    for n=1,input[1][1] do\n`;
        code += `        local item = ${subFunctionName}(input[2][n])\n`;
        code += `        table.insert(transformed, item)\n`;
        code += `    end\n`;
        code += `    return transformed\n`;
        code += `end\n`;

        return code;
    }


    /**
     * Method generates Lua code that can prepare a combined batch tensor from
     * multiple samples.
     *
     * @param {EBSchema} schema The schema to generate this conversion code for
     * @param {string} name The name of the Lua function to be generated
     */
    generatePrepareBatchCode(schema, name)
    {
        // First, ensure that the schema we are dealing with is an array
        assert(schema.isArray);

        let code = '';

        code += `local ${name} = function (input)\n`;

        let subFunctionName = `${name}_items`;
        let itemSchemaCode = this.neuralNetworkComponentDispatch.generatePrepareBatchCode(schema.items, subFunctionName);
        itemSchemaCode = `    ${itemSchemaCode.replace(/\n/g, "\n    ")}`;
        code += itemSchemaCode;

        let emptyTensorFunctionName = `generateEmpty_${name}_item`;
        let emptyTensorCode = EBNeuralNetworkComponentBase.generateEmptyTensorTableCode(this.neuralNetworkComponentDispatch.getTensorSchema(schema.items), emptyTensorFunctionName);
        emptyTensorCode = `    ${emptyTensorCode.replace(/\n/g, "\n    ")}`;
        code += emptyTensorCode;

        // First determine what the longest sequence is
        code += `local longest = 0\n`;
        code += `    for k,v in pairs(input) do\n`;
        code += `        longest = math.max(longest, input[k][1][1])\n`;
        code += `    end\n`;
        code += `    local batch = {torch.Tensor(#input), {}}\n`;
        code += `    for k,v in pairs(input) do\n`;
        code += `       batch[1][k] = input[k][1][1]\n`;
        code += `    end\n`;
        
        if (schema.configuration.component.enforceSequenceLengthLimit)
        {
            code += `    -- Enforce a maximum length\n`;
            code += `    longest = math.min(longest, ${schema.configuration.component.maxSequenceLength})\n`;
        }
        
        code += `    for n=1,longest do\n`;
        code += `        local samples = {}\n`;
        code += `        for k,v in pairs(input) do\n`;
        code += `           if input[k][1][1] >= 1 and input[k][1][1] >= n then\n`;
        code += `               -- Insert an actual sample\n`;
        code += `               table.insert(samples, input[k][2][n])\n`;
        code += `           else\n`;
        code += `               -- Insert a blank object\n`;
        code += `               table.insert(samples, ${emptyTensorFunctionName}())\n`;
        code += `           end\n`;
        code += `        end\n`;
        code += `        local item = ${subFunctionName}(samples)\n`;
        code += `        table.insert(batch[2], item)\n`;
        code += `    end\n`;
        code += `    return batch\n`;
        code += `end\n`;

        return code;
    }


    /**
     * Method generates Lua code that can takes a batch and breaks it apart
     * into the individual samples
     *
     * @param {EBSchema} schema The schema to generate this unwinding code for
     * @param {string} name The name of the Lua function to be generated
     */
    generateUnwindBatchCode(schema, name)
    {
        // First, ensure that the schema we are dealing with is an array
        assert(schema.isArray);

        let code = '';

        code += `local ${name} = function (input)\n`;

        const subFunctionName = `${name}_items`;
        let itemSchemaCode = this.neuralNetworkComponentDispatch.generateUnwindBatchCode(schema.items, subFunctionName);
        itemSchemaCode = `    ${itemSchemaCode.replace(/\n/g, "\n    ")}`;
        code += itemSchemaCode;

        // Go through each item in the input
        code += `    local outputs = {}\n`;
        code += `    for n=1,#input[2] do\n`;
        code += `        local items = ${subFunctionName}(input[2][n])\n`;
        code += `        for s=1, #items do\n`;
        code += `           if n <= input[1][s] then\n`;
        code += `               if not outputs[s] then\n`;
        code += `                   outputs[s] = {torch.Tensor(1):fill(input[1][s]), {}}\n`;
        code += `               end\n`;
        code += `               table.insert(outputs[s][2], items[s])\n`;
        code += `           end\n`;
        code += `        end\n`;
        code += `    end\n`;
        code += `    return outputs\n`;
        code += `end\n`;

        return code;
    }


    /**
     * This method should generate an input stack for this variable
     *
     * @param {EBSchema} schema The schema to generate this stack for
     * @param {EBTorchNode} inputNode The input node for this variable
     * @param {string} rootName The name of the stack, this prevents variable name collisions when there are multiple stacks
     * @returns {object} An object with the following structure:
     *                      {
     *                          "outputNode": EBTorchNode || null,
     *                          "outputTensorSchema": EBTensorSchema || null,
     *                          "additionalModules": [EBCustomModule]
     *                      }
     */
    generateInputStack(schema, inputNode, rootName)
    {
        // Preliminary assertions
        assert(schema.isArray);

        // Get the tensor-schema for this array
        const tensorSchema = this.getTensorSchema(schema);
        const moduleName = `${rootName}_${schema.machineVariablePath}`;
        
        // Create the input stack for the items of this array
        const subModuleName = `${moduleName}_itemInputStack`;
        const subModuleInputNode = new EBTorchNode(new EBTorchModule("nn.Identity", []), null, `${subModuleName}_input`);
        const itemInputStack = this.neuralNetworkComponentDispatch.generateInputStack(schema.items, subModuleInputNode, rootName);
        const subModule = new EBTorchCustomModule(subModuleName, subModuleInputNode, itemInputStack.outputNode, itemInputStack.additionalModules.map((module) => module.name));

        // Cleave off the length tensor at the beginning of the sequence
        const lengthNode = new EBTorchNode(new EBTorchModule("nn.SelectTable", [1]), inputNode, `${moduleName}_lengthNode`);
        const sequenceNode = new EBTorchNode(new EBTorchModule("nn.SelectTable", [2]), inputNode, `${moduleName}_sequenceNode`);

        // Use MapTable to run each item through the input stack
        const subModuleProcessor = new EBTorchNode(new EBTorchModule(`nn.MapTable`, [
            new EBTorchModule(`nn.${subModuleName}`)
        ]), sequenceNode, `${moduleName}_subModuleProcessor`);

        // Create a summary module to create tensors output of the items input stack that can be fed into the LSTM
        const summaryModule = EBNeuralNetworkComponentBase.createSummaryModule(itemInputStack.outputTensorSchema);
        const summarizerModule = new EBTorchNode(new EBTorchModule(`nn.MapTable`, [summaryModule.module]), subModuleProcessor, `${moduleName}_summarizerNode`);

        // Unsqueeze the tensors to add in a time dimension
        const unsqueezeInput = new EBTorchNode(new EBTorchModule("nn.MapTable", [new EBTorchModule("nn.Unsqueeze", ["1"])]), summarizerModule, `${moduleName}_unsqueezeInput`);

        // Now fuse rnn inputs along the time dimension
        const fuseRNNInputTensors = new EBTorchNode(new EBTorchModule("nn.JoinTable", ["1"]), unsqueezeInput, `${moduleName}_fuseRNNInputTensors`);

        // Generate the LSTM stack
        const rnnStack = EBNeuralNetworkEditorModule.createModuleChain(schema.configuration.component.layers, summaryModule.tensorSchema, {});

        // Run through the LSTM itself
        const rnnStackModule = new EBTorchNode(rnnStack.module, fuseRNNInputTensors, `${moduleName}_rnnStackModule`);

        // Break apart the output tensors along time dimension
        const splitNode = new EBTorchNode(new EBTorchModule("nn.SplitTable", ["1"]), rnnStackModule, `${moduleName}_splitNode`);

        // Output node - combines a length node with the sequence node
        const outputNode = new EBTorchNode(new EBTorchModule("nn.Identity", []), [lengthNode, splitNode], `${moduleName}_outputNode`);

        return {
            outputNode: outputNode,
            outputTensorSchema: new EBTensorSchema({
                "type": "array",
                "variableName": `${moduleName}_lstmOutput`,
                "items": EBTensorSchema.generateDataTensorSchema(rnnStack.outputTensorSchema.tensorSize, `${moduleName}_lstmOutput_items`)
            }),
            additionalModules: [subModule].concat(itemInputStack.additionalModules)
        };
    }


    /**
     * This method should generate the output stack for this variable
     *
     * @param {EBSchema} outputSchema The schema to generate this output stack for
     * @param {EBTorchNode} inputNode The input node for this stack
     * @param {EBTensorSchema} inputTensorSchema The schema for the intermediary tensors from which we construct this output stack
     * @param {string} rootName The name of the stack, this prevents variable name collisions when there are multiple stacks
     * @returns {object} An object with the following structure:
     *                      {
     *                          "outputNode": EBTorchNode || null,
     *                          "outputTensorSchema": EBTensorSchema || null,
     *                          "additionalModules": [EBCustomModule]
     *                      }
     */
    generateOutputStack(outputSchema, inputNode, inputTensorSchema, rootName)
    {
        // Preliminary assertions
        assert(outputSchema.isArray);

        const moduleName = `${rootName}_${outputSchema.machineVariablePath}`;

        // Create a node which extracts the sequence node
        const sequencePosition = inputTensorSchema.getPropertyIndex(`${moduleName}_lstmOutput`);
        assert(sequencePosition !== null);
        const sequenceTensorSchema = inputTensorSchema.properties[sequencePosition];
        const fieldExtractionNode = new EBTorchNode(new EBTorchModule('nn.SelectTable', [sequencePosition + 1]), inputNode, `${moduleName}_extractField`);

        // Cleave off the length tensor at the beginning of the sequence
        const lengthNode = new EBTorchNode(new EBTorchModule("nn.SelectTable", [1]), fieldExtractionNode, `${moduleName}_lengthNode`);
        const sequenceNode = new EBTorchNode(new EBTorchModule("nn.SelectTable", [2]), fieldExtractionNode, `${moduleName}_sequenceNode`);

        // Now create an output stack that we can apply to each item
        const subModuleName = `${moduleName}_itemOutputStack`;
        const subModuleInputNode = new EBTorchNode(new EBTorchModule("nn.Identity", []), null, `${subModuleName}_input`);
        const itemOutputStack = this.neuralNetworkComponentDispatch.generateOutputStack(outputSchema.items, subModuleInputNode, sequenceTensorSchema.items, rootName);
        const subModule = new EBTorchCustomModule(subModuleName, subModuleInputNode, itemOutputStack.outputNode, itemOutputStack.additionalModules.map((module) => module.name));
        
        // Use MapTable to run each item through the output stack
        const subModuleProcessor = new EBTorchNode(new EBTorchModule(`nn.MapTable`, [
            new EBTorchModule(`nn.${subModuleName}`)
        ]), sequenceNode, `${moduleName}_subModuleProcessor`);

        // Now the output node
        const jointOutputNode = new EBTorchNode(new EBTorchModule(`nn.Identity`, []), [lengthNode, subModuleProcessor], `${moduleName}_jointOutputNode`);

        return {
            outputNode: jointOutputNode,
            outputTensorSchema: new EBTensorSchema({
                "type": "array",
                "variableName": `${moduleName}`,
                "items": itemOutputStack.outputTensorSchema
            }),
            additionalModules: [subModule].concat(itemOutputStack.additionalModules)
        };
    }


    /**
     * This method should generate the criterion for a schema
     *
     * @param {EBSchema} outputSchema The schema to generate the criterion for
     * @returns {object} An object with the following structure:
     *                      {
     *                          "outputCriterion": EBTorchModule || null
     *                      }
     */
    generateCriterion(outputSchema)
    {
        // Preliminary assertions
        assert(outputSchema.isArray);

        // Get the item criterion
        const itemCriterion = this.neuralNetworkComponentDispatch.generateCriterion(outputSchema.items);
        return new EBTorchModule("nn.ParallelCriterion", [], [
            new EBTorchModule("nn.EBSequenceLengthCriterion", []),
            new EBTorchModule("nn.SequencerCriterion", [itemCriterion])
        ]);
    }


    /**
     * Returns a JSON-Schema schema for this neural network component
     *
     * @returns {object} The JSON-Schema that can be used for validating the configuration for this neural network component.
     */
    static configurationSchema()
    {
        return {
            "id": "EBNeuralNetworkSequenceComponent.configurationSchema",
            "type": "object",
            "properties": {
                "layers": {
                    "type": "array",
                    "items": EBNeuralNetworkEditorModule.schema()
                },
                "enforceSequenceLengthLimit": {
                    "type": "boolean"
                },
                "maxSequenceLength": {
                    "type": "number"
                },
            }
        };
    }
}

module.exports = EBNeuralNetworkSequenceComponent;
