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
    async = require('async'),
    EBAPIRoot = require('./EBAPIRoot'),
    EBClassFactory = require("../../shared/components/EBClassFactory"),
    EBCustomTransformationProcess = require("../components/architecture/EBCustomTransformationProcess"),
    EBMatchingArchitecture = require("../../plugins/matching_architecture/shared/models/EBMatchingArchitecture"),
    EBSchemaDetector = require("../components/datasource/EBSchemaDetector"),
    EBMatchingTorchProcess = require("../../plugins/matching_architecture/server/EBMatchingTorchProcess"),
    EBTransformTorchProcess = require("../../plugins/transform_architecture/server/EBTransformTorchProcess"),
    EBTransformArchitecture = require("../../plugins/transform_architecture/shared/models/EBTransformArchitecture"),
    idUtilities = require("../utilities/id"),
    models = require('../../shared/models/models'),
    Promise = require('bluebird'),
    schemaUtilities = require("../models/schema_utilities"),
    underscore = require('underscore');

/**
 * This handles API routes related to architectures objects
 */
class EBArchitectureAPI extends EBAPIRoot
{
    /**
     * Creates a new EBArchitectureAPI
     *
     * @param {object} application The top level EBApplication object
     */
    constructor(application)
    {
        super(application);
        this.application = application;
        this.architectures = application.db.collection("EBArchitecture");
    }

    /**
     * Registers all of the endpoints with the express application
     *
     * @param {object} expressApplication This is an express application object.
     */
    setupEndpoints(expressApplication)
    {
        const architectureSchema = {
            "anyOf": [
                EBTransformArchitecture.schema(),
                EBMatchingArchitecture.schema()
            ]
        };

        this.registerEndpoint(expressApplication, {
            "name": "CreateArchitecture",
            "uri": "/architectures",
            "method": "POST",
            "inputSchema": architectureSchema,
            "outputSchema": {
                "id": "/CreateArchitectureOutput",
                "type": "object",
                "properties": { }
            },
            "handler": this.createArchitecture.bind(this)
        });

        this.registerEndpoint(expressApplication, {
            "name": "ListArchitectures",
            "uri": "/architectures",
            "method": "GET",
            "inputSchema": {
                "id": "/ListArchitecturesInput",
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "number",
                        "default": 100
                    },
                    "select": {
                        "type": "array",
                        "items": {"type": "string"}
                    }
                }
            },
            "outputSchema": {
                "id": "/ListArchitecturesOutput",
                "type": "object",
                "properties": {
                    "architectures": {
                        "type": "array",
                        "items": architectureSchema
                    }
                }
            },
            "handler": this.getArchitectures.bind(this)
        });

        this.registerEndpoint(expressApplication, {
            "name": "GetTransformedSample",
            "uri": "/architectures/:id/sample/transform",
            "method": "GET",
            "inputSchema": {},
            "outputSchema": {
                "type": "object",
                "properties": { }
            },
            "handler": this.getTransformedSample.bind(this)
        });

        this.registerEndpoint(expressApplication, {
            "name": "GetArchitectureDiagram",
            "uri": "/architectures/:id/diagrams",
            "method": "GET",
            "inputSchema": {},
            "outputSchema": {
                "type": "object",
                "properties": {
                    diagrams: {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                file: {"type": "string"},
                                data: {"type": "string"}
                            }
                        }
                    }
                }
            },
            "handler": this.getDiagrams.bind(this)
        });

        this.registerEndpoint(expressApplication, {
            "name": "GetArchitecture",
            "uri": "/architectures/:id",
            "method": "GET",
            "inputSchema": {},
            "outputSchema": architectureSchema,
            "handler": this.getArchitecture.bind(this)
        });

        this.registerEndpoint(expressApplication, {
            "name": "EditArchitecture",
            "uri": "/architectures/:id",
            "method": "PUT",
            "inputSchema": architectureSchema,
            "outputSchema": {
                "id": "/EditArchitectureOutput",
                "type": "object",
                "properties": {}
            },
            "handler": this.editArchitecture.bind(this)
        });

        this.registerEndpoint(expressApplication, {
            "name": "DeleteArchitecture",
            "uri": "/architectures/:id",
            "method": "DELETE",
            "inputSchema": {
                "id": "/DeleteArchitectureInput",
                "type": "object",
                "properties": {}
            },
            "outputSchema": {
                "id": "/DeleteArchitectureOutput",
                "type": "object",
                "properties": {}
            },
            "handler": this.deleteArchitecture.bind(this)
        });
    }


    /**
     * This endpoint is used to create a new architectures object in the system
     *
     * @param {object} req express request object
     * @param {object} res express response object
     * @param {function} next express callback
     */
    createArchitecture(req, res, next)
    {
        const self = this;
        idUtilities.getUniqueID(self.application, 'architecture', function(err, id)
        {
            if (err)
            {
                return next(err);
            }

            const newArchitecture = req.body;
            newArchitecture._id = id;
            newArchitecture.createdAt = new Date();
            self.architectures.insert(newArchitecture, function(err, info)
            {
                if (err)
                {
                    return next(err);
                }
                else
                {
                    return next(null, {_id: id});
                }
            });
        });
    }


    /**
     * This endpoint is used to list the existing architectures
     *
     * @param {object} req express request object
     * @param {object} res express response object
     * @param {function} next express callback
     */
    getArchitectures(req, res, next)
    {
        let limit = 100;
        if (req.query.limit)
        {
            limit = req.query.limit;
        }

        const options = {
            sort: {
                createdAt: -1,
                _id: -1
            },
            limit: limit
        };

        if (req.query.select)
        {
            options.fields = underscore.object(req.query.select, new Array(req.query.select.length).fill(1));
            
            // Make sure to request the class-types
            options.fields.classType = 1;
        }

        const queryObject = this.architectures.find({}, options);
        queryObject.toArray(function(err, architectures)
        {
            if (err)
            {
                return next(err);
            }

            return next(null, {"architectures": architectures});
        });
    }


    /**
     * This endpoint is used to fetch a single architectures object
     *
     * @param {object} req express request object
     * @param {object} res express response object
     * @param {function} next express callback
     */
    getArchitecture(req, res, next)
    {
        this.architectures.findOne({_id: Number(req.params.id)}, function(err, result)
        {
            if (err)
            {
                return next(err);
            }
            else if (!result)
            {
                return next(new Error("EBArchitecture not found!"));
            }
            else
            {
                return next(null, result);
            }
        });
    }


    /**
     * This endpoint is used for editing existing resources
     *
     * @param {object} req express request object
     * @param {object} res express response object
     * @param {function} next express callback
     */
    editArchitecture(req, res, next)
    {
        delete req.body._id;
        this.architectures.findAndModify({_id: Number(req.params.id)}, {_id: 1}, req.body, function(err, info)
        {
            if (err)
            {
                return next(err);
            }
            else if (info.ok === 0)
            {
                return next(new Error("EBArchitecture not found!"));
            }
            else
            {
                return next(null, {});
            }
        });
    }


    /**
     * This endpoint is used for deleting architecture objects
     *
     * @param {object} req express request object
     * @param {object} res express response object
     * @param {function} next express callback
     */
    deleteArchitecture(req, res, next)
    {
        delete req.body._id;
        this.architectures.remove({_id: Number(req.params.id)}, function(err, info)
        {
            if (err)
            {
                return next(err);
            }
            else if (info.result.n !== 1)
            {
                return next(new Error(`EBArchitecture not found with id ${Number(req.params.id)}!`));
            }
            else
            {
                return next(null, {});
            }
        });
    }


    /**
     * This endpoint is used for getting a random sample of objects that have been transformed by the input-transformations
     * associated with this object
     *
     * @param {object} req express request object
     * @param {object} res express response object
     * @param {function} next express callback
     */
    getTransformedSample(req, res, next)
    {
        // Need to update!
        
        // const self = this;
        // this.architectures.findOne({_id: Number(req.params.id)}, function(err, architectureObject)
        // {
        //     if (err)
        //     {
        //         return next(err);
        //     }
        //     else if (!architectureObject)
        //     {
        //         return next(new Error("EBArchitecture not found!"));
        //     }
        //     else
        //     {
        //         const schemaDetector = new EBSchemaDetector(self.application);
        //         const numberOfObjectsToSample = 500;
        //         const architecture = EBClassFactory.createObject(architectureObject);
        //         const sourceSchema = architecture.dataSource.dataSchema.filterIncluded();
        //         const filterFunction = sourceSchema.filterFunction();
        //
        //         const transformStream = EBCustomTransformationProcess.createCustomTransformationStream(architecture);
        //         transformStream.on('data', function(object)
        //         {
        //             transformStream.pause();
        //             schemaDetector.accumulateObject(object, false).then(() =>
        //             {
        //                 transformStream.resume();
        //             }, (err) =>
        //             {
        //                 console.error(err);
        //                 throw err;
        //             });
        //         });
        //         transformStream.on('error', function(error)
        //         {
        //             return next(error);
        //         });
        //
        //         // Sample the datasource
        //         self.application.dataSourcePluginDispatch.sample(numberOfObjectsToSample, architecture.dataSource, function(object)
        //         {
        //             return Promise.fromCallback(function(next)
        //             {
        //                 try
        //                 {
        //                     const filteredObject = filterFunction(object);
        //                     transformStream.write(filteredObject, next);
        //                 }
        //                 catch (err)
        //                 {
        //                     console.error(`Object in our database is not valid according to our data schema: ${err.toString()}`);
        //                     return next(err);
        //                 }
        //             });
        //         }).then(function success()
        //         {
        //             transformStream.end(function(err)
        //             {
        //                 if (err)
        //                 {
        //                     return next(err);
        //                 }
        //
        //                 const schema = schemaDetector.getSchema();
        //
        //                 schema.walk((field) =>
        //                 {
        //                     field.configuration.interpretation = self.application.interpretationRegistry.getInterpretation(field.metadata.mainInterpretation).generateDefaultConfiguration(field);
        //                 });
        //
        //                 const result = {schema: schema};
        //                 return next(null, result);
        //             });
        //         }, (err) => next(err));
        //     }
        // });
    }


    /**
     * This endpoint is allows retrieving network diagrams
     *
     * @param {object} req express request object
     * @param {object} res express response object
     * @param {function} next express callback
     */
    getDiagrams(req, res, next)
    {
        const self = this;
        this.architectures.findOne({_id: Number(req.params.id)}, function(err, architectureObject)
        {
            if (err)
            {
                return next(err);
            }
            else if (!architectureObject)
            {
                return next(new Error("EBArchitecture not found!"));
            }
            else
            {
                const architecture = EBClassFactory.createObject(architectureObject);
                const architecturePlugin = self.application.architectureRegistry.getPluginForArchitecture(architecture);
                let process = architecturePlugin.getTorchProcess(architecture, self.application.config.get('overrideModelFolder'));
                
                async.series([
                    function generateCode(next)
                    {
                        const promise = process.generateCode(self.application.interpretationRegistry, self.application.neuralNetworkComponentDispatch);
                        promise.then(() => next(), (err) => next(err));
                    },
                    function startProcess(next)
                    {
                        const promise = process.startProcess();

                        promise.then(() => next(), (err) => next(err));
                    },
                    // Reset params, forces the network to be generated
                    function resetParams(next)
                    {
                        const promise = process.reset(-0.08, 0.08, "adamax", {});
                        promise.then(() => next(), (err) => next(err));
                    }
                ], function(err)
                {
                    if (err)
                    {
                        return next(err);
                    }

                    const promise = process.extractNetworkDiagrams();
                    promise.then((diagrams) =>
                    {
                        const promise = process.killProcess();
                        promise.then(() =>
                        {
                            return next(null, {
                                diagrams: diagrams.map((diagram) =>
                                {
                                    return {
                                        file: diagram.file,
                                        data: diagram.data.toString('base64')
                                    };
                                })
                            });
                        }, (err) => next(err));
                    }, (err) => next(err));
                });
            }
        });
    }
}


module.exports = EBArchitectureAPI;

