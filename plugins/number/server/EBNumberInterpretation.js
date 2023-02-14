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
    EBConfusionMatrix = require('../../../shared/models/EBConfusionMatrix'),
    EBConfusionChart = require('../../../shared/models/EBConfusionChart'),
    EBFieldAnalysisAccumulatorBase = require('./../../../server/components/datasource/EBFieldAnalysisAccumulatorBase'),
    EBFieldMetadata = require('../../../shared/models/EBFieldMetadata'),
    EBInterpretationBase = require('./../../../server/components/datasource/EBInterpretationBase'),
    EBNeuralNetworkEditorModule = require('../../../shared/models/EBNeuralNetworkEditorModule'),
    EBNeuralNetworkTemplateGenerator = require("../../../shared/components/EBNeuralNetworkTemplateGenerator"),
    EBNumberHistogram = require('../../../shared/models/EBNumberHistogram'),
    EBSchema = require("../../../shared/models/EBSchema"),
    underscore = require('underscore');

/**
 * The number interpretation is used for all numbers.
 */
class EBNumberInterpretation extends EBInterpretationBase
{
    /**
     * Constructor. Requires the interpretation registry in order to recurse properly
     *
     * @param {EBInterpretationRegistry} interpretationRegistry The registry
     */
    constructor(interpretationRegistry)
    {
        super('number');
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
        return ['string'];
    }




    /**
     * This method returns the raw javascript type of value that this interpretation applies to.
     *
     * @return {string} Can be one of: 'object', 'array', 'number', 'string', 'boolean', 'binary'
     */
    getJavascriptType()
    {
        return 'number';
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
        // Does it look like a number?
        if (underscore.isString(value) && /^[+-]?\d+?$/g.test(value))
        {
            return Promise.resolve(true);
        }
        else if (underscore.isString(value) && /^[+-]?\d+\.\d+$/g.test(value))
        {
            return Promise.resolve(true);
        }
        else if(underscore.isNumber(value))
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
        return Promise.resolve(Number(value));
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
        // Get the configuration
        const configuration = schema.configuration.interpretation;

        if (configuration.mode === 'continuous_raw' || configuration.mode === 'continuous_normalized')
        {
            schema.configuration.component = {
                layers: configuration.stack.fixedLayers
            };

            return schema;
        }
        else
        {
            // Create a new schema with an enumeration for all of the buckets
            return new EBSchema({
                title: `${schema.title}`,
                type: "number",
                enum: underscore.range(0, configuration.discreteValues.length),
                configuration: {
                    included: true,
                    component: {
                        layers: configuration.stack.fixedLayers
                    }
                }
            });
        }
    }


    /**
     * This method should prepare a given value for input into the neural network
     *
     * @param {EBSchema} value The value to be transformed
     * @param {EBSchema} schema The schema for the value to be transformed
     * @return {Promise} A promise that resolves to a new value.
     */
    transformValueForNeuralNetwork(value, schema)
    {
        // Get the configuration
        const configuration = schema.configuration.interpretation;

        if (configuration.mode === 'continuous_raw')
        {
            if (configuration.scalingFunction === 'linear')
            {
                return Number(value);
            }
            else if (configuration.scalingFunction === 'quadratic')
            {
                return Number(value) * Number(value);
            }
            else if (configuration.scalingFunction === 'logarithmic')
            {
                return Math.log10(Number(value));
            }
            else
            {
                throw new Error(`Unknown scalingFunction '${configuration.scalingFunction}'`);
            }
        }
        else if (configuration.mode === 'continuous_normalized')
        {
            // Compute the z-score
            return (value - schema.metadata.statistics.average) / schema.metadata.statistics.standardDeviation;
        }
        else if (configuration.mode === 'discrete')
        {
            return this.getDiscreteValueIndex(value, schema);
        }
        else
        {
            throw new Error(`Unknown mode for number interpretation: ${configuration.mode}`);
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
        // Get the configuration
        const configuration = schema.configuration.interpretation;
        if (configuration.mode === 'continuous_raw')
        {
            if (configuration.scalingFunction === 'linear')
            {
                return Number(value);
            }
            else if (configuration.scalingFunction === 'quadratic')
            {
                return Math.sqrt(Number(value));
            }
            else if (configuration.scalingFunction === 'logarithmic')
            {
                return Math.pow(10, Number(value));
            }
            else
            {
                throw new Error(`Unknown scalingFunction '${configuration.scalingFunction}'`);
            }
        }
        else if (configuration.mode === 'continuous_normalized')
        {
            // Take the z-score and compute the full value
            return (value * schema.metadata.statistics.standardDeviation) + schema.metadata.statistics.average;
        }
        else if (configuration.mode === 'discrete')
        {
            // Get the matching value
            const discreteValue = configuration.discreteValues[value];

            if (!discreteValue)
            {
                throw new Error(`Fatal error: Discrete value index ${value} is invalid. This should not happen.`);
            }

            return discreteValue.name;
        }
        else
        {
            throw new Error(`Unknown mode for number interpretation: ${configuration.mode}`);
        }
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
            scalingFunction: "linear",
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
        const configuration = schema.configuration.interpretation;
        if (configuration.mode === 'continuous_raw' || configuration.mode === 'continuous_normalized')
        {
            if (accumulateStatistics)
            {
                if (!schema.results.continuousValueConfusionChart)
                {
                    schema.results.continuousValueConfusionChart = new EBConfusionChart();
                }
                schema.results.continuousValueConfusionChart.accumulateResult(expected, actual);
            }

            // Calculating accuracy here is a bit quack, but we try anyhow
            if (expected !== 0)
            {
                return 1.0 - Math.max(0, Math.min(1, Math.abs((expected - actual) / expected)));
            }
            else if (actual !== 0)
            {
                return 1.0 - Math.max(0, Math.min(1, Math.abs((expected - actual) / actual)));
            }
            else
            {
                return 1;
            }
        }
        else if (configuration.mode === 'discrete')
        {
            // Figure out which bucket the input value belongs in
            const expectedIndex = this.getDiscreteValueIndex(expected, schema);
            const expectedName = schema.configuration.interpretation.discreteValues[expectedIndex].name;


            if (accumulateStatistics)
            {
                if (!schema.results.discreteValueConfusionMatrix)
                {
                    schema.results.discreteValueConfusionMatrix = new EBConfusionMatrix();
                }
                schema.results.discreteValueConfusionMatrix.accumulateResult(expectedName, actual);
            }

            if (expectedName === actual)
            {
                return 1;
            }
            else
            {
                return 0;
            }
        }
        else
        {
            throw new Error(`Unknown mode for number interpretation: ${configuration.mode}`);
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
        // Create a subclass and immediately instantiate it.
        return new (class extends EBFieldAnalysisAccumulatorBase
        {
            constructor()
            {
                super();
                this.values = [];
            }

            accumulateValue(value)
            {
                this.values.push(value);
            }

            getFieldStatistics()
            {
                const average = (data) =>
                {
                    const sum = data.reduce((sum, value) =>
                    {
                        return Number(sum) + Number(value);
                    }, 0);

                    const avg = sum / data.length;
                    return avg;
                };

                const standardDeviation = (values) =>
                {
                    const avg = average(values);

                    const squareDiffs = values.map((value) =>
                    {
                        const diff = Number(value) - avg;
                        const sqrDiff = diff * diff;
                        return sqrDiff;
                    });

                    const avgSquareDiff = average(squareDiffs);

                    const stdDev = Math.sqrt(avgSquareDiff);
                    return stdDev;
                };

                return {
                    average: average(this.values),
                    standardDeviation: standardDeviation(this.values),
                    numberHistogram: EBNumberHistogram.computeHistogram(this.values)
                };
            }
        })();
    }


    /**
     *  Gets which discrete-value bucket a given value belongs in
     *
     *  @param {Number} value The input value
     *  @param {EBSchema} schema The schema for the value
     *  @return {Number} The index of the discrete value
     */
    getDiscreteValueIndex(value, schema)
    {
        const configuration = schema.configuration.interpretation;
        // Go through all of the buckets and find the matching one
        const number = Number(value);
        let matchingValueIndex = null;
        configuration.discreteValues.forEach((discreteValue, index) =>
        {
            if (discreteValue.top === null || number < discreteValue.top)
            {
                if (discreteValue.bottom === null || number >= discreteValue.bottom)
                {
                    matchingValueIndex = index;
                }
            }
        });

        if (matchingValueIndex === null)
        {
            throw new Error(`Fatal error: No matching discreteValue found for ${number}. This should not happen.`);
        }

        return matchingValueIndex;
    }



    /**
     * This method should return a schema for the metadata associated with this interpretation
     *
     * @return {jsonschema} A schema representing the metadata for this interpretation
     */
    static statisticsSchema()
    {
        return {
            "id": "EBNumberInterpretation.statisticsSchema",
            "type": "object",
            "properties": {
                average: {"type": "number"},
                standardDeviation: {"type": "number"},
                numberHistogram: EBNumberHistogram.schema()
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
            "id": "EBNumberInterpretation.configurationSchema",
            "type": "object",
            "properties": {
                "mode": {
                    "type": "string",
                    "enum": ["discrete", "continuous_raw", "continuous_normalized"]
                },
                "scalingFunction": {
                    "type": "string",
                    "enum": ['linear', 'quadratic', 'logarithmic']
                },
                "discreteValues": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "top": {"type": ["number", "null"]},
                            "bottom": {"type": ["number", "null"]},
                            "name": {"type": "string"}
                        }
                    }
                },
                "stack": {
                    "type": ["object"],
                    "properties": {
                        "fixedLayers": {
                            "type": "array",
                            "items": EBNeuralNetworkEditorModule.schema()
                        }
                    }
                }
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
            "id": "EBNumberInterpretation.resultsSchema",
            "type": "object",
            "properties": {
                "discreteValueConfusionMatrix": EBConfusionMatrix.schema(),
                "continuousValueConfusionChart": EBConfusionChart.schema()
            }
        };
    }
}

module.exports = EBNumberInterpretation;