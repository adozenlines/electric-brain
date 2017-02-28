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

const EBNeuralNetworkComponentBase = require('../../../shared/components/architecture/EBNeuralNetworkComponentBase'),
    EBTorchModule = require('../../../shared/models/EBTorchModule'),
    EBTorchNode = require('../../../shared/models/EBTorchNode'),
    EBTensorSchema = require('../../../shared/models/EBTensorSchema'),
    underscore = require('underscore');

/**
 * This is a base class for various neural network components
 */
class EBNeuralNetworkStringComponent extends EBNeuralNetworkComponentBase
{
    /**
     * Constructor
     */
    constructor(neuralNetworkComponentDispatch)
    {
        super(neuralNetworkComponentDispatch);
    }


    /**
     * Method returns the tensor schema for input data to the network
     *
     * @param {EBSchema} schema The regular schema from which we will determine the tensor schema
     * @returns {EBTensorSchema} The mapping of tensors.
     */
    getTensorSchema(schema)
    {
        return EBTensorSchema.generateDataTensorSchema(1, schema.variableName);
    }


    /**
     * Method generates Lua code to create a tensor from the JSON of this variable
     *
     * @param {EBSchema} schema The schema to generate this conversion code for
     * @param {string} name The name of the Lua function to be generated
     */
    generateTensorInputCode(schema, name)
    {
        let code = '';
        code += `local ${name} = function (input)\n`;
        code += `    local result = torch.zeros(1, 1)\n`;
        code += `    result[1][1] = input\n`;
        code += `    return result\n`;
        code += `end\n`;
        return code
    }


    /**
     * Method generates Lua code to turn a tensor back into a JSON
     *
     * @param {EBSchema} schema The schema to generate this conversion code for
     * @param {string} name The name of the Lua function to be generated
     */
    generateTensorOutputCode(schema, name)
    {
        let code = '';
        code += `local ${name} = function (input)\n`;
        code += `    return input[1][1][1]\n`;
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
        let code = '';

        code += `local ${name} = function (input)\n`;
        code += `    local batch = torch.zeros(#input,1)\n`;
        code += `    for k,v in pairs(input) do\n`;
        code += `        batch:narrow(1, k, 1):copy(input[k])\n`;
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
        let code = '';

        code += `local ${name} = function (input)\n`;
        code += `    local samples = {}\n`;
        code += `    for k=1,input:size()[1] do\n`;
        code += `        table.insert(samples, input:narrow(1, k, 1))\n`;
        code += `    end\n`;
        code += `    return samples\n`;
        code += `end\n`;

        return code;
    }


    /**
     * This method should generate an input stack for this variable
     *
     * @param {EBSchema} schema The schema to generate this stack for
     * @param {EBTorchNode} inputNode The input node for this variable
     * @returns {object} An object with the following structure:
     *                      {
     *                          "outputNode": EBTorchNode || null,
     *                          "outputTensorSchema": EBTensorSchema || null,
     *                          "additionalModules": [EBCustomModule]
     *                      }
     */
    generateInputStack(schema, inputNode)
    {
        return {
            outputNode: new EBTorchNode(new EBTorchModule("nn.Identity"), inputNode, `${schema.variableName}_inputStack`),
            outputTensorSchema: this.getTensorSchema(schema),
            additionalModules: []
        };
    }


    /**
     * This method should generate the output stack for this variable
     *
     * @param {EBSchema} outputSchema The schema to generate this output stack for
     * @param {EBTorchNode} inputNode The input node for this stack
     * @param {EBTensorSchema} inputTensorSchema The schema for the intermediary tensors from which we construct this output stack
     * @returns {object} An object with the following structure:
     *                      {
     *                          "outputNode": EBTorchNode || null,
     *                          "outputTensorSchema": EBTensorSchema || null,
     *                          "additionalModules": [EBCustomModule]
     *                      }
     */
    generateOutputStack(outputSchema, inputNode, inputTensorSchema)
    {
        // Variable name for this piece
        const variableName = outputSchema.variableName;

        // Get the tensor-schema for the output
        const outputTensorSchema = this.getTensorSchema(inputTensorSchema);

        // Create a summary module for the input tensor
        const summaryModule = this.createSummaryModule(inputTensorSchema);

        // Calculate the middle layer size as half way between input and output size
        const middleLayerSize = Math.min(1500, Math.max(summaryModule.tensorSchema.tensorSize / 2, 100));

        // Create the node in the graph for the summary module
        const summaryNode = new EBTorchNode(summaryModule.module, inputNode, `${variableName}_summaryNode`);

        const linearUnit = new EBTorchNode(new EBTorchModule("nn.Sequential", [], [
            new EBTorchModule("nn.Linear", [summaryModule.tensorSchema.tensorSize, middleLayerSize]),
            new EBTorchModule("nn.Tanh", []),
            new EBTorchModule("nn.Linear", [middleLayerSize, middleLayerSize]),
            new EBTorchModule("nn.Tanh", []),
            new EBTorchModule("nn.Linear", [middleLayerSize, outputTensorSchema.tensorSize])
        ]), summaryNode, `${variableName}_linearUnit`);

        return {
            outputNode: linearUnit,
            outputTensorSchema: outputTensorSchema,
            additionalModules: []
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
        // Create MSE module
        return new EBTorchModule("nn.MSECriterion");
    }
}

module.exports = EBNeuralNetworkStringComponent;
