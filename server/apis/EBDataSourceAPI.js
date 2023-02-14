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
    EBAPIRoot = require('./EBAPIRoot'),
    idUtilities = require("../utilities/id"),
    models = require('../../shared/models/models'),
    mongodb = require('mongodb'),
    queryUtilities = require("../../shared/utilities/query"),
    schemaUtilities = require("../models/schema_utilities"),
    tasks = require("../tasks/tasks"),
    tus = require('tus-node-server'),
    underscore = require('underscore');

/**
 * This handles API routes related data source objects.
 */
class EBDataSourceAPI extends EBAPIRoot
{
    /**
     * Creates a new EBDataSourceAPI
     *
     * @param {object} application The top level EBApplication object
     */
    constructor(application)
    {
        super(application);
        this.application = application;
        this.dataSources = application.db.collection("EBDataSource");
        this.uploads = new mongodb.GridFSBucket(application.db, {bucketName: 'uploads'});
    }

    /**
     * Registers all of the endpoints with the express application
     *
     * @param {object} expressApplication This is an express application object.
     */
    setupEndpoints(expressApplication)
    {
        const self = this;
        const uploadServer = new tus.Server();
        uploadServer.datastore = new tus.MongoGridFSStore({
            uri: this.application.config.get('mongo'),
            bucket: "uploads",
            path: '/api/uploads'
        });

        expressApplication.all('/api/uploads', function(req, res)
        {
            uploadServer.handle(req, res);
        });
        expressApplication.post('/api/uploads/*', function(req, res)
        {
            uploadServer.handle(req, res);
        });
        expressApplication.patch('/api/uploads/*', function(req, res)
        {
            uploadServer.handle(req, res);
        });
        expressApplication.put('/api/uploads/*', function(req, res)
        {
            uploadServer.handle(req, res);
        });
        expressApplication.head('/api/uploads/*', function(req, res)
        {
            uploadServer.handle(req, res);
        });
        expressApplication.get('/api/uploads/:id', function(req, res)
        {
            self.retrieveUpload(req, res);
        });
        
        this.dataSourceOutputSchema = schemaUtilities.getReducedSchema("DataSourceOutput", models.EBDataSource.schema(), {
            "_id": true,
            "name": true,
            "database": true,
            "dataSchema": true
        });

        this.registerEndpoint(expressApplication, {
            "name": "GetSupportedDataSources",
            "uri": "/data-source-types",
            "method": "GET",
            "inputSchema": {},
            "outputSchema": {
                "id": "/GetSupportedDataSourcesOutput",
                "type": "object",
                "properties": {
                    "types": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "icon": {"type": "string"}
                            }
                        }
                    }
                }
            },
            "handler": this.getSupportedDataSources.bind(this)
        });

        this.registerEndpoint(expressApplication, {
            "name": "CreateDataSource",
            "uri": "/data-sources",
            "method": "POST",
            "inputSchema": schemaUtilities.getReducedSchema("CreateDataSourceInput", models.EBDataSource.schema(), {
                "name": true,
                "file": true,
                "database": true,
                "dataSchema": true
            }),
            "outputSchema": {
                "id": "/CreateDataSourceOutput",
                "type": "object",
                "properties": {"_id": {"type": "string"}}
            },
            "handler": this.createDataSources.bind(this)
        });

        this.registerEndpoint(expressApplication, {
            "name": "ListDataSources",
            "uri": "/data-sources",
            "method": "GET",
            "inputSchema": {
                "id": "/ListDataSourcesInput",
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "number",
                        "default": 100
                    },
                    "select": {
                        "type": "array",
                        "items": {"type": "string"}
                    },
                    "query": {
                        "type": "object",
                        "properties": {"isSampling": {"type": "boolean"}},
                        "additionalProperties": true
                    }
                }
            },
            "outputSchema": {
                "id": "/ListDataSourcesOutput",
                "type": "object",
                "properties": {
                    "dataSources": {
                        "type": "array",
                        "items": this.dataSourceOutputSchema
                    }
                }
            },
            "handler": this.getDataSources.bind(this)
        });

        this.registerEndpoint(expressApplication, {
            "name": "GetDataSource",
            "uri": "/data-sources/:id",
            "method": "GET",
            "inputSchema": {},
            "outputSchema": this.dataSourceOutputSchema,
            "handler": this.getDataSource.bind(this)
        });

        this.registerEndpoint(expressApplication, {
            "name": "EditDataSource",
            "uri": "/data-sources/:id",
            "method": "PUT",
            "inputSchema": schemaUtilities.getReducedSchema("EditDataSourceInput", models.EBDataSource.schema(), {
                "name": true,
                "database": true,
                "dataSchema": true
            }),
            "outputSchema": {
                "id": "/EditDataSourceOutput",
                "type": "object",
                "properties": {}
            },
            "handler": this.editDataSource.bind(this)
        });

        this.registerEndpoint(expressApplication, {
            "name": "DeleteDataSource",
            "uri": "/data-sources/:id",
            "method": "DELETE",
            "inputSchema": {
                "id": "/DeleteDataSourceInput",
                "type": "object",
                "properties": {}
            },
            "outputSchema": {
                "id": "/DeleteDataSourceOutput",
                "type": "object",
                "properties": {}
            },
            "handler": this.deleteDataSource.bind(this)
        });

        this.registerEndpoint(expressApplication, {
            "name": "DetectDatabase",
            "uri": "/database/detect",
            "method": "GET",
            "inputSchema": {
                "id": "/DetectDatabaseInput",
                "type": "object",
                "properties": {"type": {"type": "string"}}
            },
            "outputSchema": {
                "id": "/DetectDatabaseOutput",
                "type": "object",
                "properties": {
                    "databases": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "collections": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {"name": {"type": "string"}}
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "handler": this.detectDatabase.bind(this)
        });

        this.registerEndpoint(expressApplication, {
            "name": "GetDatabaseInfo",
            "uri": "/database",
            "method": "GET",
            "inputSchema": schemaUtilities.getReducedSchema("GetDatabaseInfoInput", models.EBDataSource.schema(), {"database": true}),
            "outputSchema": {
                "id": "/GetDatabaseInfoOutput",
                "type": "object",
                "properties": {
                    "collections": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {"name": {"type": "string"}}
                        }
                    }
                }
            },
            "handler": this.getDatabaseInfo.bind(this)
        });

        this.registerEndpoint(expressApplication, {
            "name": "GetDatabaseCollectionSchema",
            "uri": "/database/schema",
            "method": "GET",
            "inputSchema": schemaUtilities.getReducedSchema("GetDatabaseCollectionSchemaInput", models.EBDataSource.schema(), {"type": true, "file": true, "database": true}),
            "outputSchema": {
                "id": "/GetDatabaseCollectionSchemaOutput",
                "type": "object",
                "properties": {"dataSchema": models.EBSchema.schema()}
            },
            "handler": this.getDatabaseCollectionSchema.bind(this)
        });

        this.registerEndpoint(expressApplication, {
            "name": "SampleDataSource",
            "uri": "/dataSource/:id/sample",
            "method": "POST",
            "inputSchema": {
                "id": "/SampleDataSourceInput",
                "type": "object",
                "properties": { }
            },
            "outputSchema": {
                "id": "/SampleDataSourceOutput",
                "type": "object",
                "properties": { }
            },
            "handler": this.startDataSourceSampling.bind(this)
        });

        this.registerEndpoint(expressApplication, {
            "name": "FindObjects",
            "uri": "/database/objects",
            "method": "GET",
            "inputSchema": {
                "id": "/FindObjectsInputSchema",
                "type": "object",
                "properties": {
                    "dataSource": models.EBDataSource.schema(),
                    "query": {
                        "type": "object",
                        "additionalProperties": true
                    },
                    "limit": {"type": "number"},
                    "select": {
                        "type": "array",
                        "items": {"type": "string"}
                    }
                }
            },
            "outputSchema": {
                "id": "/FindObjectsOutputSchema",
                "type": "object",
                "properties": {
                    "objects": {
                        "type": "array",
                        "items": {"type": "object"}
                    }
                }
            },
            "handler": this.findObjects.bind(this)
        });
    }

    /**
     * This method is used for retrieving files that were uploaded
     *
     * @param {object} req express request object
     * @param {object} res express response object
     */
    retrieveUpload(req, res)
    {
        this.uploads.openDownloadStream(new mongodb.ObjectID(req.params.id)).pipe(res);
    }


    /**
     * This endpoint is used to get a list of supported data sources.
     *
     * @param {object} req express request object
     * @param {object} res express response object
     * @param {function} next express callback
     */
    getSupportedDataSources(req, res, next)
    {
        const self = this;

        const dataSourceNames = self.application.dataSourcePluginDispatch.getSupportedDataSources();

        return next(null, {types: dataSourceNames.map((dataSource) => {
            return {
                name: dataSource.name,
                icon: dataSource.icon
            };
        })});
    }


    /**
     * This endpoint attempts to see if there is a database
     *
     * @param {object} req express request object
     * @param {object} res express response object
     * @param {function} next express callback
     */
    detectDatabase(req, res, next)
    {
        const self = this;
        self.application.dataSourcePluginDispatch.lookupTables(req.query).then(function(result)
        {
            return next(null, result);
        }, (err) => next(err));
    }

    /**
     * This endpoint connects to a database and gets basic information about it like what collections it has
     *
     * @param {object} req express request object
     * @param {object} res express response object
     * @param {function} next express callback
     */
    getDatabaseInfo(req, res, next)
    {
        mongodb.MongoClient.connect(req.query.database.uri, function(connectError, db)
        {
            if (connectError)
            {
                return next(connectError);
            }
            else
            {
                db.listCollections().toArray(function(err, collections)
                {
                    if (err)
                    {
                        return next(err);
                    }

                    const sortedCollections = underscore.sortBy(collections, (collection) => collection.name);

                    return next(null, {collections: sortedCollections});
                });
            }
        });
    }


    /**
     * This endpoint will analyze objects in a given collection within the database, and
     * automatically determine a reasonable schema for that collection
     *
     * @param {object} req express request object
     * @param {object} res express response object
     * @param {function} next express callback
     */
    getDatabaseCollectionSchema(req, res, next)
    {
        const self = this;
        self.application.dataSourcePluginDispatch.detectSchema(req.query).then(function(resultSchema)
        {
            return next(null, {"dataSchema": resultSchema});
        }, (err) => next(err));
    }


    /**
     * This endpoint will start a data-source sampling task
     *
     * @param {object} req express request object
     * @param {object} res express response object
     * @param {function} next express callback
     */
    startDataSourceSampling(req, res, next)
    {
        this.application.taskQueue.queueTask("sample_data_source", {_id: Number(req.params.id)}, (err, task) =>
        {
            if (err)
            {
                return next(err);
            }
            return next(null, {});
        });
    }


    /**
     * This endpoint is used to create a new data source
     *
     * @param {object} req express request object
     * @param {object} res express response object
     * @param {function} next express callback
     */
    createDataSources(req, res, next)
    {
        const self = this;
        idUtilities.getUniqueID(self.application, 'datasource', function(err, id)
        {
            if (err)
            {
                return next(err);
            }

            const newDataSource = req.body;
            newDataSource._id = id;
            newDataSource.createdAt = new Date();
            self.dataSources.insert(newDataSource, function(err, info)
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
     * This endpoint is used to list the existing data sources
     *
     * @param {object} req express request object
     * @param {object} res express response object
     * @param {function} next express callback
     */
    getDataSources(req, res, next)
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
        }

        let query = {};
        if (req.query.query)
        {
            query = req.query.query;
        }

        const queryObject = this.dataSources.find(query, options);
        queryObject.toArray(function(err, dataSources)
        {
            if (err)
            {
                return next(err);
            }

            return next(null, {"dataSources": dataSources});
        });
    }


    /**
     * This endpoint is used to fetch a single data source
     *
     * @param {object} req express request object
     * @param {object} res express response object
     * @param {function} next express callback
     */
    getDataSource(req, res, next)
    {
        this.dataSources.findOne({_id: Number(req.params.id)}, function(err, result)
        {
            if (err)
            {
                return next(err);
            }
            else if (!result)
            {
                return next(new Error("Datasource not found!"));
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
    editDataSource(req, res, next)
    {
        delete req.body._id;
        this.dataSources.findAndModify({_id: Number(req.params.id)}, {_id: 1}, req.body, function(err, info)
        {
            if (err)
            {
                return next(err);
            }
            else
            {
                return next(null, {});
            }
        });
    }


    /**
     * This endpoint is used for deleting data source objects
     *
     * @param {object} req express request object
     * @param {object} res express response object
     * @param {function} next express callback
     */
    deleteDataSource(req, res, next)
    {
        delete req.body._id;
        this.dataSources.remove({_id: Number(req.params.id)}, function(err, info)
        {
            if (err)
            {
                return next(err);
            }
            else if (info.result.n !== 1)
            {
                return next(new Error(`EBDataSource not found with id ${Number(req.params.id)}!`));
            }
            else
            {
                return next(null, {});
            }
        });
    }


    /**
     * This endpoint is used to find objects from the data source
     *
     * @param {object} req express request object
     * @param {object} res express response object
     * @param {function} next express callback
     */
    findObjects(req, res, next)
    {
        let limit = req.query.limit;
        if (!limit)
        {
            // default limit is 25
            limit = 25;
        }

        const query = queryUtilities.convertFrontendQueryToMongQuery(req.query.query);
        this.application.dataSourcePluginDispatch.fetch(req.query.dataSource, query, limit).then((objects) =>
        {
            return next(null, {objects: objects});
        }, (err) => next(err));
    }
}


module.exports = EBDataSourceAPI;

