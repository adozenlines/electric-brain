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
    EBArchitecture = require("./EBArchitecture"),
    EBTransformArchitecture = require("../../plugins/transform_architecture/shared/models/EBTransformArchitecture"),
    EBMatchingArchitecture = require("../../plugins/matching_architecture/shared/models/EBMatchingArchitecture"),
    EBClassFactory = require("../components/EBClassFactory"),
    EBPerformanceData = require("./EBPerformanceData");

/**
 * This class represents a trained model in our system, or one that is in the process of being trained.
 */
class EBModel
{
    /**
     * This constructs a full EBModel object from the given raw JSON data.
     *
     * @param {object} rawModel The raw JSON data describing the model
     */
    constructor(rawModel)
    {
        const self = this;
        self.type = 'EBModel';
        Object.keys(rawModel).forEach(function(key)
        {
            if (key === 'architecture')
            {
                self[key] = EBClassFactory.createObject(rawModel[key]);
            }
            else
            {
                self[key] = rawModel[key];
            }
        });
        
        if (!self.running)
        {
            self.running = false;
        }

        if (!self.parameters)
        {
            self.parameters = {
                batchSize: 16,
                testingBatchSize: 4,
                iterations: 50000,
                initializationRangeBottom: -0.08,
                initializationRangeTop: 0.08,
                optimizationAlgorithm: 'adamax',
                optimizationParameters: {
                    learningRate: 2e-3,
                    beta: 0.9,
                    beta2: 0.999,
                    epsilon: 1e-38,
                    weightDecay: 0
                }
            };
        }

        if (!self.codeGeneration)
        {
            self.codeGeneration = {
                status: "waiting",
                percentageComplete: 0
            };
        }

        if (!self.dataScanning)
        {
            self.dataScanning = {
                status: "waiting",
                percentageComplete: 0
            };
        }

        if (!self.training)
        {
            self.training = {
                status: "waiting",
                percentageComplete: 0
            };
        }

        if (!self.testing)
        {
            self.testing = {
                status: "waiting",
                percentageComplete: 0
            };
        }

        if (!self.bundle)
        {
            self.bundle = {
                status: "waiting",
                percentageComplete: 0
            };
        }
    }

    /**
     * Returns a machine name for this model
     */
    get machineName()
    {
        const self = this;

        // strip out symbols into spaces
        const stripped = self.name.replace(/[^\w\s]/g, " ").replace(/_/g, " ");

        // title case the rest
        const titleCased = stripped.replace(/\w\S*/g, function(txt)
        {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        }).replace(/\s+/g, "");

        return titleCased;
    }

    /**
     * Returns a JSON-Schema schema for EBModel
     *
     * @returns {object} The JSON-Schema that can be used for validating this model object
     */
    static schema()
    {
        return {
            "id": "EBModel",
            "type": "object",
            "properties": {
                "_id": {},
                "name": {type: "string"},
                "running": {type: "boolean"},
                "architecture": {
                    "anyOf": [
                        EBTransformArchitecture.schema(),
                        EBMatchingArchitecture.schema()
                    ]
                },

                "parameters": {
                    type: "object",
                    properties: {
                        "batchSize": {
                            type: "number"
                        },
                        "testingBatchSize": {
                            type: "number"
                        },
                        "iterations": {
                            type: "number"
                        },
                        "initializationRangeBottom": {
                            type: "number"
                        },
                        "initializationRangeTop": {
                            type: "number"
                        },
                        "optimizationAlgorithm": {
                            type: "string"
                        },
                        "optimizationParameters": {
                            type: "object",
                            additionalProperties: {"type": "number"}
                        }
                    }
                },
                "codeGeneration": {
                    type: "object",
                    properties: {
                        "status": {
                            type: "string",
                            enum: ["waiting", "in_progress", "complete"]
                        },
                        "percentageComplete": {type: "number"},
                        "totalFiles": {type: "number"}
                    }
                },
                "dataScanning": {
                    type: "object",
                    properties: {
                        "status": {
                            type: "string",
                            enum: ["waiting", "in_progress", "complete"]
                        },
                        "percentageComplete": {type: "number"},
                        "totalObjects": {type: "number"},
                        "trainingSetSize": {type: "number"},
                        "testingSetSize": {type: "number"},
                        "scannedObjects": {type: "number"},
                        "timeToLoadEntry": {type: "number"}
                    }
                },
                "training": {
                    type: "object",
                    properties: {
                        "status": {
                            type: "string",
                            enum: ["waiting", "in_progress", "complete"]
                        },
                        "percentageComplete": {type: "number"},
                        "completedIterations": {type: "number"},
                        "totalIterations": {type: "number"},
                        "currentLoss": {type: "number"},
                        "currentAccuracy": {type: "number"},
                        "currentTimePerIteration": {type: "number"},
                        "iterations": {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    "accuracy": {type: "number"},
                                    "trainingAccuracy": {type: "number"},
                                    "loss": {type: "number"}
                                }
                            }
                        },
                        "performance": EBPerformanceData.schema()
                    }
                },
                "testing": {
                    type: "object",
                    properties: {
                        "status": {
                            type: "string",
                            enum: ["waiting", "in_progress", "complete"]
                        },
                        "totalObjects": {type: "number"},
                        "completedObjects": {type: "number"},
                        "percentageComplete": {type: "number"},
                        "accuracies": {type: "number"},
                        "accuracy": {type: "number"}
                    }
                },
                "bundle": {
                    type: "object",
                    properties: {
                        "status": {
                            type: "string",
                            enum: ["waiting", "in_progress", "complete"]
                        },
                        "step": {
                            type: "string",
                            enum: ["downloading_model_parameters", "copying_eb_files", "zipping", "uploading", "cleaning"]
                        },
                        "percentageComplete": {type: "number"}
                    }
                }
            }
        };
    }
}

EBClassFactory.registerClass('EBModel', EBModel, EBModel.schema());

module.exports = EBModel;
