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
class EBNeuralNetworkWordComponent extends EBNeuralNetworkComponentBase
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
        return EBTensorSchema.generateDataTensorSchema(300, schema.variableName);
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
        code += `    local tensor = torch.ByteTensor(#input)\n`;
        code += `    for n=1,#input do\n`;
        code += `       tensor[n] = string.byte(input, n)\n`;
        code += `    end\n`;
        code += `    return tensor\n`;
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
        code += `    return input\n`;
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
        code += `    return input\n`;
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
        code += `    return input\n`;
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
            outputNode: new EBTorchNode(new EBTorchModule("nn.EBWordEmbedder", [10000]), inputNode, `${schema.machineVariableName}_inputStack`),
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
        throw new Error("No output stack yet!");
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

module.exports = EBNeuralNetworkWordComponent;
