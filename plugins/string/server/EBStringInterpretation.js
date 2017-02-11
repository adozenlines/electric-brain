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
        return Promise.resolve(value.toString());
    }


    /**
     * This method should transform the given schema for input to the neural network.
     *
     * @param {EBSchema} schema The schema to be transformed
     * @return {Promise} A promise that resolves to a new value.
     */
    transformSchemaForNeuralNetwork(schema)
    {
        // Decide whether to represent this string as an enum or a sequence
        const representAsEnum = schema.configuration.interpretation.mode === 'classification';
        if (representAsEnum)
        {
            schema.type = ['number'];
            schema.enum = [null];
            schema.metadata.statistics.valueHistogram.values.forEach((number, index) =>
            {
                schema.enum.push(index);
            });
            return schema;
        }
        else
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
                            configuration: {included: true}
                        }
                    },
                    configuration: {included: true}
                },
                configuration: {included: true}
            });
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
        // Decide whether to represent this string as an enum or a sequence
        const representAsEnum = schema.configuration.interpretation.mode === 'classification';
        if (representAsEnum)
        {
            const values = underscore.map(schema.metadata.statistics.valueHistogram.values, (value) => value.value);
            const index = values.indexOf(value);
            if (index === -1)
            {
                console.log('enum value not found: ', value);
                // console.log(self.values);
                return 0;
            }
            else
            {
                return index + 1;
            }
        }
        else
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
        const representAsEnum = schema.configuration.interpretation.mode === 'classification';
        if (representAsEnum)
        {
            if (value === 0)
            {
                return null;
            }
            else
            {
                const values = underscore.map(schema.metadata.statistics.valueHistogram.values, (value) => value.value);
                return values[value - 1];
            }
        }
        else
        {
            let output = "";
            value.forEach((character) =>
            {
                output += String.fromCharCode(character.character);
            });
            return output;
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
        if (schema.metadata.statistics.valueHistogram.cardinality > 0.6)
        {
            return {mode: "sequence"};
        }
        else
        {
            return {mode: "classification"};
        }
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
                    "enum": ["classification", "sequence"]
                }
            }
        };
    }
}

module.exports = EBStringInterpretation;