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
    EBTorchModule = require('../../../shared/components/architecture/EBTorchModule'),
    EBTorchNode = require('../../../shared/components/architecture/EBTorchNode'),
    EBTensorSchema = require('../../../shared/models/EBTensorSchema'),
    underscore = require('underscore');

/**
 * This is a base class for various neural network components
 */
class EBNeuralNetworkObjectComponent extends EBNeuralNetworkComponentBase
{
    /**
     * Constructor. Takes a neural network component dispatch
     */
    constructor(neuralNetworkComponentDispatch)
    {
        super(neuralNetworkComponentDispatch);
        this.variableName = 'a';
        this.machineVariableName ='b';
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
        const children = schema.children;

        // Go through all of the property tensors.
        const childProperties = [];
        children.forEach((childSchema) =>
        {
            const tensorSchema = this.neuralNetworkComponentDispatch.getTensorSchema(childSchema);
            childProperties.push(tensorSchema);
        });

        return new EBTensorSchema({
            "type": "object",
            "variableName": schema.variableName,
            "properties": childProperties
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
        // First, ensure that the schema we are dealing with is an object
        assert(schema.isObject);

        let code = '';
        let children = schema.children;

        code += `local ${name} = function (input)\n`;
        code += `    local transformed = {}\n`;


        // For each property, generate its input code, and then call that and
        // add it to the array
        children.forEach((subSchema) =>
        {
            const subFunctionName = `generateTensor_${subSchema.machineVariableName}`;
            let subSchemaCode = this.neuralNetworkComponentDispatch.generateTensorInputCode(subSchema, subFunctionName);
            subSchemaCode = `    ${subSchemaCode.replace(/\n/g, "\n    ")}`;
            code += subSchemaCode;

            code += `table.insert(transformed, ${subFunctionName}(input["${subSchema.variableName}"]))\n`;
        });


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
        // First, ensure that the schema we are dealing with is an object
        assert(schema.isObject);

        let code = '';
        let children = schema.children;

        code += `local ${name} = function (input)\n`;
        code += `    local transformed = {}\n`;

        let tablePosition = 1;

        // For all remaining properties, we take them from the table or array
        children.forEach((subSchema) =>
        {
            const subFunctionName = `generateJSON_${subSchema.machineVariableName}`;
            let subSchemaCode = this.neuralNetworkComponentDispatch.generateTensorOutputCode(subSchema, subFunctionName);
            subSchemaCode = `    ${subSchemaCode.replace(/\n/g, "\n    ")}`;
            code += subSchemaCode;

            code += `transformed["${subSchema.variableName}"] = ${subFunctionName}(input[${tablePosition}])\n`;

            tablePosition += 1;
        });

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
        // First, ensure that the schema we are dealing with is an object
        assert(schema.isObject);

        let code = '';
        let children = schema.children;

        code += `local ${name} = function (input)\n`;
        code += `    local batch = {}\n`;

        let tablePosition = 0;

        // For all remaining properties, we take them from the table or array
        children.forEach((subSchema) =>
        {
            const subFunctionName = `prepareBatch_${subSchema.machineVariableName}`;
            let subSchemaCode = this.neuralNetworkComponentDispatch.generatePrepareBatchCode(subSchema, subFunctionName);
            subSchemaCode = `    ${subSchemaCode.replace(/\n/g, "\n    ")}`;
            code += subSchemaCode;

            code += `local values_${subSchema.machineVariableName} = {}\n`;
            code += `    for k,v in pairs(input) do\n`;
            code += `        table.insert(values_${subSchema.machineVariableName}, input[k][${tablePosition + 1}])\n`;
            code += `    end\n`;

            code += `    batch[${tablePosition + 1}] = ${subFunctionName}(values_${subSchema.machineVariableName})\n`;

            tablePosition += 1;
        });

        code += `   return batch\n`;
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
        // First, ensure that the schema we are dealing with is an object
        assert(schema.isObject);

        let code = '';
        let children = schema.children;

        code += `local ${name} = function (input)\n`;
        code += `    local samples = {}\n`;
        code += `    local decomposed = {}\n`;

        let tablePosition = 1;

        // For all remaining properties, we take them from the table or array
        children.forEach((subSchema) =>
        {
            const subFunctionName = `unwindBatch_${subSchema.machineVariableName}`;
            let subSchemaCode = this.neuralNetworkComponentDispatch.generateUnwindBatchCode(subSchema, subFunctionName);
            subSchemaCode = `    ${subSchemaCode.replace(/\n/g, "\n    ")}`;
            code += subSchemaCode;

            code += `decomposed[${tablePosition}] = ${subFunctionName}(input[${tablePosition}])\n`;

            code += `    for s=1,#decomposed[${tablePosition}] do\n`;
            code += `        if not samples[s] then\n`;
            code += `            samples[s] = {}\n`;
            code += `        end\n`;
            code += `        samples[s][${tablePosition}] = decomposed[${tablePosition}][s]\n`;
            code += `    end\n`;

            tablePosition += 1;
        });

        code += `   return samples\n`;
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
        assert(schema.isObject);
        
        const moduleName = `${rootName}_${schema.machineVariablePath || "root"}`;
        
        // For each variable, create a node that pulls it out of the input
        const children = schema.children;
        const outputs = [];
        children.forEach((childSchema, childIndex) =>
        {
            const selectFieldNode = new EBTorchNode(new EBTorchModule("nn.SelectTable", [childIndex + 1]), inputNode, `${moduleName}_selectField_${childSchema.machineVariableName}`);

            // Get the input stack for the given variable
            const inputStack = this.neuralNetworkComponentDispatch.generateInputStack(childSchema, selectFieldNode, rootName);

            outputs.push(inputStack);
        });

        let outputNode = null;
        if (outputs.length > 1)
        {
            outputNode = new EBTorchNode(new EBTorchModule("nn.Identity"), outputs.map((output) => output.outputNode), `${moduleName}_outputs`);
        }
        else
        {
            outputNode = new EBTorchNode(new EBTorchModule("nn.EBWrapTable"), outputs[0].outputNode, `${moduleName}_outputs`);
        }

        // Go through all of the property tensors.
        const childProperties = outputs.map((output) => output.outputTensorSchema);

        return {
            outputNode: outputNode,
            outputTensorSchema: new EBTensorSchema({
                "type": "object",
                "variableName": moduleName,
                "properties": childProperties
            }),
            additionalModules: underscore.flatten(outputs.map((output) => output.additionalModules))
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
        assert(outputSchema.isObject);

        const moduleName = outputSchema.machineVariableName || "root";

        // For each variable, create the output stack
        const children = outputSchema.children;
        const outputs = [];
        children.forEach((childSchema, childIndex) =>
        {
            // Get the output stack for the given variable
            const outputStack = this.neuralNetworkComponentDispatch.generateOutputStack(childSchema, inputNode, inputTensorSchema, rootName);
            outputs.push(outputStack);
        });

        let outputNode = null;
        if (outputs.length > 1)
        {
            outputNode = new EBTorchNode(new EBTorchModule("nn.Identity"), outputs.map((output) => output.outputNode), `${moduleName}_outputs`);
        }
        else
        {
            outputNode = new EBTorchNode(new EBTorchModule("nn.EBWrapTable"), outputs[0].outputNode, `${moduleName}_outputs`);
        }

        // Go through all of the property tensors.
        const childProperties = outputs.map((output) => output.outputTensorSchema);

        return {
            outputNode: outputNode,
            outputTensorSchema: new EBTensorSchema({
                "type": "object",
                "variableName": moduleName,
                "properties": childProperties
            }),
            additionalModules: underscore.flatten(outputs.map((output) => output.additionalModules))
        };
    }


    /**
     * This method should generate the criterion for a schema
     *
     * @param {EBSchema} outputSchema The schema to generate the criterion for
     * @returns {EBTorchModule} A module that can be used as a criterion
     */
    generateCriterion(outputSchema)
    {
        // Preliminary assertions
        assert(outputSchema.isObject);

        // For each variable, create the criterion
        const children = outputSchema.children;
        const criterions = [];
        children.forEach((childSchema, childIndex) =>
        {
            // Get the sub-criterion
            const subCriterion = this.neuralNetworkComponentDispatch.generateCriterion(childSchema);
            criterions.push(subCriterion);
        });


        return new EBTorchModule("nn.ParallelCriterion", [], criterions);
    }


    /**
     * Returns a JSON-Schema schema for this neural network component
     *
     * @returns {object} The JSON-Schema that can be used for validating the configuration for this neural network component.
     */
    static configurationSchema()
    {
        return {
            "id": "EBNeuralNetworkObjectComponent.configurationSchema",
            "type": "object",
            "properties": {}
        };
    }
}

module.exports = EBNeuralNetworkObjectComponent;
