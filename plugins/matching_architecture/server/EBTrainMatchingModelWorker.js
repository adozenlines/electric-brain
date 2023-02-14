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
    EBCustomTransformationProcess = require('../../../server/components/architecture/EBCustomTransformationProcess'),
    EBNeuralTransformer = require('../../../shared/components/architecture/EBNeuralTransformer'),
    EBMatchingTorchProcess = require("./EBMatchingTorchProcess"),
    EBStdioScript = require("../../../server/components/EBStdioScript"),
    fs = require('fs'),
    models = require("../../../shared/models/models"),
    Promise = require('bluebird'),
    underscore = require('underscore');

class EBTrainMatchingModelWorker extends EBStdioScript
{
    constructor(application)
    {
        super();
        this.application = application;
        this.socketio = application.socketio;
        this.models = application.db.collection("EBModel");
    }

    /**
     * Process a single message from the parent class.
     *
     * @param {object} message The message received from the surrounding manager process
     * @returns {Promise} A promise that should resolve to the response
     */
    processMessage(message)
    {
        if (message.type === 'initialize')
        {
            // Retrieve the model object frm the initialization
            return this.models.find({_id: message.id}).toArray().then((objects) =>
            {
                if (objects.length === 0)
                {
                    return Promise.rejected(new Error("EBModel not found!"));
                }
                else
                {
                    this.model = new models.EBModel(objects[0]);
                    this.architecturePlugin = this.application.architectureRegistry.getPluginForArchitecture(this.model.architecture);
                    this.trainingProcess = new EBMatchingTorchProcess(this.model.architecture, this.architecturePlugin);
                    
                    this.primaryTransformer = new EBNeuralTransformer(this.model.architecture.primarySchema);
                    this.secondaryTransformer = new EBNeuralTransformer(this.model.architecture.secondarySchema);
                    
                    this.trainingProcess.generateCode(this.application.interpretationRegistry, this.application.neuralNetworkComponentDispatch).then(() =>
                    {
                        return this.trainingProcess.startProcess();
                    });
                }
            }).then(() =>
            {
                return {"type": "initialized"};
            });
        }
        else if (message.type === 'prepareBatch')
        {
            // All the ids that need to be fetched
            return Promise.map(message.ids, (id) => this.fetchPair(id)).then((pairs) =>
            {
                const primaryObjects = [];
                const primaryIds = [];

                const secondaryObjects = [];
                const secondaryIds = [];

                const valences = [];

                pairs.forEach((pair) =>
                {
                    primaryObjects.push(pair.primary);
                    primaryIds.push(pair.primaryId);

                    secondaryObjects.push(pair.secondary);
                    secondaryIds.push(pair.secondaryId);

                    valences.push(pair.valence);
                });

                return this.trainingProcess.prepareBatch(primaryIds, primaryObjects, secondaryIds, secondaryObjects, valences, message.fileName).then(() =>
                {
                    return {
                        "type": "batchPrepared",
                        "batchNumber": message.batchNumber
                    };
                });
            });
        }
        else
        {
            return Promise.reject(new Error(`Unknown message type ${message.type}.`));
        }
    }


    /**
     * This method fetches the given object, along with either a similar or dissimilar secondary object
     *
     * @param {string} primaryID The id of the primary object to be fetched
     * @returns {Promise} A promise that will resolve to the object,
     */
    fetchPair(primaryID)
    {
        // Fetch the object
        return this.application.dataSourcePluginDispatch.fetch(this.model.architecture.primaryDataSource, {id: primaryID}).then((primaryObjects) =>
        {
            // Construct a query for the linkages data set
            const query = {};

            if (this.model.architecture.primaryLinkFields.length === 0)
            {
                throw new Error(`There are no fields to use for linkages on the primary data set`);
            }
            if (this.model.architecture.secondaryLinkFields.length === 0)
            {
                throw new Error(`There are no fields to use for linkages on the secondary data set`);
            }

            let primaryObject = primaryObjects[0];

            this.model.architecture.primaryLinkFields.forEach((link) =>
            {
                query[link.rightField.substr(1)] = primaryObject[link.leftField.substr(1)];
            });

            // Fetch associated linkages
            return this.application.dataSourcePluginDispatch.fetch(this.model.architecture.linkagesDataSource, query).then((linkages) =>
            {
                // Now, we randomly decide if this is a similarity or difference pair.
                // If there are no linkages, then by default this is a difference pair
                let valence = -1;
                if (linkages.length > 0)
                {
                    valence = (Math.random() > 0.5 ? 1 : -1);
                }

                let query = {};

                if (valence < 0)
                {
                    // Request an object that doesn't fit any of the linkages
                    linkages.forEach((linkage) =>
                    {
                        if (!linkage.weight || linkage.weight > 0)
                        {
                            this.model.architecture.secondaryLinkFields.forEach((link) =>
                            {
                                if (!query[link.leftField.substr(1)])
                                {
                                    query[link.leftField.substr(1)] = {$nin: []};
                                }

                                query[link.leftField.substr(1)].$nin.push(linkage[link.rightField.substr(1)]);
                            });
                        }
                    });
                }
                else
                {
                    // Choose a random linkage
                    const randomLinkage = this.chooseRandomLinkage(linkages, valence);
                    if (randomLinkage)
                    {
                        this.model.architecture.secondaryLinkFields.forEach((link) =>
                        {
                            query[link.leftField.substr(1)] = randomLinkage[link.rightField.substr(1)];
                        });
                    }
                }

                return this.application.dataSourcePluginDispatch.fetch(this.model.architecture.secondaryDataSource, query).then((secondaryObjects) =>
                {
                    // Choose a secondary object at random
                    const secondaryObject = secondaryObjects[Math.floor(secondaryObjects.length * Math.random())];


                    return this.primaryTransformer.convertObjectIn(this.application.interpretationRegistry, primaryObject).then((convertedPrimary) =>
                    {
                        return this.secondaryTransformer.convertObjectIn(this.application.interpretationRegistry, secondaryObject).then((convertedSecondary) =>
                        {
                            // Finally, return the pairing of the two
                            return {
                                primary: convertedPrimary,
                                primaryId: primaryObject.id,
                                secondary: convertedSecondary,
                                secondaryId: secondaryObject.id,
                                valence: valence
                            };
                        });
                    });
                });
            });
        });
    }


    /**
     * This method chooses a random linkage out of a list
     *
     * @param {[linkageObjects]} linkages The list of linkage objects
     * @param {number} valence The valence to choose for
     * @returns {linkageObject} A single linkage object
     */
    chooseRandomLinkage(linkages, valence)
    {
        // Randomly choose a linkage based on the weight
        let weight = 0;
        linkages.forEach((linkage) =>
        {
            if (valence < 0 && linkage.weight < 0)
            {
                weight += -linkage.weight;
            }
            else if (valence > 0 && linkage.weight > 0)
            {
                weight += linkage.weight;
            }
        });

        // Choose random number
        let random = Math.random() * weight;

        weight = 0;

        // Return the correct linkage
        for(let n = 0; n < linkages.length; n += 1)
        {
            const linkage = linkages[n];
            if (valence < 0 && linkage.weight < 0)
            {
                weight += -linkage.weight;
            }
            else if (valence > 0 && linkage.weight > 0)
            {
                weight += linkage.weight;
            }

            if (random < weight)
            {
                return linkage;
            }
        }

        // Return the last linkage, or null
        if (linkages.length === 0)
        {
            return null;
        }
        else
        {
            return linkages[linkages.length - 1];
        }
    }
};


module.exports = EBTrainMatchingModelWorker;