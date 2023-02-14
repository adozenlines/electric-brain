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
    csv = require('fast-csv'),
    EBDataSourcePlugin = require("./../../../server/components/datasource/EBDataSourcePlugin"),
    EBSchemaDetector = require("./../../../server/components/datasource/EBSchemaDetector"),
    mongodb = require('mongodb'),
    Promise = require('bluebird'),
    queryUtilities = require("../../../shared/utilities/query"),
    randomUtilities = require('../../../shared/utilities/random'),
    underscore = require('underscore');

/**
 *  This class allows people to upload CSV files and use them as sources
 */
class EBCSVPlugin extends EBDataSourcePlugin
{
    /**
     *  The constructor for the EBCSVPlugin
     *
     * @param {EBApplicationBase} application The global EBApplication object.
     */
    constructor(application)
    {
        super();
        this.application = application;
        this.uploads = new mongodb.GridFSBucket(application.db, {bucketName: 'uploads'});
        this.csvRows = application.db.collection("csvRows");
        this.csvMetadata = application.db.collection("csvMetadata");
        this.indexPromise = this.csvRows.createIndex({ebCSVFile: 1, ebRowIndex: 1});
    }
    
    /**
     * This method returns the machine name for the data source
     *
     * @returns {string} A string containing the machine name
     */
    get name()
    {
        return "csv";
    }
    
    
    /**
     * This method returns the URL for the icon of the data source
     *
     * @returns {string} A string containing a URL that can be loaded from the frontend API
     */
    get icon()
    {
        return "/plugins/csv/img/csv.png";
    }


    /**
     * This method tests the connection to the data source.
     *
     * @param {EBDataSource} This should be an EBDataSource object to test the connection with.
     * @returns {Promise} A promise that will resolve successfully if the connection is available
     */
    test(dataSource)
    {
        console.log("test");
    }


    /**
     * This method lists all of the different tables within the database.
     *
     * @param {EBDataSource} This should be the EBDataSource object to find the tables with it
     * @returns {Promise} A promise that will resolve to the list of tables in the database.
     */
    lookupTables(dataSource)
    {
        console.log("lookup tables");

    }

    /**
     * This method takes a file stream and uploads it so that it can be used with this plugin.
     *
     * @param {ReadableStream} stream A read-stream that will be read from to provide the CSV data
     * @returns {Promise} A promise that will resolve when the file has been uploaded. It will resolve to the ID of the new upload.
     *
     */
    uploadFile(stream)
    {
        return new Promise((resolve, reject) =>
        {
            const uploadStream = this.uploads.openUploadStream('data.csv');
            const id = uploadStream.id;

            stream.pipe(uploadStream);

            // Wait for stream to finish
            uploadStream.once('finish', () =>
            {
                resolve(id);
            });
            uploadStream.once('error', (err) =>
            {
                reject(err);
            });
        });
    }


    /**
     * This method takes a CSV files and breaks it apart into a collection, which is then used for further analysis.
     *
     * @param {object} dataSource The data source object describing the database connection
     * @returns {Promise} A promise that will resolve to the total number of objects in the data source.
     *
     */
    breakApartCSV(dataSource)
    {
        const objectsPerGrouping = 1000;
        return this.indexPromise.then(() =>
        {
            return this.csvMetadata.find({ebCSVFile: dataSource.file}).toArray().then((results) =>
            {
                if (results.length === 0)
                {
                    let objectIndex = 0;
                    return new Promise((resolve, reject) =>
                    {
                        const stream = this.uploads.openDownloadStream(new mongodb.ObjectID(dataSource.file));

                        const options = {
                            objectMode: true,
                            headers: true
                        };

                        if (!dataSource.allowQuotedCSVFiles)
                        {
                            options.quote = null;
                        }

                        const csvStream = csv(options);
                        const cargo = async.cargo((objects, next) =>
                        {
                            objects.forEach(function(object)
                            {
                                object.ebCSVFile = dataSource.file;
                                object.ebRowIndex = objectIndex;
                                objectIndex += 1;
                            });

                            this.csvRows.insertMany(objects).then(function(success)
                            {
                                next();
                            }, (error) => next(error));
                        }, objectsPerGrouping);

                        csvStream.on("data", function (data)
                        {
                            // First convert all of the fields within the data
                            const converted = underscore.mapObject(data, function (value, key)
                            {
                                // If its a blank string or only whitespace, it becomes null
                                if (!value.trim())
                                {
                                    return null;
                                }

                                // Does it look like a number?
                                if (/^[+-]?\d+?$/g.test(value))
                                {
                                    return Number(value);
                                    // return value;
                                }
                                else if (/^[+-]?\d+\.\d+$/g.test(value))
                                {
                                    return Number(value);
                                    // return value;
                                }
                                else
                                {
                                    return value;
                                }
                            });

                            cargo.push(converted);
                        });

                        csvStream.on("end", () =>
                        {
                            if (cargo.length() === 0)
                            {
                                resolve();
                            }
                            else
                            {
                                cargo.drain = () =>
                                {
                                    resolve();
                                };
                            }
                        });

                        stream.on("error", (error) =>
                        {
                            reject(error);
                        });

                        stream.pipe(csvStream);
                    }).then((success) =>
                    {
                        this.csvMetadata.insertOne({
                            ebCSVFile: dataSource.file,
                            count: objectIndex + 1
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
        return this.breakApartCSV(dataSource).then((success) =>
        {
            return this.csvMetadata.findOne({ebCSVFile: dataSource.file}).then((metadata) =>
            {
                return metadata.count;
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
        return new Promise((resolve, reject) =>
        {
            this.breakApartCSV(dataSource).then((success) =>
            {
                this.csvMetadata.findOne({ebCSVFile: dataSource.file}).then((metadata) =>
                {
                    const numberOfObjectsToSample = Math.min(metadata.count, count);
                    const objectsPerGrouping = 1000;

                    // Generate a series of random indexes for objects within this collection that we will get
                    const randomObjectIndexes = randomUtilities.getRandomIntegers(metadata.count, numberOfObjectsToSample);
                    const cargo = async.cargo((indexes, next) =>
                    {
                        this.csvRows.find({
                            ebCSVFile: dataSource.file,
                            ebRowIndex: {$in: indexes}
                        }).toArray().then(function(rows)
                        {
                            const altered = underscore.shuffle(rows).map((row) =>
                            {
                                const newRow = underscore.omit(row, "_id", "ebCSVFile", "ebRowIndex");
                                newRow.id = row._id.toString();
                                return newRow;
                            });

                            async.eachSeries(altered, (row, next) =>
                            {
                                iterator(underscore.omit(row, "_id", "ebCSVFile", "ebRowIndex")).then((value) =>
                                    {
                                        next();
                                    },
                                    (error) =>
                                    {
                                        next(error);
                                    });
                            }, next);
                        }, (error) => next(error));
                    }, objectsPerGrouping);

                    cargo.push(randomObjectIndexes);

                    cargo.drain = () =>
                    {
                        resolve();
                    };

                    cargo.error = (err) =>
                    {
                        reject(err);
                    };
                }, (err) => reject(err));
            }, (err) => reject(err));
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
        return this.breakApartCSV(dataSource).then((success) =>
        {
            const modifiedQuery = underscore.omit(query, "id");

            if (query.id)
            {
                modifiedQuery._id = EBCSVPlugin.recursiveCoerceMongoID(query.id);
            }

            const queryObject = this.csvRows.find(modifiedQuery);

            if (limit)
            {
                queryObject.limit(limit);
            }

            return queryObject.toArray().then((rows) =>
            {
                return rows.map((row) =>
                {
                    const newRow = underscore.omit(row, "_id", "ebCSVFile", "ebRowIndex");
                    newRow.id = row._id.toString();
                    return newRow;
                });
            });
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
            return queryPortion.map((arrayValue) => EBCSVPlugin.recursiveCoerceMongoID(arrayValue));
        }
        else if (underscore.isObject(queryPortion))
        {
            return underscore.mapObject(queryPortion, function(value)
            {
                return EBCSVPlugin.recursiveCoerceMongoID(value);
            });
        }
        else
        {
            return queryPortion;
        }
    }
}

module.exports = EBCSVPlugin;