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
    EBFieldAnalysisAccumulatorBase = require('./../../../server/components/datasource/EBFieldAnalysisAccumulatorBase'),
    EBFieldMetadata = require('../../../shared/models/EBFieldMetadata'),
    EBInterpretationBase = require('./../../../server/components/datasource/EBInterpretationBase'),
    EBNeuralNetworkTemplateGenerator = require("../../../shared/components/EBNeuralNetworkTemplateGenerator"),
    EBSchema = require('../../../shared/models/EBSchema'),
    EBValueHistogram = require("../../../shared/models/EBValueHistogram"),
    underscore = require('underscore');

/**
 * The string interpretation is used for all strings.
 */
class EBBooleanInterpretation extends EBInterpretationBase
{
    /**
     * Constructor. Requires the interpretation registry in order to recurse properly
     *
     * @param {EBInterpretationRegistry} interpretationRegistry The registry
     */
    constructor(interpretationRegistry)
    {
        super('boolean');
        this.interpretationRegistry = interpretationRegistry;
    }


    /**
     * This method should return the list of interpretations that this interpretation is dependent
     * on. This interpretation won't be checked unless the dependent interpretation is the next
     * one up in the chain.
     *
     * If the list of dependencies is empty, then this interpretation is assumed to be able to
     * operate directly on raw-values from JSON.
     *
     * @return [String] An array of strings with the type-names for each of the higher interpretations
     */
    getUpstreamInterpretations()
    {
        return [];
    }



    /**
     * This method returns the raw javascript type of value that this interpretation applies to.
     *
     * @return {string} Can be one of: 'object', 'array', 'number', 'string', 'boolean', 'binary'
     */
    getJavascriptType()
    {
        return 'boolean';
    }



    /**
     * This method should look at the given value and decide whether it can be handled by this
     * interpretation.
     *
     * @param {*} value Can be practically anything.
     * @return {Promise} A promise that resolves to either true or false on whether that value
     *                   can be handled by that interpretation.
     */
    checkValue(value)
    {
        const acceptableStringValues = [
            'true',
            'false'
        ];

        // Is it a string and its contents look booleanish
        if (underscore.isString(value) && acceptableStringValues.indexOf(value.toLowerCase()) !== -1)
        {
            return Promise.resolve(true);
        }
        // Is it directly just a boolean value
        else if (underscore.isBoolean(value))
        {
            return Promise.resolve(true);
        }
        else
        {
            return Promise.resolve(false);
        }
    }



    /**
     * This method should transform a given schema for a value following this interpretation.
     * It should return a new schema for the interpreted version.
     *
     * @param {EBSchema} schema The schema for a field that wants to be interpreted by this interpretation.
     * @return {Promise} A promise that resolves to a new EBSchema object.
     */
    transformSchema(schema)
    {
        return Promise.resolve(schema);
    }




    /**
     * This method should transform a given value, assuming its following this interpretation.
     *
     * @param {*} value The value to be transformed
     * @return {Promise} A promise that resolves to a new value.
     */
    transformValue(value)
    {
        return Promise.resolve(value);
    }




    /**
     * This method should transform an example into a value that is small enough to be
     * stored with the schema and shown on the frontend. Information can be destroyed
     * in this transformation in order to allow the data to be stored easily.
     *
     * @param {*} value The value to be transformed
     * @return {Promise} A promise that resolves to a new object that is similar to the old one to a human, but with size truncated for easy storage.
     */
    transformExample(value)
    {
        return Promise.resolve(value);
    }


    /**
     * This method should transform the given schema for input to the neural network.
     *
     * @param {EBSchema} schema The schema to be transformed
     * @return {Promise} A promise that resolves to a new value.
     */
    transformSchemaForNeuralNetwork(schema)
    {
        // Convert to a number
        return new EBSchema({
            title: schema.title,
            type: "number",
            configuration: {
                included: true,
                component: {
                    layers: schema.configuration.interpretation.stack.fixedLayers
                }
            }
        });
    }


    /**
     * This method should prepare a given value for input into the neural network
     *
     * @param {*} value The value to be transformed
     * @param {EBSchema} schema The schema for the value
     * @return {Promise} A promise that resolves to a new value.
     */
    transformValueForNeuralNetwork(value, schema)
    {
        if (value)
        {
            return Promise.resolve(1);
        }
        else
        {
            return Promise.resolve(0);
        }
    }


    /**
     * This method should take output from the neural network and transform it back
     *
     * @param {*} value The value to be transformed
     * @param {EBSchema} schema The schema for the value to be transformed
     * @return {Promise} A promise that resolves to a new value
     */
    transformValueBackFromNeuralNetwork(value, schema)
    {
        return Boolean(Math.round(value));
    }


    /**
     * This method should generate the default configuration for the given schema
     *
     * @param {EBSchema} schema The schema for the value to be transformed
     * @return {object} An object which follows the schema returned from configurationSchema
     */
    generateDefaultConfiguration(schema)
    {
        return {
            mode: "continuous_normalized",
            stack: {
                fixedLayers: EBNeuralNetworkTemplateGenerator.generateMultiLayerPerceptronTemplate('medium')
            }
        };
    }


    /**
     * This method should compare two values according to the given schema, in order to determine the accuracy
     * of the neural network.
     *
     * @param {*} expected The value the network was expected to produce, e.g. the correct answer
     * @param {*} actual The actual value the network produced.
     * @param {EBSchema} schema The schema for the value to be compared
     * @param {boolean} accumulateStatistics Whether or not statistics on the results should be accumulated into the EBSchema object.
     * @return {number} accuracy The accuracy of the result. should be a number between 0 and 1
     */
    compareNetworkOutputs(expected, actual, schema, accumulateStatistics)
    {
        if (expected === actual)
        {
            return 1;
        }
        else
        {
            return 0;
        }
    }


    /**
     * This method should create a new field accumulator, a subclass of EBFieldAnalysisAccumulatorBase.
     *
     * This accumulator can be used to analyze a bunch of values through the lens of this interpretation,
     * and calculate statistics that the user may use to analyze the situation.
     *
     * @return {EBFieldAnalysisAccumulatorBase} An instantiation of a field accumulator.
     */
    createFieldAccumulator()
    {
        // This needs to be moved to a configuration file of some sort
        const maxLengthForHistogram = 250;

        // Create a subclass and immediately instantiate it.
        return new (class extends EBFieldAnalysisAccumulatorBase
        {
            constructor()
            {
                super();
                this.truths = 0;
                this.falses = 0;
            }

            accumulateValue(value)
            {
                if (value)
                {
                    this.truths += 1;
                }
                else
                {
                    this.falses += 1;
                }
            }

            getFieldStatistics()
            {
                const values = [];
                for(let truthN = 0; truthN < this.truths; truthN += 1)
                {
                    values.push('true');
                }
                for(let falseN = 0; falseN < this.falses; falseN += 1)
                {
                    values.push('false');
                }

                return {valueHistogram: EBValueHistogram.computeHistogram(values)};
            }
        })();
    }


    /**
     * This method should return a schema for the metadata associated with this interpretation
     *
     * @return {jsonschema} A schema representing the metadata for this interpretation
     */
    static statisticsSchema()
    {
        return {
            "id": "EBBooleanInterpretation.statisticsSchema",
            "type": "object",
            "properties": {
                valueHistogram: EBValueHistogram.schema()
            }
        };
    }


    /**
     * This method should return a schema for the configuration for this interpretation
     *
     * @return {jsonschema} A schema representing the configuration for this interpretation
     */
    static configurationSchema()
    {
        return {
            "id": "EBBooleanInterpretation.configurationSchema",
            "type": "object",
            "properties": {
            }
        };
    }


    /**
     * This method should return a schema for accumulating accuracy results from values in this interpretation
     *
     * @return {jsonschema} A schema representing whatever is needed to store results
     */
    static resultsSchema()
    {
        return {
            "id": "EBBooleanInterpretation.resultsSchema",
            "type": "object",
            "properties": {}
        };
    }
}

module.exports = EBBooleanInterpretation;
