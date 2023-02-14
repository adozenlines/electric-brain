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
 along with this program.  If not, see <http://www.gnu.org/s/>.
 */

"use strict";

const
    async = require('async'),
    EBDataSourcePlugin = require("../../../server/components/datasource/EBDataSourcePlugin"),
    EBSchemaDetector = require("../../../server/components/datasource/EBSchemaDetector"),
    EBPerformanceData = require('../../../shared/models/EBPerformanceData'),
    EBPerformanceTrace = require('../../../shared/components/EBPerformanceTrace'),
    mongodb = require('mongodb'),
    Promise = require('bluebird'),
    queryUtilities = require("../../../shared/utilities/query"),
    randomUtilities = require('../../../shared/utilities/random'),
    underscore = require('underscore');

class EBMongoPlugin extends EBDataSourcePlugin
{
    /**
     *  The constructor for the EBCSVPlugin
     *
     * @param {EBApplicationBase} The global EBApplication object.
     */
    constructor(application)
    {
        super();

        this.application = application;
        this.performanceData = new EBPerformanceData();
        this.connections = {};
    }


    /**
     * This method returns the machine name for the data source
     *
     * @returns {string} A string containing the machine name
     */
    get name()
    {
        return "mongo";
    }


    /**
     * This method returns the URL for the icon of the data source
     *
     * @returns {string} A string containing a URL that can be loaded from the frontend API
     */
    get icon()
    {
        return "/plugins/mongo/img/mongodb-logo.jpg";
    }


    /**
     * This method tests the connection to the data source.
     *
     * @param {EBDataSource} This should be an EBDataSource object to test the connection with.
     * @returns {Promise} A promise that will resolve successfully if the connection is available
     */
    test(dataSource)
    {
        return Promise.fromCallback(function(done)
        {
            mongodb.MongoClient.connect(dataSource.database.uri, {promiseLibrary: Promise}, function(connectError, db)
            {
                if (connectError)
                {
                    return done(connectError);
                }
                else
                {
                    return db.close();
                }
            });
        });
    }


    /**
     * This method lists all of the different tables within the database.
     *
     * @param {EBDataSource} dataSource This should be the EBDataSource object to find the tables with it
     * @returns {Promise} A promise that will resolve to the list of tables in the database.
     */
    lookupTables(dataSource)
    {
        return Promise.fromCallback(function(done)
        {
            let database = dataSource.database;
            if (!database)
            {
                database = {uri: "mongodb://localhost:27017/admin"};
            }

            mongodb.MongoClient.connect(database.uri, {promiseLibrary: Promise}, function(connectError, db)
            {
                if (connectError)
                {
                    return done(connectError);
                }
                else
                {
                    // Use the admin database for the operation
                    const adminDb = db.admin();

                    adminDb.listDatabases(function(err, results)
                    {
                        if (err)
                        {
                            return done(err);
                        }

                        // For all the databases except local and admin, get the list of collections in that database
                        const databases = underscore.filter(results.databases, (database) => database.name !== 'local' && database.name !== 'admin');
                        async.mapSeries(databases, function(database, next)
                        {
                            const newDb = db.db(database.name);
                            newDb.listCollections().toArray(function(err, collections)
                            {
                                if (err)
                                {
                                    return next(err);
                                }

                                const sortedCollections = underscore.sortBy(collections, (collection) => collection.name);

                                return next(null, {
                                    name: database.name,
                                    collections: sortedCollections
                                });
                            });
                        }, function(err, databaseResults)
                        {
                            if (err)
                            {
                                return done(err);
                            }

                            const sortedDatabases = underscore.sortBy(databaseResults, (database) => database.name);
                            return done(null, {databases: sortedDatabases});
                        });
                    });
                }
            });
        });
    }


    /**
     * This method counts the number of objects that are available for sampling from a given data source
     *
     * @param {object} dataSource The data source object describing the database connection
     * @returns {Promise} A promise that will resolve to the total number of objects in the data source.
     *
     */
    count(dataSource)
    {
        return Promise.fromCallback(function(done)
        {
            mongodb.MongoClient.connect(dataSource.database.uri, {promiseLibrary: Promise}, function(connectError, db)
            {
                if (connectError)
                {
                    return done(connectError);
                }
                else
                {
                    // Get the desired collection
                    const collection = db.collection(dataSource.database.collection);

                    // Assemble the base query we want to make
                    const baseQuery = queryUtilities.convertFrontendQueryToMongQuery(dataSource.query);

                    // Start with the total number of objects within the collection
                    collection.count(baseQuery, done);
                }
            });
        });
    }


    /**
     * This method samples the given data source object, returning objects to the iterator
     *
     * @param {number} count The number of database objects to sample
     * @param {object} dataSource The data source object describing the database connection
     * @param {function(object)} iterator A callback that will be called once for each object returned in the random sample. The iterator should return a Promise.
     * @returns {Promise} A promise that will resolve when the sample is finished
     *
     */
    sample(count, dataSource, iterator)
    {
        const self = this;
        return Promise.fromCallback(function(done)
        {
            mongodb.MongoClient.connect(dataSource.database.uri, {promiseLibrary: Promise}, function(connectError, db)
            {
                if (connectError)
                {
                    return done(connectError);
                }
                else
                {
                    // Get the desired collection
                    const collection = db.collection(dataSource.database.collection);

                    // Assemble the base query we want to make
                    const baseQuery = queryUtilities.convertFrontendQueryToMongQuery(dataSource.query);

                    // Start with the total number of objects within the collection
                    collection.count(baseQuery, function(err, totalObjects)
                    {
                        if (err)
                        {
                            return done(err);
                        }

                        const numberOfObjectsToSample = Math.min(totalObjects, count);

                        // Generate a series of random indexes for objects within this collection that we will get
                        const randomObjectIndexes = randomUtilities.getRandomIntegers(totalObjects, numberOfObjectsToSample);

                        // Now we make a series of database requests, fetching the ids of the objects
                        let processedObjects = 0;
                        let currentQuery = {};
                        let lastIndex = 0;
                        let moreObjectsAvailable = true;
                        async.whilst(function()
                            {
                                // console.log("testing");
                                return processedObjects < numberOfObjectsToSample && moreObjectsAvailable;
                            },
                            function(next)
                            {
                                const trace = new EBPerformanceTrace();

                                const index = randomObjectIndexes[processedObjects];

                                const query = underscore.extend({}, baseQuery, currentQuery);
                                collection.find(query).sort({_id: 1}).limit(1).skip(index - lastIndex).toArray(function(err, objects)
                                {
                                    trace.addTrace('query');
                                    if (err)
                                    {
                                        return next(err);
                                    }
                                    else if (objects.length === 0)
                                    {
                                        // No object is found. Its possible the number of objects in the database
                                        // has changed while the sampling has been occurring. We end processing
                                        // at this point
                                        moreObjectsAvailable = false;
                                        return next();
                                    }
                                    else
                                    {
                                        processedObjects += 1;
                                        lastIndex = index;
                                        currentQuery = {_id: {$gte: objects[0]._id}};

                                        const converted = EBMongoPlugin.convertMongoObjectToJSON(objects[0]);

                                        // Change _id to id
                                        converted.id = converted._id;
                                        delete converted._id;

                                        trace.addTrace('convert-object');

                                        // Call the iterator with the converted object
                                        iterator(converted).then(
                                            function success()
                                            {
                                                trace.addTrace('iterator');
                                                self.performanceData.accumulate(trace);
                                                return next();
                                            },
                                            function(err)
                                            {
                                                return next(err);
                                            }
                                        );
                                    }
                                });
                            },
                            function(err)
                            {
                                if (err)
                                {
                                    return done(err);
                                }

                                return done(null);
                            });
                    });
                }
            });
        });
    }


    /**
     * This method is used for fetching specific objects from the data set
     *
     * @param {object} dataSource The data source object describing the database connection
     * @param {object} query The query to be used to fetch objects with.
     * @param {number} [limit] optional The maximum number of objects to fetch. A default value of 25.
     * @returns {Promise} A promise that will resolve to the total number of objects in the data source.
     *
     */
    fetch(dataSource, query, limit)
    {
        return this.getConnection(dataSource).then((db) =>
        {
            // Get the desired collection
            const collection = db.collection(dataSource.database.collection);

            const modifiedQuery = underscore.omit(query, "id");

            if (query.id)
            {
                modifiedQuery._id = EBMongoPlugin.recursiveCoerceMongoID(query.id);
            }

            const queryObject = collection.find(modifiedQuery);

            if (limit)
            {
                queryObject.limit(limit);
            }

            return queryObject.toArray().then((rows) =>
            {
                return rows.map((row) =>
                {
                    const newRow = EBMongoPlugin.convertMongoObjectToJSON(underscore.omit(row, "_id"));
                    newRow.id = row._id;
                    return newRow;
                });
            });
        });
    }


    /**
     * This method returns the mongo db connection to a data source
     *
     * @param {EBDataSource} This should be an EBDataSource object that we need a connection for
     * @returns {Promise} A promise that will resolve with the database object
     */
    getConnection(dataSource)
    {
        if (!this.connections[dataSource.database.uri])
        {
            this.connections[dataSource.database.uri] = mongodb.MongoClient.connect(dataSource.database.uri, {promiseLibrary: Promise});
        }

        return this.connections[dataSource.database.uri];
    }


    /**
     * This static function is used to convert objects that come out of Mongo into pure JSON
     *
     * @param {object} subObject The object to be converted
     * @returns {object} A pure JSON object
     */
    static convertMongoObjectToJSON(subObject)
    {
        // First we have to convert Mongo types like ObjectID, Date and RegExp into
        // vanilla JSON. Currently, the only non-json compatible output is binary
        // data, which will be output as a Buffer object.
        return underscore.mapObject(subObject, (value) =>
        {
            if (value instanceof Date)
            {
                return value.toISOString();
            }
            else if (value instanceof RegExp)
            {
                return value.toString();
            }
            else if (value instanceof mongodb.ObjectId)
            {
                return value.toString();
            }
            else if (value instanceof mongodb.Binary)
            {
                return value.buffer;
            }
            else if (value instanceof mongodb.DBRef)
            {
                return value.toString();
            }
            else if (value instanceof Array)
            {
                return value.map((arrayValue) => EBMongoPlugin.convertMongoObjectToJSON(arrayValue));
            }
            else if (value instanceof Object)
            {
                return EBMongoPlugin.convertMongoObjectToJSON(value);
            }
            else
            {
                return value;
            }
        });
    }

    /**
     * This method will convert all of the string values in the Mongo query portion provided into
     * mongo.ObjectIDs
     *
     * @param {object} queryPortion The portion of the query to recursively coerce.
     */
    static recursiveCoerceMongoID(queryPortion)
    {
        if (underscore.isString(queryPortion))
        {
            return new mongodb.ObjectId(queryPortion);
        }
        else if (underscore.isArray(queryPortion))
        {
            return queryPortion.map((arrayValue) => EBMongoPlugin.recursiveCoerceMongoID(arrayValue));
        }
        else if (underscore.isObject(queryPortion))
        {
            return underscore.mapObject(queryPortion, function(value)
            {
                return EBMongoPlugin.recursiveCoerceMongoID(value);
            });
        }
        else
        {
            return queryPortion;
        }
    }
}

module.exports = EBMongoPlugin;
