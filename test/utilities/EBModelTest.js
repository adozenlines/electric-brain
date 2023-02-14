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
    EBApplication = require("../../server/EBApplication"),
    EBTrainTransformModelTask = require("../../plugins/transform_architecture/server/EBTrainTransformModelTask"),
    EBTransformArchitecture = require("../../plugins/transform_architecture/shared/models/EBTransformArchitecture"),
    idUtilities = require("../../server/utilities/id"),
    models = require("../../shared/models/models"),
    Promise = require("bluebird"),
    underscore = require('underscore');

/**
 * This class is used to represent and create end-to-end tests easily. An EBModelTest is a unit test
 * that goes all the way from a data-source through to a fully trained model, and makes sure that
 * the result is accurate. As a consequence, these tests touch on many components of the engine.
 */
class EBModelTest
{
    /**
     * Constructs the model-test
     *
     * @param {object} data The data for the model test
     */
    constructor(data)
    {
        assert.deepEqual(EBModelTest.validate(data), []);
        Object.keys(data).forEach((key) =>
        {
            this[key] = data[key];
        });
    }


    /**
     * This method will runs this test with the given application object
     *
     * @param {EBApplication} application The global application object.
     */
    run(application)
    {
        const test = this;

        // First step is to sample the data and prepare an EBDataSource object
        function createDataSource()
        {
            const dataSource = new models.EBDataSource(test.dataSource);

            return application.dataSourcePluginDispatch.detectSchema(dataSource).then(function(resultSchema)
            {
                dataSource.dataSchema = resultSchema;

                test.inputFields.forEach((field) =>
                {
                    dataSource.dataSchema.find(field).setIncluded(true);
                });

                test.outputFields.forEach((field) =>
                {
                    dataSource.dataSchema.find(field).setIncluded(true);
                });

                return dataSource;
            });
        }

        // The next step is to take that data source and create an EBArchitecture object
        function createArchitecture(dataSource)
        {
            const architecture = new EBTransformArchitecture({
                name: dataSource.name,
                dataSource: dataSource,
                inputTransformations: [],
                inputSchema: new models.EBSchema(dataSource.dataSchema),
                outputSchema: new models.EBSchema(dataSource.dataSchema)
            });

            test.inputFields.forEach((field) =>
            {
                architecture.inputSchema.find(field).setIncluded(true);
                architecture.outputSchema.find(field).setIncluded(false);
            });

            test.outputFields.forEach((field) =>
            {
                architecture.inputSchema.find(field).setIncluded(false);
                architecture.outputSchema.find(field).setIncluded(true);
            });

            architecture.inputSchema.walk((field) =>
            {
                field.configuration.interpretation = application.interpretationRegistry.getInterpretation(field.metadata.mainInterpretation).generateDefaultConfiguration(field);
            });

            architecture.outputSchema.walk((field) =>
            {
                field.configuration.interpretation = application.interpretationRegistry.getInterpretation(field.metadata.mainInterpretation).generateDefaultConfiguration(field);
            });

            return Promise.resolve(architecture);
        }

        // Next create an EBModel object
        function createModel(architecture)
        {
            const model = new models.EBModel({
                name: architecture.name,
                running: false,
                architecture: architecture
            });

            // Modify the default parameters
            model.parameters = underscore.extend(model.parameters, test.modelParameters);

            return Promise.fromCallback((next) =>
            {
                idUtilities.getUniqueID(application, 'model', next);
            }).then((id) =>
            {
                model._id = id;
                return application.db.collection('EBModel').insert(model).then((result) =>
                {
                    return model;
                });
            });
        }

        // Then we attempt to train that model
        function trainModel(model)
        {
            const task = new EBTrainTransformModelTask(application);

            // Create a fake Beaver task object
            const fakeBeaverTask = {
                log: (task, msg, callback) => {
                    console.log(msg);
                    return callback();
                }
            };

            return task.run(fakeBeaverTask, {_id: model._id});
        }

        // Finally, we check the final model
        function checkResults(model)
        {
            // Make sure the result came back as a model object
            // and that it has all the steps marked as complete
            assert(model instanceof models.EBModel);
            assert.equal(model.codeGeneration.status, 'complete');
            assert.equal(model.dataScanning.status, 'complete');
            assert.equal(model.training.status, 'complete');
            assert.equal(model.testing.status, 'complete');

            if ((model.testing.accuracy * 100) < test.results.minimumAccuracy)
            {
                assert.fail(model.testing.accuracy * 100, test.results.minimumAccuracy, `The accuracy of the model did not meet the minimum required accuracy of ${test.results.minimumAccuracy}.`, "<");
            }

            return Promise.resolve();
        }

        // String everything together
        return createDataSource().then(createArchitecture).then(createModel).then(trainModel).then(checkResults);
    }



    /**
     * Returns a JSON-Schema schema for EBModelTest
     *
     * @returns {object} The JSON-Schema that can be used to validate EBModelTest objects
     */
    static schema()
    {
        return {
            "id": "EBModelTest",
            "type": "object",
            "properties": {
                dataSource: models.EBDataSource.schema(),
                inputFields: {
                    "type": "array",
                    "items": {"type": "string"}
                },
                outputFields: {
                    "type": "array",
                    "items": {"type": "string"}
                },
                modelParameters: {
                    "type": "object",
                    "properties": {
                        batchSize: {"type": "number"},
                        testingBatchSize: {"type": "number"},
                        iterations: {"type": "number"}
                    }
                },
                results: {
                    "type": "object",
                    "properties": {
                        minimumAccuracy: {"type": "number"}
                    }
                }
            }
        };
    }


    /**
     * Returns a validation function for EBModelTest
     *
     * @returns {function} An AJV validation function
     */
    static validator()
    {
        if (!EBModelTest._validationFunction)
        {
            const ajv = new Ajv({
                "allErrors": true
            });

            EBModelTest._validationFunction = ajv.compile(EBModelTest.schema());
        }

        return EBModelTest._validationFunction;
    }


    /**
     * This method validates the given object. Returns an array with the errors
     *
     * @param {object} object The object to be validated
     * @returns {[object]} An array containing any detected errors. Will be empty if the object is valid.
     */
    static validate(object)
    {
        const validationFunction = EBModelTest.validator();
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

module.exports = EBModelTest;
