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
    EBApplication = require("../../server/EBApplication"),
    EBCSVPlugin = require("../../plugins/csv/server/EBCSVPlugin"),
    EBTrainTransformModelTask = require("../../plugins/transform_architecture/server/EBTrainTransformModelTask"),
    EBModelTest = require("../utilities/EBModelTest"),
    fs = require('fs'),
    path = require('path'),
    testingData = require("../utilities/testing_data");

// Give each test 15 minutes. This is because core machine learning tests can take a while.
const testTimeout = 15 * 60 * 1000;

describe("End to end tests", function()
{
    this.timeout(testTimeout);
    const application = new EBApplication();
    before((done) =>
    {
        application.initializeDatabase((err) =>
        {
            if (err)
            {
                return done(err);
            }

            application.initializeBackgroundTask((err) =>
            {
                if (err)
                {
                    return done(err);
                }

                application.initializeSocketIO(null, (err) =>
                {
                    if (err)
                    {
                        return done(err);
                    }

                    return done();
                });
            });
        });
    });


    it("Should be able to train a model using the copy-value data-set.", () =>
    {
        const test = new EBModelTest({
            type: 'transform',
            dataSource: {
                name: "copy_value",
                type: "mongo",
                database: {
                    uri: "mongodb://localhost:27017/electric_brain_testing",
                    collection: "copy_value"
                }
            },
            inputFields: ['.inputLetter'],
            outputFields: ['.outputLetter'],
            modelParameters: {
                batchSize: 16,
                testingBatchSize: 4,
                iterations: 200
            },
            results: {minimumAccuracy: 100}
        });

        return testingData.generateCopyTestingDataSet().then(() =>
        {
            return test.run(application);
        });
    });


    it("Should be able to train a model using the dual-copy-value data-set.", () =>
    {
        const test = new EBModelTest({
            type: 'transform',
            dataSource: {
                name: "dual_copy_value",
                type: "mongo",
                database: {
                    uri: "mongodb://localhost:27017/electric_brain_testing",
                    collection: "dual_copy_value"
                }
            },
            inputFields: ['.inputLetter', '.inputStatus'],
            outputFields: ['.outputLetter', '.outputStatus'],
            modelParameters: {
                batchSize: 16,
                testingBatchSize: 4,
                iterations: 200
            },
            results: {minimumAccuracy: 100}
        });


        return testingData.generateDualCopyTestingDataSet().then(() =>
        {
            return test.run(application);
        });
    });


    it("Should be able to train a model using the sequence-copy data set", () =>
    {
        const test = new EBModelTest({
            type: 'transform',
            dataSource: {
                name: "sequence_copy",
                type: "mongo",
                database: {
                    uri: "mongodb://localhost:27017/electric_brain_testing",
                    collection: "sequence_copy"
                }
            },
            inputFields: ['.letters.[].inputLetter'],
            outputFields: ['.letters.[].outputLetter'],
            modelParameters: {
                batchSize: 16,
                testingBatchSize: 4,
                iterations: 500
            },
            results: {minimumAccuracy: 100}
        });

        return testingData.generateSequenceCopyTestingDataSet().then(() =>
        {
            return test.run(application);
        });
    });


    it("Should be able to train a model using the sequence dual copy data set", () =>
    {
        const test = new EBModelTest({
            type: 'transform',
            dataSource: {
                name: "sequence_dual_copy",
                type: "mongo",
                database: {
                    uri: "mongodb://localhost:27017/electric_brain_testing",
                    collection: "sequence_dual_copy"
                }
            },
            inputFields: ['.letters.[].inputLetter', '.letters.[].inputStatus'],
            outputFields: ['.letters.[].outputLetter', '.letters.[].outputStatus'],
            modelParameters: {
                batchSize: 16,
                testingBatchSize: 4,
                iterations: 500
            },
            results: {minimumAccuracy: 100}
        });

        return testingData.generateSequenceDualCopyTestingDataSet().then(() =>
        {
            return test.run(application);
        });
    });


    it("Should be able to train a model using the sequence identification data set", () =>
    {
        const test = new EBModelTest({
            type: 'transform',
            dataSource: {
                name: "sequence_identification",
                type: "mongo",
                database: {
                    uri: "mongodb://localhost:27017/electric_brain_testing",
                    collection: "sequence_identification"
                }
            },
            inputFields: ['.inputLetters.[].letter'],
            outputFields: ['.outputIdentity'],
            modelParameters: {
                batchSize: 16,
                testingBatchSize: 4,
                iterations: 500
            },
            results: {minimumAccuracy: 100}
        });

        return testingData.generateSequenceIdentificationTestingDataSet().then(() =>
        {
            return test.run(application);
        });
    });


    it("Should be able to train a model using the sequence classification data set", () =>
    {
        const test = new EBModelTest({
            type: 'transform',
            dataSource: {
                name: "sequence_classification",
                type: "mongo",
                database: {
                    uri: "mongodb://localhost:27017/electric_brain_testing",
                    collection: "sequence_classification"
                }
            },
            inputFields: ['.inputLetters.[].letter'],
            outputFields: ['.outputFirstClassification', '.outputSecondClassification'],
            modelParameters: {
                batchSize: 16,
                testingBatchSize: 4,
                iterations: 500
            },
            results: {minimumAccuracy: 100}
        });

        return testingData.generateSequenceClassificationTestingDataSet().then(() =>
        {
            return test.run(application);
        });
    });


    it("Should be able to train a model using the number prediction from classification data set", () =>
    {
        const test = new EBModelTest({
            type: 'transform',
            dataSource: {
                name: "number_prediction_from_classification",
                type: "mongo",
                database: {
                    uri: "mongodb://localhost:27017/electric_brain_testing",
                    collection: "number_prediction_from_classification"
                }
            },
            inputFields: ['.first', '.second'],
            outputFields: ['.result'],
            modelParameters: {
                batchSize: 16,
                testingBatchSize: 4,
                iterations: 1500
            },
            results: {minimumAccuracy: 80}
        });

        return testingData.generateNumberPredictionFromClassificationDataset().then(() =>
        {
            return test.run(application);
        });
    });


    it("Should be able to train a model using the number mathematics data set", () =>
    {
        const test = new EBModelTest({
            type: 'transform',
            dataSource: {
                name: "number_mathematics",
                type: "mongo",
                database: {
                    uri: "mongodb://localhost:27017/electric_brain_testing",
                    collection: "number_mathematics"
                }
            },
            inputFields: ['.first', '.second', '.third'],
            outputFields: ['.product1', '.product2', '.product3', '.sum1', '.sum2', '.sum3'],
            modelParameters: {
                batchSize: 16,
                testingBatchSize: 4,
                iterations: 1500
            },
            results: {minimumAccuracy: 90}
        });

        return testingData.generateNumberMathematicsDataset().then(() =>
        {
            return test.run(application);
        });
    });


    it("Should be able to train a model using the number classification data set", () =>
    {
        const test = new EBModelTest({
            type: 'transform',
            dataSource: {
                name: "number_classification",
                type: "mongo",
                database: {
                    uri: "mongodb://localhost:27017/electric_brain_testing",
                    collection: "number_classification"
                }
            },
            inputFields: ['.first', '.second'],
            outputFields: ['.classification'],
            modelParameters: {
                batchSize: 16,
                testingBatchSize: 4,
                iterations: 1500
            },
            results: {minimumAccuracy: 100}
        });

        return testingData.generateNumberClassificationDataset().then(() =>
        {
            return test.run(application);
        });
    });


    it("Should be able to train a model from the copy-value CSV file", () =>
    {
        return testingData.generateCopyTestingDataSet().then(() =>
        {
            const csvPlugin = new EBCSVPlugin(application);
            const fileStream = fs.createReadStream(path.join(__dirname, "..", "data", "copy_value.csv"));
            return csvPlugin.uploadFile(fileStream).then((id) =>
            {
                console.log(id);
                const test = new EBModelTest({
                    dataSource: {
                        name: "copy_value",
                        type: "csv",
                        file: id.toString()
                    },
                    inputFields: ['.inputLetter'],
                    outputFields: ['.outputLetter'],
                    modelParameters: {
                        batchSize: 16,
                        testingBatchSize: 4,
                        iterations: 200
                    },
                    results: {minimumAccuracy: 100}
                });

                return test.run(application);
            });
        });
    });


    it("Should be able to train a model from the number classification CSV file", () =>
    {
        return testingData.generateNumberClassificationDataset().then(() =>
        {
            const csvPlugin = new EBCSVPlugin(application);
            const fileStream = fs.createReadStream(path.join(__dirname, "..", "data", "number_classification.csv"));
            return csvPlugin.uploadFile(fileStream).then((id) =>
            {
                const test = new EBModelTest({
                    type: 'transform',
                    dataSource: {
                        name: "number_classification",
                        type: "csv",
                        file: id.toString()
                    },
                    inputFields: ['.first', '.second'],
                    outputFields: ['.classification'],
                    modelParameters: {
                        batchSize: 16,
                        testingBatchSize: 4,
                        iterations: 1500
                    },
                    results: {minimumAccuracy: 100}
                });

                return test.run(application);
            });
        });
    });


    it("Should be able to train a model using date classification dataset", () =>
    {
        const test = new EBModelTest({
            type: 'transform',
            dataSource: {
                name: "date_classification",
                type: "mongo",
                database: {
                    uri: "mongodb://localhost:27017/electric_brain_testing",
                    collection: "date_classification"
                }
            },
            inputFields: ['.date'],
            outputFields: ['.isWeekend', '.weekInMonth', '.timeOfDay', '.decade'],
            modelParameters: {
                batchSize: 16,
                testingBatchSize: 4,
                iterations: 500
            },
            results: {minimumAccuracy: 100}
        });

        return testingData.generateDateClassificationDataset().then(() =>
        {
            return test.run(application);
        });
    });
});
