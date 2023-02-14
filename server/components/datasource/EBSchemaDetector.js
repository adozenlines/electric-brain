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
    EBFieldMetadata = require("../../../shared/models/EBFieldMetadata"),
    models = require('../../../shared/models/models'),
    path = require('path'),
    Promise = require('bluebird'),
    underscore = require('underscore');

/**
 *  EBSchemaDetector is a tool for automatically detecting the schema of provided data.
 *
 *  It works by processing units of data in a map-reduce like fashion.
 */
class EBSchemaDetector
{
    /**
     * Creates a EBSchemaDetector
     * 
     * @param {EBApplicationBase} application The global application object.
     */
    constructor(application)
    {
        this.fieldAccumulators = new Map();
        this.interpretationChains = new Map();
        this.exampleValues = new Map();
        this.objectsAccumulated = 0;

        this.interpretations = [];
        this.interpretationMap = {};
        application.plugins.forEach((plugin) =>
        {
            underscore.values(plugin.interpretations).forEach((interpretation) =>
            {
                const initialized = new interpretation();

                this.interpretations.push(initialized);
                this.interpretationMap[initialized.name] = initialized;
            });
        });
    }


    /**
     * This method will determine the best interpretation chain for the given value.
     *
     * @param {*} value Can be practically anything.
     * @return {Promise} A promise that that resolves to an array with the sequence of interpretations that this value should go through
     */
    detectInterpretationChain(value)
    {
        const analyze = (value, currentInterpretation) =>
        {
            if (!currentInterpretation)
            {
                // Determine the starting interpretation based entirely on the fields type
                if (underscore.isString(value))
                {
                    return Promise.resolve(this.interpretationMap['string']);
                }
                else if (underscore.isBoolean(value))
                {
                    return Promise.resolve(this.interpretationMap['boolean']);
                }
                else if (underscore.isNumber(value))
                {
                    return Promise.resolve(this.interpretationMap['number']);
                }
                else if (value instanceof Buffer)
                {
                    return Promise.resolve(this.interpretationMap['binary']);
                }
                else if (underscore.isArray(value))
                {
                    return Promise.resolve(this.interpretationMap['sequence']);
                }
                else if (underscore.isObject(value))
                {
                    return Promise.resolve(this.interpretationMap['object']);
                }
                else if (underscore.isNull(value))
                {
                    return Promise.resolve(this.interpretationMap['string']);
                }
                else
                {
                    throw new Error("null interpretation here?");
                }
            }
            else
            {
                // Find all of the interpretations that are downstream from this one
                const availableInterpretations = underscore.filter(this.interpretations, (interpretation) =>
                {
                    const upstream = interpretation.getUpstreamInterpretations();
                    return upstream.indexOf(currentInterpretation) !== -1;
                });

                // Find a suitable interpretation
                return Promise.map(availableInterpretations, (interpretation) =>
                {
                    return interpretation.checkValue(value).then((result) =>
                    {
                        return {
                            result: result,
                            interpretation: interpretation
                        };
                    });
                }).then((interpretationResults) =>
                {
                    // If there are multiple possible interpretations, then perhaps it needs to be automatically detected
                    // which one to go with
                    const successfulInterpretations = underscore.filter(interpretationResults, (interpretationResult) =>
                    {
                        return interpretationResult.result;
                    });

                    if (successfulInterpretations.length === 0)
                    {
                        return null;
                    }
                    else
                    {
                        return successfulInterpretations[0].interpretation;
                    }
                });
            }
        };

        const recurse = (value, currentInterpretation) =>
        {
            return analyze(value, currentInterpretation).then((interpretation) =>
            {
                if (!interpretation)
                {
                    return [];
                }
                else
                {
                    const chain = [interpretation];
                    return interpretation.transformValue(value).then((transformed) =>
                    {
                        return recurse(transformed, chain[0].name).then((subChain) =>
                        {
                            return chain.concat(subChain);
                        });
                    });
                }
            });
        };


        return recurse(value, null);
    }


    /**
     *  This method will accumulate the given object into the internal buffer.
     *
     *  @param {object} object The object to be analyzed by the schema detector
     *  @param {boolean} [keepForExample] Whether or not the values on the object
     *                                    should be kept for as examples. Defaults
     *                                    to false.
     *  @return {Promise} A promise that will resolve after the object has been fully accumulated.
     */
    accumulateObject(object, keepForExample)
    {
        /**
         * This function is used internally to recurse through a JSON object
         *
         * @param {string} rootVariablePath The variablePath leading from the root of the object down to this field
         * @param {*} value The value being analyzed
         * @returns {Promise} A promise that will resolve when the value has been accumulated.
         */
        const recurse = (rootVariablePath, value) =>
        {
            if (!this.interpretationChains.has(rootVariablePath))
            {
                this.interpretationChains.set(rootVariablePath, {});
            }

            if (!this.fieldAccumulators.has(rootVariablePath))
            {
                this.fieldAccumulators.set(rootVariablePath, {});
            }

            if (!this.exampleValues.has(rootVariablePath))
            {
                this.exampleValues.set(rootVariablePath, {});
            }

            return this.detectInterpretationChain(value).then((chain) =>
            {
                const chainId = chain.map((chain) => chain.name).join("=>");
                const lastInterpretation = chain[chain.length - 1];

                // Record this interpretation chain for this value
                if(!this.interpretationChains.get(rootVariablePath)[chainId])
                {
                    this.interpretationChains.get(rootVariablePath)[chainId] = 0;
                }
                this.interpretationChains.get(rootVariablePath)[chainId] += 1;

                // // Now record data for this interpretation
                if (!this.fieldAccumulators.get(rootVariablePath)[lastInterpretation.name])
                {
                    this.fieldAccumulators.get(rootVariablePath)[lastInterpretation.name] = this.interpretationMap[lastInterpretation.name].createFieldAccumulator();
                }
                if (!this.exampleValues.get(rootVariablePath)[lastInterpretation.name])
                {
                    this.exampleValues.get(rootVariablePath)[lastInterpretation.name] = [];
                }

                // Put the variable through the transformation for each interpretation, and on the last
                // one, we accumulate it for statistical purposes
                let currentValue = value;
                return Promise.each(chain, (interpretation) =>
                {
                    return interpretation.transformValue(currentValue).then((transformedValue) =>
                    {
                        currentValue = transformedValue;
                    });
                }).then(() =>
                {
                    return this.fieldAccumulators.get(rootVariablePath)[lastInterpretation.name].accumulateValue(currentValue);
                }).then(() =>
                {
                    const examplesArray = this.exampleValues.get(rootVariablePath)[lastInterpretation.name];
                    if (keepForExample)
                    {
                        return lastInterpretation.transformExample(currentValue).then((transformed) =>
                        {
                            if (transformed !== null)
                            {
                                examplesArray.push(transformed);
                            }
                        });
                    }
                    else
                    {
                        return Promise.resolve();
                    }
                }).then(() =>
                {
                    // Recurse into children.
                    if (underscore.isArray(currentValue))
                    {
                        return Promise.each(currentValue, (arrayValue) =>
                        {
                            return recurse(`${rootVariablePath}.[]`, arrayValue);
                        });
                    }
                    else if (underscore.isObject(currentValue) && !(currentValue instanceof Buffer))
                    {
                        const fields = Object.keys(currentValue);
                        return Promise.each(fields, (field) =>
                        {
                            let variablePath = rootVariablePath ? `${rootVariablePath}.${field}` : `${field}`;
                            return recurse(variablePath, currentValue[field]);
                        });
                    }
                });
            });
        };

        return recurse("", object).then(() =>
        {
            this.objectsAccumulated += 1;
        });
    }


    /**
     *  This method will return the schema based on the current set of accumulated objects.
     *
     *  @returns {EBSchema} The schema that results from all the objects accumulated thus far
     */
    getSchema()
    {
        const fields = [];
        const mappedFields = {};

        // First step, we create a flat list of values
        for (const field of this.fieldAccumulators.keys())
        {
            const interpretationChains = this.interpretationChains.get(field);

            // Determine which interpretation chain is the dominant one
            const dominantInterpretationChain = underscore.max(Object.keys(interpretationChains), (chain) => interpretationChains[chain]).split('=>');
            const mainInterpretationName = dominantInterpretationChain[dominantInterpretationChain.length - 1];
            const mainInterpretation = this.interpretationMap[mainInterpretationName];
            const fieldAccumulator = this.fieldAccumulators.get(field)[mainInterpretationName];
            
            const fieldMetadata = new EBFieldMetadata();
            const fieldPortions = field.split('.');
            fieldMetadata.types = [mainInterpretation.getJavascriptType()];
            fieldMetadata.examples = this.exampleValues.get(field)[mainInterpretationName];
            fieldMetadata.variableName = fieldPortions[fieldPortions.length - 1];
            fieldMetadata.variablePath = field;
            fieldMetadata.interpretationChain = dominantInterpretationChain;
            fieldMetadata.mainInterpretation = mainInterpretationName;
            fieldMetadata.statistics = fieldAccumulator.getFieldStatistics();
            
            // Only include this in fields if its a field
            if (fieldMetadata.types.indexOf('object') === -1 && fieldMetadata.types.indexOf('array') === -1)
            {
                fields.push({
                    name: field,
                    metadata: fieldMetadata
                });
            }

            mappedFields[`${field}.`] = fieldMetadata;
        }

        const getFieldHead = (fieldName) =>
        {
            if (fieldName.indexOf(".") !== -1)
            {
                return fieldName.substr(0, fieldName.indexOf('.'));
            }
            else
            {
                return fieldName;
            }
        };

        // Now we need to recursively assemble a schema
        const assembleSchema = (root, allSchemaFields, depth) =>
        {
            let schemaFields = allSchemaFields;

            const variablePath = root.substr(0, root.length - 1);
            const schema = {
                title: variablePath,
                metadata: mappedFields[root]
            };

            const removeRoot = (id) =>
            {
                return id.substr(root.length);
            };

            // First, we need to decide whether the root is an object, array, or some native type
            if (schemaFields.length === 1 && removeRoot(schemaFields[0].name).indexOf('.') === -1 && !(/\[\]\.$/g.test(root)))
            {
                schema.type = schemaFields[0].metadata.types;
                schema.metadata = schemaFields[0].metadata;
                return schema;
            }
            else if (schemaFields.length === 0)
            {
                return {};
            }

            // Otherwise, we need to remove any fields that refer
            // directly to the root, if they exist
            schemaFields = underscore.filter(schemaFields, (field) => (`${field.name}.` !== root));

            // Decide whether we are dealing with an object or an array
            if (getFieldHead(removeRoot(schemaFields[0].name)) === '[]')
            {
                // Its an array!
                schema.type = ['array'];

                // Build up a schema for the array items.
                schema.items = assembleSchema(`${root}[].`, schemaFields, depth + 1);
            }
            else
            {
                schema.type = ['object'];

                // Group the fields by the root of their name
                const groupedFields = underscore.groupBy(schemaFields, (field) => getFieldHead(removeRoot(field.name)));

                // Now for each root, create a new schema entry under properties
                schema.properties = {};
                Object.keys(groupedFields).forEach((fieldRoot) =>
                {
                    if (fieldRoot === "")
                    {
                        return;
                    }

                    const subFields = groupedFields[fieldRoot];
                    schema.properties[fieldRoot] = assembleSchema(`${root}${fieldRoot}.`, subFields, depth + 1);
                });
            }

            return schema;
        };

        const sortedFields = underscore.sortBy(fields, (field) => (field.name));
        const schema = assembleSchema("", sortedFields, 1);

        return new models.EBSchema(schema);
    }
}

module.exports = EBSchemaDetector;
