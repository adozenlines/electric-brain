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
    EBNeuralNetworkEditorModule = require("../../../shared/models/EBNeuralNetworkEditorModule"),
    EBNeuralNetworkTemplateGenerator = require('../../../shared/components/EBNeuralNetworkTemplateGenerator'),
    EBNumberHistogram = require('../../../shared/models/EBNumberHistogram'),
    Promise = require('bluebird'),
    underscore = require('underscore');

/**
 * The string interpretation is used for all strings.
 */
class EBSequenceInterpretation extends EBInterpretationBase
{
    /**
     * Constructor. Requires the interpretation registry in order to recurse properly
     *
     * @param {EBInterpretationRegistry} interpretationRegistry The registry
     */
    constructor(interpretationRegistry)
    {
        super('sequence');
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
        return 'array';
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
        // Is it an array?
        if (underscore.isArray(value))
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
        return Promise.resolve(null);
    }


    /**
     * This method should transform the given schema for input to the neural network.
     *
     * @param {EBSchema} schema The schema to be transformed
     * @return {Promise} A promise that resolves to a new value.
     */
    transformSchemaForNeuralNetwork(schema)
    {
        let newSchema = schema.transform((subSchema) =>
        {
            // Get the schema's main interpretation
            const interpretation = this.interpretationRegistry.getInterpretation(subSchema.metadata.mainInterpretation);
            return interpretation.transformSchemaForNeuralNetwork(subSchema);
        });

        // We have to make sure that the schema, as well as its item objects have a component
        newSchema.configuration.component = {
            enforceSequenceLengthLimit: schema.configuration.interpretation.enforceSequenceLengthLimit,
            maxSequenceLength: schema.configuration.interpretation.maxSequenceLength,
            layers: schema.configuration.interpretation.stack.sequenceLayers
        };
        newSchema.items.configuration.component = {};

        return newSchema;
    }


    /**
     * This method should prepare a given value for input into the neural network
     *
     * @param {*} value The value to be transformed
     * @param {EBSchema} schema The schema for the value to be transformed
     * @return {Promise} A promise that resolves to a new value.
     */
    transformValueForNeuralNetwork(value, schema)
    {
        return Promise.mapSeries(value, (arrayValue) =>
        {
            const interpretation = this.interpretationRegistry.getInterpretation(schema.items.metadata.mainInterpretation);
            return Promise.resolve(interpretation.transformValueForNeuralNetwork(arrayValue, schema.items));
        });
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
        return Promise.mapSeries(value, (arrayValue) =>
        {
            const interpretation = this.interpretationRegistry.getInterpretation(schema.items.metadata.mainInterpretation);
            return Promise.resolve(interpretation.transformValueBackFromNeuralNetwork(arrayValue, schema.items));
        });
    }


    /**
     * This method should generate the default configuration for the given schema
     *
     * @param {EBSchema} schema The schema for the value to be transformed
     * @return {object} An object which follows the schema returned from configurationSchema
     */
    generateDefaultConfiguration(schema)
    {
        let configuration = {};

        configuration.stack = {
            sequenceLayers: EBNeuralNetworkTemplateGenerator.generateMultiLayerLSTMTemplate('medium')
        };

        configuration.enforceSequenceLengthLimit = false;
        configuration.maxSequenceLength = 2500;

        return configuration;
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
                this.arrayLengths = [];
            }

            accumulateValue(value)
            {
                this.arrayLengths.push(value.length);
            }

            getFieldStatistics()
            {
                return {arrayLengthHistogram: EBNumberHistogram.computeHistogram(this.arrayLengths)};
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
            "id": "EBSequenceInterpretation.statisticsSchema",
            "type": "object",
            "properties": {
                arrayLengthHistogram: EBNumberHistogram.schema()
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
            "id": "EBSequenceInterpretation.configurationSchema",
            "type": "object",
            "properties": {
                enforceSequenceLengthLimit: {
                    "type": "boolean"
                },

                maxSequenceLength: {
                    "type": "number"
                },
                stack: {
                    "type": ["object"],
                    "properties": {
                        "sequenceLayers": {
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
            "id": "EBSequenceInterpretation.resultsSchema",
            "type": "object",
            "properties": {}
        };
    }
}

module.exports = EBSequenceInterpretation;
