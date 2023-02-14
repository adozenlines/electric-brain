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
    beaver = require('beaver'),
    bodyParser = require('body-parser'),
    convict = require("convict"),
    express = require("express"),
    EBApplicationBase = require('./EBApplicationBase'),
    EBDataSourcePluginDispatch = require("./components/datasource/EBDataSourcePluginDispatch"),
    EBNeuralNetworkComponentDispatch = require("../shared/components/architecture/EBNeuralNetworkComponentDispatch"),
    EBInterpretationRegistry = require("./components/datasource/EBInterpretationRegistry"),
    EBArchitecturePluginRegistry = require("./components/architecture/EBArchitecturePluginRegistry"),
    flattener = require('./middleware/flattener'),
    fs = require("fs"),
    http = require('http'),
    httpStatus = require('http-status-codes'),
    mongodb = require('mongodb'),
    path = require('path'),
    socketio = require('socket.io'),
    socketioAMQP = require("socket.io-amqp"),
    tasks = require("./tasks/tasks");

/**
 *  This class is the root application object, which represents the EB API server as a whole
 */
class EBApplication extends EBApplicationBase
{
    /**
     * Constructor for the application
     */
    constructor()
    {
        super();
        
        this.config = convict(this.configuration());
        
        // Create our task registry. All taskRegistry should have explicit timeouts set.
        this.taskRegistry = new beaver.Registry({});

        this.taskRegistry.registerHook("stderr", function(message, callback)
        {
            console.log("task-stderr: ", message);
            return callback();
        });

        this.taskRegistry.registerHook("log", function(task, level, message, callback)
        {
            console.log("task-log: ", message);
            return callback();
        });

        this.taskRegistry.registerHook("percentageComplete", function(task, percent, callback)
        {
            console.log("task-percentageComplete: ", percent);
            return callback();
        });

        this.taskRegistry.registerHook("result", function(task, result, callback)
        {
            console.log("task-result: ", result);
            return callback();
        });

        this.taskRegistry.registerHook("start", function(task, callback)
        {
            console.log("task-start: ");
            return callback();
        });

        this.taskRegistry.registerHook("finish", function(task, callback)
        {
            console.log("task-finish: ");
            return callback();
        });

        this.taskRegistry.registerHook("error", function(task, error, callback)
        {
            console.log("task-error: ");
            return callback();
        });

        this.taskQueue = new beaver.AMQPQueue(this.taskRegistry, {
            url: this.config.get('amqp'),
            prefix: "electricbrain"
        });


        // Setup the global tasks with a reference to this application object
        tasks.setupTasks(this);
    }

    /**
     * Exposes configuration values
     *
     * @returns {object} The convict-configuration variables
     */
    configuration()
    {
        return {
            env: {
                doc: "The application environment.",
                format: ["production", "development", "test"],
                default: "development",
                env: "NODE_ENV"
            },
            prefix: {
                doc: "The API prefix",
                format: String,
                default: "app",
                env: "API_PREFIX"
            },
            port: {
                doc: "The port to bind.",
                format: "port",
                default: 3891,
                env: "PORT"
            },
            amqp: {
                doc: "The RabbitMQ address to connect to.",
                format: "url",
                default: 'amqp://localhost',
                env: "AMQP"
            },
            mongo: {
                doc: "The Mongo database URL to connect to",
                format: "url",
                default: 'mongodb://localhost/electric_brain',
                env: "Mongo"
            },
            overrideModelFolder: {
                doc: "This config overrides the default temporary folder where model code is stored.",
                format: String,
                default: '',
                env: "MODEL_FOLDER"
            },
            companyName: {
                doc: "This config is used to specify what the company name is on the frontend. Used for white-labelling",
                format: String,
                default: 'Electric Brain Software Corporation',
                env: "COMPANY_NAME"
            },
            softwareName: {
                doc: "This config is used to specify what the software name is on the frontend. Used for white-labelling",
                format: String,
                default: 'Electric Brain',
                env: "SOFTWARE_NAME"
            },
            licenseFile: {
                doc: "This config is used to set the license file that will be displayed on the frontend",
                format: String,
                default: path.join(__dirname, '..', 'LICENSE'),
                env: "LICENSE_FILE"
            },
            logoFile: {
                doc: "This config is used to set the logo that will be used on the frontend. Used for white-labelling.",
                format: String,
                default: "img/logo/logo_menu.svg",
                env: "LOGO_FILE"
            }
        };
    }

    /**
     * Initializes the connection with the database
     *
     * @param {function(err)} done Callback after the database connection is ready
     */
    initializeDatabase(done)
    {
        const self = this;
        mongodb.MongoClient.connect(self.config.get('mongo'), (err, db) =>
        {
            if (err)
            {
                return done(err);
            }
            else
            {
                self.db = db;

                this.plugins.forEach((plugin) =>
                {
                    const dataSourceNames = Object.keys(plugin.dataSources || {});
                    dataSourceNames.forEach((name) =>
                    {
                        self.dataSourcePluginDispatch.registerPlugin(name, new plugin.dataSources[name](self));
                    })
                });

                return done();
            }
        });
    }

    /**
     * Initializes background task processing using beaver
     *
     * @param {function(err)} done Callback after the database connection is ready
     */
    initializeBackgroundTask(done)
    {
        this.taskQueue.initialize(function(err)
        {
            if (err)
            {
                return done(err);
            }
            else
            {
                return done();
            }
        });
    }

    /**
     * This method sets up socket.io
     *
     * @param {object} [server] Optional http server to attach the socket.io instance to
     * @param {function(err)} [server] Optional http server to attach the socket.io instance to
     */
    initializeSocketIO(server, callback)
    {
        const self = this;
        try
        {
            if (!server)
            {
                server = http.Server();
            }

            self.socketio = socketio(server);
            self.socketio.on('connection', function(socket)
            {
                socket.join('general');
                socket.on('command-model', function(data)
                {
                    self.socketio.to('general').emit(`command-model-${data.id}`, data);
                });
            });


            // Set up realtime to using RabbitMQ for publish-subscribe
            self.socketio.adapter(socketioAMQP(self.config.get('amqp'), {prefix: 'electricbrain-'}));

            return callback();
        }
        catch (err)
        {
            return callback(err);
        }
    }

    /**
     * Starts the electric-brain http server for the API and frontend.
     *
     * @param {function(err)} done A function to be called once the server is ready and listening for http connections
     */
    runWebServer(done)
    {
        const self = this;
        const expressApplication = express();

        expressApplication.use(function(req, res, next)
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

        // Initialize each of the modules that we find in pages
        const apis = fs.readdirSync(path.join(__dirname, "apis"));
        apis.forEach(function(apiFilename)
        {
            const APIClass = require(`./apis/${apiFilename}`);
            const api = new APIClass(self);
            api.setupEndpoints(expressApplication);
        });

        const server = http.createServer(expressApplication);
        self.initializeSocketIO(server, function(err)
        {
            if (err)
            {
                return done(err);
            }

            server.listen(self.config.get('port'), function(err)
            {
                return done(err);
            });
        });
    }


    /**
     * This is the main entry point for workers
     *
     * @param {function} callback The exit callback after the worker has started
     */
    runWorker(callback)
    {
        const self = this;

        self.initializeSocketIO(null, function(err)
        {
            if (err)
            {
                return callback(err);
            }

            const worker = new beaver.Worker(self.taskQueue, {});
            self.taskQueue.registerWorker(worker, function(err)
            {
                if (err)
                {
                    return callback(err);
                }

                return callback();
            });
        });
    }


    /**
     * This runs the scheduler - which handles periodic, scheduled tasks
     *
     * @param {function} callback A callback after the scheduler has started
     * @returns {*} nothing
     */
    runScheduler(callback)
    {
        // Create the scheduler and start it
        const scheduler = new beaver.Scheduler(this.taskQueue, {});
        scheduler.start();

        return callback();
    }
}


module.exports = EBApplication;
