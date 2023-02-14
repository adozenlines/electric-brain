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
    natural = require('natural'),
    EBConfusionMatrix = require("../../../shared/models/EBConfusionMatrix"),
    EBFieldAnalysisAccumulatorBase = require('./../../../server/components/datasource/EBFieldAnalysisAccumulatorBase'),
    EBFieldMetadata = require('../../../shared/models/EBFieldMetadata'),
    EBInterpretationBase = require('./../../../server/components/datasource/EBInterpretationBase'),
    EBNeuralNetworkEditorModule = require("../../../shared/models/EBNeuralNetworkEditorModule"),
    EBNeuralNetworkTemplateGenerator = require("../../../shared/components/EBNeuralNetworkTemplateGenerator"),
    EBNumberHistogram = require('../../../shared/models/EBNumberHistogram'),
    EBSchema = require("../../../shared/models/EBSchema"),
    EBValueHistogram = require('../../../shared/models/EBValueHistogram'),
    underscore = require('underscore');

/**
 * The string interpretation is used for all strings.
 */
class EBStringInterpretation extends EBInterpretationBase
{
    /**
     * Constructor. Requires the interpretation registry in order to recurse properly
     *
     * @param {EBInterpretationRegistry} interpretationRegistry The registry
     */
    constructor(interpretationRegistry)
    {
        super('string');
        this.interpretationRegistry = interpretationRegistry;
        this.wordTokenizer = new natural.WordPunctTokenizer();
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
    getJavascriptType(value)
    {
        return 'string';
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
        // Is it a string.
        if (underscore.isString(value))
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
        return Promise.resolve(String(value));
    }


    /**
     * This method should transform the given schema for input to the neural network.
     *
     * @param {EBSchema} schema The schema to be transformed
     * @return {Promise} A promise that resolves to a new value.
     */
    transformSchemaForNeuralNetwork(schema)
    {
        // Output a different schema depending on the mode for the string
        if (schema.configuration.interpretation.mode === 'classification')
        {
            // Ensure the schema has a component configuration
            schema.configuration.component = {
                layers: schema.configuration.interpretation.stack.fixedLayers
            };

            schema.type = ['number'];
            schema.enum = [null].concat(schema.configuration.interpretation.classificationValues);
            return schema;
        }
        else if (schema.configuration.interpretation.mode === 'sequence')
        {
            // Vanilla ascii sequence representation
            const asciiLength = 128;
            return new EBSchema({
                title: schema.title,
                type: "array",
                items: {
                    title: `${schema.title}.[]`,
                    type: "object",
                    properties: {
                        character: {
                            title: `${schema.title}.[].character`,
                            type: "number",
                            enum: underscore.range(0, asciiLength),
                            configuration: {
                                included: true,
                                component: {}
                            }
                        }
                    },
                    configuration: {
                        included: true,
                        // Ensure the schema has a component configuration
                        component: {}
                    }
                },
                configuration: {
                    included: true,
                    // Ensure the schema has a component configuration
                    component: {
                        layers: schema.configuration.interpretation.stack.sequenceLayers,
                        enforceSequenceLengthLimit: schema.configuration.interpretation.enforceSequenceLengthLimit,
                        maxSequenceLength: schema.configuration.interpretation.maxSequenceLength
                    }
                }
            });
        }
        else if (schema.configuration.interpretation.mode === 'english_word')
        {
            // Ensure that the schema has a component configuration
            schema.configuration.component = {};
            
            return schema;
        }
        else if (schema.configuration.interpretation.mode === 'english_text')
        {
            return new EBSchema({
                title: schema.title,
                type: "array",
                items: {
                    title: `${schema.title}.[]`,
                    type: "string",
                    configuration: {
                        included: true,
                        component: {}
                    }
                },
                configuration: {
                    included: true,
                    component: {
                        layers: schema.configuration.interpretation.stack.sequenceLayers,
                        enforceSequenceLengthLimit: schema.configuration.interpretation.enforceSequenceLengthLimit,
                        maxSequenceLength: schema.configuration.interpretation.maxSequenceLength
                    }
                }
            });
        }
        else
        {
            throw new Error(`Unrecognized interpretation mode: ${schema.configuration.interpretation.mode }`);
        }
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
        // Output a different value depending on the mode for the string
        if (schema.configuration.interpretation.mode === 'classification')
        {
            const index = schema.configuration.interpretation.classificationValues.indexOf(value);
            if (index === -1)
            {
                console.error('enum value not found: ', value);
                return 0;
            }
            else
            {
                return index + 1;
            }
        }
        else if (schema.configuration.interpretation.mode === 'sequence')
        {
            const output = [];
            const asciiLength = 128;
            for (let characterIndex = 0; characterIndex < value.toString().length; characterIndex += 1)
            {
                let charCode = value.toString().charCodeAt(characterIndex);
                if (charCode >= asciiLength)
                {
                    charCode = 0;
                }

                output.push({character: charCode});
            }
            return output;
        }
        else if(schema.configuration.interpretation.mode === 'english_word')
        {
            return value.toString().toLowerCase();
        }
        else if(schema.configuration.interpretation.mode === 'english_text')
        {
            return underscore.filter(this.wordTokenizer.tokenize(value.toString().toLowerCase()).map((word) => word.trim()), (word) => word);
        }
        else
        {
            throw new Error(`Unrecognized interpretation mode: ${schema.configuration.interpretation.mode }`)
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
        // Decide whether to represent this string as an enum or a sequence
        if (schema.configuration.interpretation.mode === 'classification')
        {
            if (value === 0)
            {
                return null;
            }
            else
            {
                return schema.configuration.interpretation.classificationValues[value - 1];
            }
        }
        else if (schema.configuration.interpretation.mode === 'sequence')
        {
            let output = "";
            value.forEach((character) =>
            {
                output += String.fromCharCode(character.character);
            });
            return output;
        }
        else if (schema.configuration.interpretation.mode === 'english_word')
        {
            return value;
        }
        else if (schema.configuration.interpretation.mode === 'english_text')
        {
            return value.join(' ');
        }
        else
        {
            throw new Error(`Unrecognized interpretation mode: ${schema.configuration.interpretation.mode }`);
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
        let configuration = {};
        if (schema.metadata.statistics.valueHistogram.cardinality > 0.6)
        {
            configuration.mode = "sequence";
        }
        else
        {
            configuration.mode = "classification";
        }

        configuration.classificationValues = underscore.sortBy(schema.metadata.statistics.valueHistogram.values.map((value) => (value.value)), (value) => value);

        configuration.stack = {
            sequenceLayers: EBNeuralNetworkTemplateGenerator.generateMultiLayerLSTMTemplate('medium'),
            fixedLayers: EBNeuralNetworkTemplateGenerator.generateMultiLayerPerceptronTemplate('medium')
        };
        
        configuration.enforceSequenceLengthLimit = false;
        configuration.maxSequenceLength = 2500;

        return configuration;
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
        if (value.length > 50)
        {
            return Promise.resolve(value.substr(0, 50) + "...");
        }
        else
        {
            return Promise.resolve(value);
        }
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
        if (accumulateStatistics)
        {
            if (!schema.results.confusionMatrix)
            {
                schema.results.confusionMatrix = new EBConfusionMatrix();
            }
            if (!(schema.results.confusionMatrix instanceof EBConfusionMatrix))
            {
                schema.results.confusionMatrix = new EBConfusionMatrix(schema.results.confusionMatrix);
            }
            schema.results.confusionMatrix.accumulateResult(expected, actual);
        }

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
        const maxStringLengthForHistogram = 250;

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
                // Only add it to the list of values if its below 250 characters in length. This prevents
                // The system from storing fields that may have enormous strings that are totally unique
                // to the field - a common case.
                if (value.length < maxStringLengthForHistogram)
                {
                    this.values.push(value);
                }
            }

            getFieldStatistics()
            {
                return {valueHistogram: EBValueHistogram.computeHistogram(this.values)};
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
            "id": "EBStringInterpretation.statisticsSchema",
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
            "id": "EBStringInterpretation.configurationSchema",
            "type": "object",
            "properties": {
                mode: {
                    "type": "string",
                    "enum": ["classification", "sequence", "english_word", "english_text"]
                },
                classificationValues: {
                    "type": "array",
                    "items": {"type": "string"}
                },
                
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
                        },
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
            "id": "EBStringInterpretation.resultsSchema",
            "type": "object",
            "properties": {"confusionMatrix": EBConfusionMatrix.schema()}
        };
    }
}

module.exports = EBStringInterpretation;
