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
    EBClassFactory = require("../components/EBClassFactory"),
    underscore = require('underscore');

/**
 *  This class represents a tensor schema. Its like a schema, but specifically designed to map
 *  the tensors that flow within the neural network.
 */
class EBTensorSchema
{
    /**
     * This creates a new tensor schema object from the raw tensor schema data
     *
     * @param {rawTensorSchema} rawTensorSchema A raw tensor schema object
     */
    constructor(rawTensorSchema)
    {
        assert.deepEqual([], EBTensorSchema.validate(rawTensorSchema));

        assert(rawTensorSchema.type);
        assert(!underscore.isUndefined(rawTensorSchema.variableName));
        
        this.classType = "EBTensorSchema";

        this.type = rawTensorSchema.type;
        this.variableName = rawTensorSchema.variableName;
        this.tensorDimensions = rawTensorSchema.tensorDimensions;
        this.tensorMap = rawTensorSchema.tensorMap;

        if (rawTensorSchema.items)
        {
            this.items = new EBTensorSchema(rawTensorSchema.items);
        }

        if (rawTensorSchema.properties)
        {
            this.properties = rawTensorSchema.properties.map((property) => new EBTensorSchema(property));
        }
    }

    /**
     * If this schema is a tensor-schema, then this will return the total size of the tensor.
     *
     * It will otherwise return 0.
     *
     * @return {number} The size of this tensor
     */
    get tensorSize()
    {
        if (this.type === 'tensor')
        {
            let size = 1;
            this.tensorDimensions.forEach((dimension) =>
            {
                size *= dimension.size;
            });
            return size;
        }
        else
        {
            return 0;
        }
    }

    /**
     * Assuming this is an object schema, this will return the index of the property with
     * the given name within this tensor schema.
     *
     * Returns null of the property is not found.
     *
     * If this EBTensorSchema is an array or tensor schema, then this will always return null.
     *
     * @param {string} name The name of the property to search
     * @return {number} The index of this property
     */
    getPropertyIndex(name)
    {
        let index = null;
        if (this.type === 'object')
        {
            this.properties.forEach((property, propertyIndex) =>
            {
                if (property.variableName === name)
                {
                    index = propertyIndex;
                }
            });
        }

        return index;
    }

    /**
     * Returns the machine variable name for this tensor schema
     *
     * @return {string} A string which is the modified version of the variable name
     */
    get machineVariableName()
    {
        return this.variableName.replace(/\W/g, "");
    }

    /**
     * Returns true if this schema is representing a tensor
     *
     * @return {boolean} True/false if this schema represents a tensor
     */
    get isTensor()
    {
        return this.type === 'tensor';
    }

    /**
     * Returns true if this schema represents an object, which in Lua is represented by a table
     *
     * @return {boolean} True/false if this schema represents an object
     */
    get isObject()
    {
        return this.type === 'object';
    }

    /**
     * Returns true if this schema represents an array, which in Lua is represented by a table
     *
     * @return {boolean} True/false if this schema represents an array
     */
    get isArray()
    {
        return this.type === 'array';
    }

    /**
     * This method returns a function which can convert this tensor schema into GPU
     *
     * #param {string} name The name of the function to be generated
     *
     * @return {boolean} True/false if this schema represents an array
     */
    generateLocalizeFunction(name)
    {
        let code = '';

        code += `local ${name} = function (value)\n`;

        if (this.isObject)
        {
            this.properties.forEach((property, index) =>
            {
                const subFunctionName = `${property.machineVariableName}_localize`;
                const subFunctionCode = property.generateLocalizeFunction(subFunctionName);
                code += `    ${subFunctionCode.replace(/\n/g, "\n    ")}`;
                code += `value[${index + 1}] = ${subFunctionName}(value[${index + 1}])\n`;
            });

            code += `    return value\n`;
            code += `end\n`;
        }
        else if (this.isArray)
        {
            const subFunctionName = `${name}_localizeItems`;
            const subFunctionCode = this.items.generateLocalizeFunction(subFunctionName);
            code += `    ${subFunctionCode.replace(/\n/g, "\n    ")}`;
            code += `    for n=1,#value[2] do\n`;
            code += `       value[2][n] = ${subFunctionName}(value[2][n])\n`;
            code += `    end\n`;
            code += `    return value\n`;
            code += `end\n`;
        }
        else if (this.isTensor)
        {
            code += `    if torch.type(value) == 'table' then\n`;
            code += `       return value\n`;
            code += `    end\n`;
            code += `    return value:cuda()\n`;
            code += `end\n`;
        }
        return code;
    }

    /**
     * A quick convenience for generating a tensor-schema containing a data tensor of the given size.
     *
     * @param {number} size The size of the data for the output of the tensor schema
     * @param {string} name The name of the variable for this tensor schema
     *
     * @return {EBTensorSchema} A new tensor schema object
     */
    static generateDataTensorSchema(size, name)
    {
        return new EBTensorSchema({
            "type": "tensor",
            "variableName": name,
            "tensorDimensions": [
                {
                    "size": 1,
                    "label": "batch"
                },
                {
                    "size": size,
                    "label": "data"
                }
            ],
            "tensorMap": {
                [name]: {
                    "start": 1,
                    "size": size
                }
            }
        });
    }


    /**
     * Returns a JSON-Schema schema for EBTensorSchema
     *
     * This schema is technically recursive.
     *
     * @returns {object} The JSON-Schema that can be used for validating this architecture in its raw form
     */
    static schema()
    {
        return {
            "id": "EBTensorSchema",
            "$schema": "EBTensorSchema",
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "enum": ["tensor", "array", "object"]
                },
                "variableName": {"type": "string"},
                "tensorDimensions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "size": {"type": "number"},
                            "label": {"type": "string"}
                        }
                    }
                },
                "tensorMap": {
                    "type": "object",
                    "additionalProperties": {
                        "type": "object",
                        "properties": {
                            "start": {"type": "number"},
                            "size": {"type": "number"}
                        }
                    }
                },
                "items": {"$ref": "#"},
                "properties": {
                    "items": {"$ref": "#"}
                }
            }
        };
    }


    /**
     * Returns a validation function for EBTensorSchema
     *
     * @returns {function} An AJV validation function
     */
    static validator()
    {
        if (!EBTensorSchema._validationFunction)
        {
            const ajv = new Ajv({
                "allErrors": true
            });

            EBTensorSchema._validationFunction = ajv.compile(EBTensorSchema.schema());
        }

        return EBTensorSchema._validationFunction;
    }


    /**
     * This method validates the given object. Returns an array with the errors
     *
     * @param {object} object The object to be validated
     * @returns {[object]} An array containing any detected errors. Will be empty if the object is valid.
     */
    static validate(object)
    {
        const validationFunction = EBTensorSchema.validator();
        const valid = validationFunction(object);
        if (valid)
        {
            return [];
        }
        else
        {
            return validationFunction.errors;
        }
    }
}

EBClassFactory.registerClass('EBTensorSchema', EBTensorSchema, EBTensorSchema.schema());

module.exports = EBTensorSchema;
