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
    Ajv = require('ajv'),
    assert = require('assert'),
    Promise = require('bluebird'),
    underscore = require('underscore');

/**
 *  This is registers all of the available EBDataSourcePlugins and will dispatch the methods
 *  to the appropriate plugin depending on the type of data source.
 */
class EBNeuralNetworkComponentDispatch
{
    /**
     * Creates an EBNeuralNetworkComponentDispatch object.
     */
    constructor()
    {
        this.plugins = {};
        this.configurationValidators = {};
        this.ajv = new Ajv({
            "allErrors": true
        });
    }

    /**
     * This method returns a list of all neural network components
     *
     * @return {[EBNeuralNetworkComponentBase]} Returns all of the neural network components
     */
    getSupportedDataSources(type, plugin)
    {
        return underscore.values(this.plugins);
    }

    /**
     * This method registers a plugin with the dispatch.
     *
     * @param {string} type The machine name of the data source type
     * @param {EBNeuralNetworkComponent} plugin The plugin to be registered.
     */
    registerPlugin(type, plugin)
    {
        this.plugins[type] = plugin;
        this.configurationValidators[type] = this.ajv.compile(plugin.constructor.configurationSchema());
    }

    /**
     * This method gets the correct neural network plugin for the given EBSchema
     */
    getPluginForSchema(schema)
    {
        let plugin;
        let validationFunction;
        if (schema.isObject)
        {
            plugin = this.plugins['object'];
            validationFunction = this.configurationValidators['object'];
        }
        else if (schema.isArray)
        {
            plugin = this.plugins['sequence'];
            validationFunction = this.configurationValidators['sequence'];
        }
        else if (schema.enum)
        {
            plugin = this.plugins['classification'];
            validationFunction = this.configurationValidators['classification'];
        }
        else if (schema.isNumber)
        {
            plugin = this.plugins['number'];
            validationFunction = this.configurationValidators['number'];
        }
        else if (schema.metadata.mainInterpretation === 'image')
        {
            plugin = this.plugins['image'];
            validationFunction = this.configurationValidators['image'];
        }
        else if (schema.isString)
        {
            plugin = this.plugins['word'];
            validationFunction = this.configurationValidators['word'];
        }
        else
        {
            throw new Error(`Unknown plugin for EBSchema: ${schema.toString()}`);
        }
        
        // Validate that the schema has a component configuration
        if (!schema.configuration.component)
        {
            assert.fail(schema.configuration.component, {}, `There was no neural network component configuration provided for ${schema}`);
        }
        
        // Ensure that the configuration matches the components schema
        const valid = validationFunction(schema.configuration.component);
        if (valid)
        {
            return plugin;
        }
        else
        {
            assert.fail(validationFunction.errors, [], `Validation of the neural network component failed. This is critical for core neural network generation functions:\n${JSON.stringify(validationFunction.errors, null, 4)}`);
        }
    }


    /**
     * Method returns the tensor schema for input data to the network
     *
     * @param {EBSchema} schema The regular schema from which we will determine the tensor schema
     * @returns {EBTensorSchema} The mapping of tensors.
     */
    getTensorSchema(schema)
    {
        return this.getPluginForSchema(schema).getTensorSchema(schema);
    }


    /**
     * Method returns the size of the fixed input tensor for a given schema
     *
     * @param {EBSchema} schema The schema to get the tensor size of
     * @returns {number} The size of the tensor
     */
    getInputTensorSize(schema)
    {
        return this.getPluginForSchema(schema).getInputTensorSize(schema);
    }


    /**
     * Method returns the size of the table outputs for the given schema
     *
     * @param {EBSchema} schema The schema to get the table size of
     * @returns {number} The size of the table
     */
    getInputTableSize(schema)
    {
        return this.getPluginForSchema(schema).getInputTableSize(schema);
    }


    /**
     * Method generates Lua code to create a tensor from the JSON of this variable
     *
     * @param {EBSchema} schema The schema to generate this conversion code for.
     * @param {string} name The name of the lua function to be generated.
     */
    generateTensorInputCode(schema, name)
    {
        if (!name)
        {
            name = 'generateTensor';
        }
        return this.getPluginForSchema(schema).generateTensorInputCode(schema, name);
    }

    /**
     * Method generates Lua code to turn a tensor back into a JSON
     *
     * @param {EBSchema} schema The schema to generate this conversion code for
     * @param {string} name The name of the Lua function to be generated
     */
    generateTensorOutputCode(schema, name)
    {
        if (!name)
        {
            name = 'generateJSON';
        }
        return this.getPluginForSchema(schema).generateTensorOutputCode(schema, name);
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
        if (!name)
        {
            name = 'prepareBatch';
        }
        return this.getPluginForSchema(schema).generatePrepareBatchCode(schema, name);
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
        if (!name)
        {
            name = 'unwindBatch';
        }
        return this.getPluginForSchema(schema).generateUnwindBatchCode(schema, name);
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
        return this.getPluginForSchema(schema).generateInputStack(schema, inputNode, rootName);
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
        return this.getPluginForSchema(outputSchema).generateOutputStack(outputSchema, inputNode, inputTensorSchema, rootName);
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
        return this.getPluginForSchema(outputSchema).generateCriterion(outputSchema);
    }
}

module.exports = EBNeuralNetworkComponentDispatch;
