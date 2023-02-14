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

const EBArchitectureElement = require('./EBArchitectureElement'),
    EBSchema = require("../../models/EBSchema"),
    EBTensorSchema = require("../../models/EBTensorSchema"),
    EBTorchModule = require("./EBTorchModule"),
    underscore = require('underscore');

/**
 * This is a base class for various neural network components
 */
class EBNeuralNetworkComponentBase
{
    /**
     * Constructor.
     */
    constructor(neuralNetworkComponentDispatch)
    {
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
        throw new Error("Unimplemented");
    }


    /**
     * Method generates Lua code to create a tensor from the JSON of this variable
     *
     * @param {EBSchema} schema The schema to generate this conversion code for.
     * @param {string} name The name of the lua function to be generated.
     */
    generateTensorInputCode(schema, name)
    {
        throw new Error("Unimplemented");
    }


    /**
     * Method generates Lua code to turn a tensor back into a JSON
     *
     * @param {EBSchema} schema The schema to generate this conversion code for
     * @param {string} name The name of the Lua function to be generated
     */
    generateTensorOutputCode(schema, name)
    {
        throw new Error("Unimplemented");
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
        throw new Error("Unimplemented");
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
        throw new Error("Unimplemented");
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
        throw new Error("Unimplemented");
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
        throw new Error("Unimplemented");
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
        throw new Error("Unimplemented");
    }


    /**
     * This method can be used to generate a neural network which takes an arbitrary tensor schema
     * as its input, and reduces it down to a single summary vector
     *
     * @param {EBTensorSchema} tensorSchema The tensor schema that for the input.
     * @returns {object} An object containing two properties:
     *              {
     *                  module: EBTorchModule, // The torch module which will produce the summary of this sensor schema.
     *                  tensorSchema: EBTensorSchema // The resulting summary tensor schema. This will only ever be a tensor schema, never an object or array schema.
     *              }
     */
    static createSummaryModule(tensorSchema)
    {
        // If the tensor schema is already a tensor, then no transformation is needed
        if (tensorSchema.isTensor)
        {
            return {
                module: new EBTorchModule('nn.Identity'),
                tensorSchema: tensorSchema
            };
        }
        // For the array, we create a summary network for its items.
        else if (tensorSchema.isArray)
        {
            // First, run each of the items through summary network
            const itemSummaryModule = EBNeuralNetworkComponentBase.createSummaryModule(tensorSchema.items);
            const selectTableModule = new EBTorchModule('nn.SelectTable', [2]);
            const summaryModule = new EBTorchModule('nn.MapTable', [itemSummaryModule.module]);

            // Then take all the summaries and sum them
            const fixedResultModule = new EBTorchModule('nn.Sequential', [], [
                selectTableModule,
                summaryModule,
                new EBTorchModule('nn.CAddTable', [])
            ]);

            return {
                module: fixedResultModule,
                tensorSchema: itemSummaryModule.tensorSchema
            };
        }
        // For the object, we create a summary module for each property and then merge them together
        else if (tensorSchema.isObject)
        {
            const subModules = tensorSchema.properties.map((property) => EBNeuralNetworkComponentBase.createSummaryModule(property));

            // First, create a summary module for each corresponding property in the object
            const parallelModule = new EBTorchModule('nn.ParallelTable', [], subModules.map((subModule) => subModule.module));
            
            // Now join them all together
            let totalTensorSize = 0;
            subModules.forEach((subModule) =>
            {
                totalTensorSize += subModule.tensorSchema.tensorSize;
            });

            // Create a sequential that will then join all the outputs from the modules together
            let output = new EBTorchModule('nn.Sequential', [], [
                parallelModule,
                new EBTorchModule('nn.JoinTable', ["2"])
            ]);

            // Return the module along with the new tensor schema
            return {
                module: output,
                tensorSchema: EBTensorSchema.generateDataTensorSchema(totalTensorSize, 'joinedTensor')
            };
        }
        else
        {
            throw new Error("Unknown EBTensorSchema type");
        }
    }


    /**
     * This method can be used to generate code which will create an empty tensor table according to the given tensor schema
     *
     * @param {EBTensorSchema} tensorSchema The tensor schema to generate the code for
     * @param {string} name The name of the function to generate
     * @returns {string} The lua code to generate the empty tensor table
     */
    static generateEmptyTensorTableCode(tensorSchema, name)
    {
        let code = '';

        code += `local ${name} = function ()\n`;

        if (tensorSchema.isObject)
        {
            code += `    local emptyObject = {}\n`;
            tensorSchema.properties.forEach((property) =>
            {
                const subFunctionName = `${property.machineVariableName}_generateEmpty`;
                const subFunctionCode = EBNeuralNetworkComponentBase.generateEmptyTensorTableCode(property, subFunctionName);
                code += `    ${subFunctionCode.replace(/\n/g, "\n    ")}`;
                code += `table.insert(emptyObject, ${subFunctionName}())\n`;
            });

            code += `    return emptyObject\n`;
            code += `end\n`;
        }
        else if (tensorSchema.isTensor)
        {
            const tensorDimensions = tensorSchema.tensorDimensions.map((dimen) =>
            {
                return dimen.size;
            });
            
            code += `    local emptyTensor = torch.zeros(${tensorDimensions.join(", ")})`;
            code += `    return emptyTensor\n`;
            code += `end\n`;
        }
        else
        {
            throw new Error("Cant generate an empty object for a sequence tensor schema. We wouldn't know how long to make the sequence.");
        }
        
        return code;
    }



    /**
     * Returns a JSON-Schema schema for this neural network component
     *
     * @returns {object} The JSON-Schema that can be used for validating the configuration for this neural network component.
     */
    static configurationSchema()
    {
        throw new Error('Unimplemented');
    }
}

module.exports = EBNeuralNetworkComponentBase;
