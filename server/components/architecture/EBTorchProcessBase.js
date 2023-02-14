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
    childProcess = require('child_process'),
    EBStdioJSONStreamProcess = require("../EBStdioJSONStreamProcess"),
    fs = require('fs'),
    math = require("mathjs"),
    path = require('path'),
    Promise = require('bluebird'),
    temp = require('temp'),
    underscore = require('underscore');

/**
 * This is a base class for various architecture-specific torch process classes.
 */
class EBTorchProcessBase
{
    /**
     * Creates the process object for the given EBArchitecture object.
     *
     * @param {EBArchitecture} architecture The architecture object that we are creating the torch process for
     * @param {EBArchitecturePluginBase} architecturePlugin The plugin for the architecture object
     * @param {string} [scriptFolder] Optional directory where the script files should be written
     */
    constructor(architecture, architecturePlugin, scriptFolder)
    {
        const self = this;
        self.architecture = architecture;
        self.architecturePlugin = architecturePlugin;
        self.scriptFolder = scriptFolder || null;
        self.scriptFile = null;
        self.processes = [];
        self.allLoadedEntries = [];
        self.testingSet = {};
        self.numProcesses = 1;
        self.running = false;
    }
    
    /**
     * This function will generate the code and write the code to disk.
     *
     * @param {function(err, totalFiles)} callback Callback after the code has been written to disk, ready for the process to start
     */
    generateCode(registry, neuralNetworkComponentDispatch)
    {
        const self = this;
        return Promise.fromCallback((callback) =>
        {
            let totalFiles = 0;

            async.series([
                function writeGeneratedFiles(next)
                {
                    async.waterfall([
                        function(next)
                        {
                            if (!self.scriptFolder)
                            {
                                // First, create a temporary folder to put all of the model files in
                                temp.mkdir('electric-brain-model', (err, temporaryFolder) => {
                                    if (err)
                                    {
                                        return next(err);
                                    }

                                    return next(null, temporaryFolder);
                                });
                            }
                            else
                            {
                                // if (fs.existsSync(self.scriptFolder))
                                // {
                                //     childProcess.execSync(`rm -rf ${path.join(self.scriptFolder, "*")}`)
                                // }

                                return next(null, self.scriptFolder);
                            }
                        },
                        function(temporaryFolder, next)
                        {
                            self.scriptFolder = temporaryFolder;
                            try
                            {
                                // Create a list of files that need to be written
                                if (!self.architecturePlugin.generateFiles)
                                {
                                    console.error(self.architecturePlugin);
                                }
                                const files = self.architecturePlugin.generateFiles(self.architecture);

                                // Write out each of the files
                                const writeFilePromise = Promise.each(files,(file) =>
                                {
                                    totalFiles += 1;
                                    return Promise.fromCallback((next) => fs.writeFile(path.join(self.scriptFolder, file.path), file.data, next));
                                });
                                writeFilePromise.then(() => next());
                            }
                            catch (err)
                            {
                                return next(err);
                            }
                        }
                    ], next);
                },
                function writeLibraryFiles(next)
                {
                    // Write any libraries
                    const libraryFiles = fs.readdirSync(path.join(__dirname, '..', '..', '..', 'lib', 'lua'));
                    async.eachSeries(libraryFiles, function(filename, next)
                    {
                        fs.readFile(path.join(__dirname, '..', '..', '..', 'lib', 'lua', filename), function(err, buffer)
                        {
                            if (err)
                            {
                                return next(err);
                            }

                            totalFiles += 1;
                            fs.writeFile(path.join(self.scriptFolder, filename), buffer, next);
                        });
                    }, next);
                },
                function writeElectricBrainLibrary(next)
                {
                    // Write any libraries
                    const libraryFiles = fs.readdirSync(path.join(__dirname, '..', '..', '..', 'lib', 'lua'));
                    async.eachSeries(libraryFiles, function(filename, next)
                    {
                        fs.readFile(path.join(__dirname, '..', '..', '..', 'lib', 'lua', filename), function(err, buffer)
                        {
                            if (err)
                            {
                                return next(err);
                            }

                            totalFiles += 1;
                            fs.writeFile(path.join(self.scriptFolder, filename), buffer, next);
                        });
                    }, next);
                }
            ], function(err)
            {
                if (err)
                {
                    return callback(err);
                }

                return callback(null, totalFiles);
            });
        });
    }

    /**
     * Starts up the sub process
     *
     * @param {function(err)} callback Callback to be called after the sub-process is started
     */
    startProcess()
    {
        const self = this;
        self.running = true;
        return Promise.fromCallback((callback) =>
        {
            async.series([
                function startProcess(next)
                {
                    async.times(self.numProcesses, function(n, next)
                    {
                        const promise = EBStdioJSONStreamProcess.spawn('luajit', ['TrainingScript.lua', n + 1, self.numProcesses], {
                            cwd: self.scriptFolder,
                            env: underscore.extend({TERM: "xterm"}, process.env)
                        });
                        promise.then((process) =>
                        {
                            self.processes.push(process);

                            // Set up a handler for log messages coming from the lua process
                            process.outputStream.on('data', (data) =>
                            {
                                if (data.type === 'log')
                                {
                                    self.logError(`${data.message}`);
                                }
                            });

                            process.on('close', (exitCode) =>
                            {
                                self.logError(`luajit closed: ${exitCode}`);
                                self.running = false;
                            });

                            process.on('disconnect', () =>
                            {
                                self.logError(`luajit disconnected`);
                            });

                            process.on('error', (error) =>
                            {
                                self.logError(`luajit error: ${error}`);
                            });

                            process.on('exit', () =>
                            {
                                self.logError(`luajit exited`);
                                self.running = false;
                            });

                            return next();
                        }, (err) => next(err));
                    }, next);
                },
                function handshake(next)
                {
                    const writeAndWaitPromise = Promise.each(self.processes, (process) =>
                    {
                        // Now we handshake with the process and get version / name information
                        return process.writeAndWaitForMatchingOutput({type: "handshake"}, {"type": "handshake"});
                    });
                    writeAndWaitPromise.then(() => next(), (err) => next(err));
                }
            ], callback);
        });
    }

    /**
     * Kills the sub processes
     *
     * @param {function(err)} callback Callback to be called after the sub-processes are all killed
     */
    killProcess()
    {
        const self = this;
        const writeAndWaitPromise = Promise.each(self.processes,(process) =>
        {
            return process.process.kill();
        });
        return writeAndWaitPromise;
    }


    /**
     * This method resets the parameters of the neural network model and the training process in general
     *
     * @param {Number} initializationRangeBottom The lower bound of random values the network is initialized with
     * @param {Number} initializationRangeTop The upper bound of random values the network is initialized with
     * @param {string} optimizationAlgorithm The optimization algorithm that should be used
     * @param {object} optimizationParameters The parameters for the optimization algorithm
     * 
     * @param {function(err)} callback The callback after the process has been reset
     */
    reset(initializationRangeBottom, initializationRangeTop, optimizationAlgorithm, optimizationParameters)
    {
        const self = this;

        const writeAndWaitPromise = Promise.each(self.processes, (process) =>
            {
                return process.writeAndWaitForMatchingOutput({
                    type: "reset",
                    initializationRangeBottom: initializationRangeBottom,
                    initializationRangeTop: initializationRangeTop,
                    optimizationAlgorithm: optimizationAlgorithm,
                    optimizationParameters: optimizationParameters
                }, {type: "resetCompleted"});
            });
        return writeAndWaitPromise;
    }

    /**
     * A convenience method to log an error the the task log.
     *
     * @param {string} message The message to be logged. Should be a string.
     */
    logError(message)
    {
        console.error(message);
    }


    /**
     * This gets internal stats out of the Luajit process
     *
     * @param {function(err, statistics)} callback The callback with the statistics object
     */
    getInternalStatistics()
    {
        const self = this;
        return Promise.fromCallback((callback) =>
        {
            const message = {type: "stats"};
            const promise = self.processes[0].writeAndWaitForMatchingOutput(message, {type: "stats"});
            promise.then( (response) =>
            {
                return callback(null, response.stats);
            }, (err) => callback (err));
        });
    }
    
    /**
     * This function retrieves the diagrams that are generated by torch.
     *
     *  @return {Promise} A promise that will resolve with a list of objects, each with two fields, the filename and the data
     */
    extractNetworkDiagrams()
    {
        const self = this;

        return Promise.fromCallback((callback) =>
        {
            let foundFiles = false;
            const retryAttempts = 100;
            const timeoutBetweenRetries = 150;
            const maxBufferSize = 10 * 1024 * 1024;
            async.retry(retryAttempts, function (callback)
            {
                fs.readdir(self.scriptFolder, function (err, files)
                {
                    if (err)
                    {
                        return callback(err);
                    }

                    // Go through the list of files for the dot files
                    const dotFiles = underscore.filter(files, (file) => (/^.*\.dot$/g).test(file));

                    if (dotFiles.length === 0)
                    {
                        setTimeout(function ()
                        {
                            return callback(new Error("Could not find any architectural diagrams"));
                        }, timeoutBetweenRetries);
                    }
                    else
                    {
                        // Retrieve each image
                        async.map(dotFiles, function (file, next)
                        {
                            childProcess.exec(`dot -Grankdir=LR ${path.join(self.scriptFolder, file)} -Tsvg`, {maxBuffer: maxBufferSize}, function (err, result)
                            {
                                if (err)
                                {
                                    return next(err);
                                }

                                return next(null, {
                                    file: file,
                                    data: new Buffer(result).toString('base64')
                                });
                            });
                        }, callback);
                    }
                });
            }, callback);

        });
    }


    /**
     * This causes the torch process to save the torch model, and then returns a stream to that model file
     *
     * @return {promise} A promise that will resolve when the model file returns a stream
     */
    getTorchModelFileStream()
    {
        const self = this;

        return Promise.fromCallback((callback) =>
        {
            const message = {type: "save"};
            const promise = self.processes[0].writeAndWaitForMatchingOutput(message, {type: "saved"});
            promise.then((response) =>
            {
                const stream = fs.createReadStream(path.join(self.scriptFolder, 'model.t7'));

                return callback(null, stream);
            }, (err) => callback(err));
        });
    }


    /**
     * This method tells the process to load its model data from torch model file
     *
     * @return {Promise} A promise that will resolve when the model file has been loaded
     */
    loadModelFile()
    {
        const self = this;
        const message = {
            type: "load"
        };
        const writeAndWaitPromise = Promise.each(self.processes, (process) =>
        {
            return process.writeAndWaitForMatchingOutput(message, {type: "loaded"});
        });
        return writeAndWaitPromise;
    }
}

module.exports = EBTorchProcessBase;
