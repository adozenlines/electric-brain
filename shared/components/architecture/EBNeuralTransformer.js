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
    criterionTemplate = require("../../../build/torch/criterion"),
    deepcopy = require('deepcopy'),
    stream = require('stream'),
    Promise = require('bluebird'),
    underscore = require('underscore');


/**
 * This class is a base class for neural stacks. Neural stacks take schemas, which have been properly annotated with
 * metadata, configurations and interpretations, and generate neural networks portions from those schemas.
 */
class EBNeuralStack
{
    /**
     * Constructs the EBNeuralStack the given schema. All of the fields in the schema should be properly
     * annotated with metadata, interpretation configurations and so on.
     *
     * @param {EBSchema} schema The schema to design the stack around.
     */
    constructor(schema)
    {
        this.schema = schema;
    }


    /**
     * This method creates a transformation stream for this network. This transformation stream
     * takes objects from the database and converts them into a format that is ready to send
     * down to Torch
     *
     * @param {EBInterpretationRegistry} registry The registry for the transformation stream
     * @returns {Stream} A standard NodeJS transformation stream that you can write() to, read()
     *                   from, and pipe() wherever you want
     */
    createTransformationStream(registry)
    {
        const self = this;

        // Set a default value of 0 for everything
        this.schema.walk((schema) =>
        {
            if (schema.isField)
            {
                schema.default = 0;
            }
        });

        const filterFunction = this.schema.filterFunction();

        return new stream.Transform({
            highWaterMark: 1,
            readableObjectMode: true,
            writableObjectMode: true,
            transform(object, encoding, next)
            {
                const transform = this;

                const inputObject = deepcopy(object);

                try
                {
                    const inputPromise = registry.getInterpretation('object').transformValueForNeuralNetwork(inputObject, self.schema.filterIncluded());
                    inputPromise.then((transformed) =>
                    {
                        const transformedObject = transformed;
                        try
                        {
                            transform.push(filterFunction(transformedObject));

                            return next();
                        }
                        catch (err)
                        {
                            console.error(`Object in our database is not valid according to our data schema: ${err.toString()}`);
                            console.error(err.stack);

                            return next();
                        }
                    }, (err) => next(err));
                }
                catch(err)
                {
                    console.error(err);
                }
            }
        });
    }

    
    /**
     * This method creates a transformation stream for this network. This transformation stream
     * takes outputs from the torch code and transforms them back into a standardized format
     *
     * @param {EBInterpretationRegistry} registry The registry for the transformation stream
     * @returns {Stream} A standard NodeJS transformation stream that you can write() to, read()
     *                   from, and pipe() wherever you want
     */
    createReverseTransformationStream(registry)
    {
        const self = this;

        return new stream.Transform({
            highWaterMark: 1,
            readableObjectMode: true,
            writableObjectMode: true,
            transform(object, encoding, next)
            {
                const transform = this;

                const outputObject = deepcopy(object);

                // Next, apply transformations
                const outputPromise = registry.getInterpretation('object').transformValueBackFromNeuralNetwork(outputObject, self.schema.filterIncluded());
                outputPromise.then((transformedOutputObject) =>
                {
                    try
                    {
                        transform.push(transformedOutputObject);
                        return next();
                    }
                    catch (err)
                    {
                        console.error(`Object in our database is not valid according to our data schema: ${err.toString()}`);
                        console.error(err.stack);
                        return next();
                    }
                }, (err) => next(err));
            }
        });
    }



    /**
     * This method converts a single raw object into an input object for a neural network
     *
     * @param {EBInterpretationRegistry} registry The interpretation registry
     * @param {object} networkOutput The output from the network
     * @return {Promise} Resolves a promise Which will receive the transformed object
     */
    convertObjectIn(registry, object)
    {
        const self = this;
        return Promise.fromCallback((callback) =>
        {
            const stream = self.createTransformationStream(registry);
            stream.on("data", (output) =>
            {
                return callback(null, output);
            });
            stream.on("error", (error) =>
            {
                return callback(error);
            });
            stream.end(object);
        });
    }



    /**
     * This method converts a single network output back to its original
     *
     * @param {EBInterpretationRegistry} registry The interpretation registry
     * @param {object} networkOutput The output from the network
     * @return {Promise} Resolves a promise Which will receive the transformed object
     */
    convertObjectOut(registry, networkOutput)
    {
        const self = this;
        return Promise.fromCallback((callback) =>
        {
            const stream = self.createReverseTransformationStream(registry);
            stream.on("data", (output) =>
            {
                return callback(null, output);
            });
            stream.on("error", (error) =>
            {
                return callback(error);
            });
            stream.end(networkOutput);
        });
    }
}

module.exports = EBNeuralStack;
