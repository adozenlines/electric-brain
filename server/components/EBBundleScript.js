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
    bodyParser = require('body-parser'),
    convict = require('convict'),
    EBApplicationBase = require('../EBApplicationBase'),
    EBClassFactory = require("../../shared/components/EBClassFactory"),
    EBModel = require('../../shared/models/EBModel'),
    EBNeuralTransformer = require("../../shared/components/architecture/EBNeuralTransformer"),
    EBTorchProcess = require('./architecture/EBTorchProcessBase'),
    express = require('express'),
    flattener = require('../middleware/flattener'),
    fs = require('fs'),
    http = require('http'),
    httpStatus = require('http-status-codes'),
    path = require('path'),
    Promise = require('bluebird'),
    ReadWriteLock = require('rwlock');

/**
 * This is the main class for bundled models. Feel free to modify this script as you like,
 * or embed it into a larger NodeJS application.
 */
class EBBundleScript extends EBApplicationBase
{
    /**
     * Constructor for the EBBundleScript object. It will load the model data contained within
     * the given filename.
     *
     * @param {string} [bundleFolder] The folder containing the torch bundle.
     */
    constructor(bundleFolder)
    {
        super();

        if (!bundleFolder)
        {
            bundleFolder = __dirname;
        }

        this.config = convict(this.configuration());

        const filename = path.join(bundleFolder, "model.json");
        const modelFileContents = fs.readFileSync(filename);
        const modelJSON = JSON.parse(modelFileContents);
        const model = new EBModel(modelJSON);
        this.model = model;
        this.bundleFolder = bundleFolder;
        this.lock = new ReadWriteLock();
    }

    /**
     * Exposes configuration values
     *
     * @returns {object} The convict-configuration variables
     */
    configuration()
    {
        return {
            port: {
                doc: "The port to bind.",
                format: "port",
                default: 80,
                env: "PORT",
                arg: 'port'
            }
        };
    }

    /**
     * This function starts the model process. You must do this before processing
     * any data.
     *
     * @returns {Promise} A promise that will resolve when the model process is running.
     */
    startModelProcess()
    {
        const architecture = EBClassFactory.createObject(this.model.architecture);
        const architecturePlugin = this.architectureRegistry.getPluginForArchitecture(architecture);
        this.modelProcess = architecturePlugin.getTorchProcess(architecture, this.bundleFolder);

        return this.modelProcess.generateCode(this.interpretationRegistry, this.neuralNetworkComponentDispatch).then(() =>
        {
            return this.modelProcess.startProcess();
        }).then(() =>
        {
            return this.modelProcess.loadModelFile();
        });
    }

    /**
     * This function runs a bunch of objects through the network.
     *
     * @param {[object]} objects An array of JSON objects to be processed.
     * @return {Promise} A promise that will resolve the output of the neural network for each object.
     */
    processData(objects)
    {
        return Promise.fromCallback((callback) =>
        {
            this.lock.writeLock((release) =>
            {
                const inputTransformer = new EBNeuralTransformer(this.model.architecture.inputSchema);
                const outputTransformer = new EBNeuralTransformer(this.model.architecture.outputSchema);
                const stream = inputTransformer.createTransformationStream(this.interpretationRegistry);

                let transformedObjects = [];

                async.waterfall([
                    // Load the object into the process
                    (next) =>
                    {
                        let processedIndex = 0;
                        stream.on('data', (data) =>
                        {
                            processedIndex += 1;
                            transformedObjects.push(data);
                            if (processedIndex === objects.length)
                            {
                                return next();
                            }
                        });

                        objects.forEach((object, objectIndex) =>
                        {
                            if (objectIndex < (objects.length - 1))
                            {
                                stream.write(object);
                            }
                            else
                            {
                                stream.end(object);
                            }
                        });
                    },
                    // Process the object
                    (next) =>
                    {
                        // Process the provided object
                        const promise = this.modelProcess.processObjects(transformedObjects);
                        promise.then((results) =>
                        {
                            return next(null, results);
                        }, (err) => next(err));
                    },
                    // Convert the outputs
                    (results, next) =>
                    {
                        async.mapSeries(results.objects, (outputObject, next) =>
                        {
                            // TODO: FIX ME
                            const promise = outputTransformer.convertObjectOut(this.interpretationRegistry, outputObject);
                            promise.then((output) =>
                            {
                                return next(null, output);
                            }, (err) => next(err));
                        }, next);
                    }
                ], (err, outputs) =>
                {
                    if (err)
                    {
                        return callback(err);
                    }

                    release();
                    return callback(null, outputs);
                });
            });
        });
    }

    /**
     * This function stops the model process. This can be used for a graceful shutdown.
     *
     * @returns {Promise} A promise that will resolve when the process is killed.
     */
    stopModelProcess()
    {
        return Promise.fromCallback((next) =>
        {
            const promise = this.modelProcess.killProcess();
            promise.then(() =>
            {
                next(null);
            }, (err) => next(err));
        });
    }

    
    /**
     * This function starts an API server containing the instance
     *
     * @returns {Promise} A promise that will resolve when the process is killed.
     */
    startAPIServer()
    {
        const expressApplication = express();

        expressApplication.use((req, res, next) =>
        {
            if (req.headers['content-type'] && !req.headers['content-type'].startsWith('application/json') && !req.headers['content-type'].startsWith('application/offset+octet-stream'))
            {
                res.status(httpStatus.UNSUPPORTED_MEDIA_TYPE);
                res.send("Error: the only supported content type is application/json for API endpoints and application/offset+octet-stream for file uploads");
            }
            else
            {
                return next();
            }
        });

        expressApplication.use(bodyParser.json({
            inflate: true,
            limit: '10mb'
        }));

        expressApplication.use(flattener);

        const processRequest = (data, req, res, next) =>
        {
            this.processData([data]).then((results) =>
            {
                res.type('application/json');
                res.status(httpStatus.OK);
                res.send(results[0]);
            }, (err) => {
                res.type('application/json');
                res.status(httpStatus.BAD_REQUEST);
                res.send(err);
            });
        };

        expressApplication.get('/', (req, res, next) =>
        {
            const data = req.query;
            processRequest(data, req, res, next);
        });

        expressApplication.post('/', (req, res, next) =>
        {
            const data = req.body;
            processRequest(data, req, res, next);
        });

        const server = http.createServer(expressApplication);
        return Promise.fromCallback((done) =>
        {
            server.listen(this.config.get('port'), (err) =>
            {
                return done(err);
            });
        });
    }
}

module.exports = EBBundleScript;
