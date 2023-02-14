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
    EBStdioJSONStreamProcess = require("../../../server/components/EBStdioJSONStreamProcess"),
    EBTorchProcessBase = require("../../../server/components/architecture/EBTorchProcessBase"),
    fs = require('fs'),
    math = require("mathjs"),
    path = require('path'),
    Promise = require('bluebird'),
    temp = require('temp'),
    underscore = require('underscore');

/**
 * This class is used to manage the Torch sub-process for a given architecture
 */
class EBMatchingTorchProcess extends EBTorchProcessBase
{
    /**
     * Creates the process object for the given EBMatchingArchitecture object.
     *
     * @param {EBMatchingArchitecture} architecture The matching architecture object that we are creating the torch process for.
     * @param {EBArchitecturePluginBase} architecturePlugin The plugin for the architecture object
     * @param {string} [scriptFolder] Optional directory where the script files should be written
     */
    constructor(architecture, architecturePlugin, scriptFolder)
    {
        super(architecture, architecturePlugin, scriptFolder);
        
        const self = this;
        self.architecture = architecture;
        self.architecturePlugin = architecturePlugin;

        
        self.processes = [];
        self.allLoadedEntries = [];
        self.testingSet = {};
        self.numProcesses = 1;
    }

    /**
     * This method loads an object into the lua process.
     *
     * @param {string} id The ID of the object to be stored
     * @param {object} input The input data for the object
     * @param {object} output The output data for the object
     * @param {function(err)} callback The callback after the object has been successfully stored
     */
    loadObject(id, input, output)
    {
        const self = this;
        const message = {
            type: "store",
            id: id,
            input: input,
            output: output
        };
        const writeAndWaitPromise = Promise.each(self.processes,(process) =>
        {
            return process.writeAndWaitForMatchingOutput(message, {type: "stored"});
        });
        writeAndWaitPromise.then(() =>
        {
            self.allLoadedEntries.push(id);
        });
        return writeAndWaitPromise;
    }


    /**
     * This method runs a set of objects through the network and returns their processed versions
     *
     * @param {objects} objects The objects that need to be processed
     * @param {function(err, accuracy, output)} callback The callback function which will receive the accuracy of the test, along with the output object
     */
    processObjects(objects)
    {
        const message = {
            type: "evaluate",
            samples: objects,
            ids: objects.map((object, index) => (index + 1).toString())
        };

        return this.processes[0].writeAndWaitForMatchingOutput(message, {type: "evaluationCompleted"});
    }


    /**
     * This method runs a prepared batch through the network
     *
     * @param {string} batchFilename The filename of the batch
     * @param {function(err, accuracy, output)} callback The callback function which will receive the accuracy of the test, along with the output object
     */
    processBatch(batchFilename)
    {
        // Choose a bunch of random samples from the set that we have
        const message = {
            type: "evaluateBatch",
            batchFilename: batchFilename
        };

        // TODO: Make this work with multiple sub-processes!
        return this.processes[0].writeAndWaitForMatchingOutput(message, {type: "evaluationCompleted"}).then((result) =>
        {
            return result;
        });
    }


    /**
     * This method will execute a single training iteration with the given batch.
     *
     * @param {[string]} batchFilename The filename that contains the batch
     * @param {Promise} A Promise that will resolve when batch is complete
     */
    executeTrainingIteration(batchFilename)
    {
        // Choose a bunch of random samples from the set that we have
        const message = {
            type: "iteration",
            batchFilename: batchFilename
        };

        // TODO: Make this work with multiple sub-processes!
        return this.processes[0].writeAndWaitForMatchingOutput(message, {type: "iterationCompleted"});
    }


    /**
     * This method tells the process to create a batch. When training a matching network,
     * we provide the network pairs of objects and tell the network that they are either
     * similar or different.
     *
     * @param {[string]} primaryIds This the ids for each of the primary objects being saved
     * @param {[object]} primaryObjects This contains of primary objects being saved
     * @param {[string]} secondaryIds This the ids for each of the secondary objects being saved
     * @param {[object]} secondaryObjects This contains of secondary objects being saved
     * @param {[number]} valences An array of numbers, either 1 or -1, indicating whether the objects in each of the primary / secondary arrays should be considered similar or different
     * @param {string} fileName The filename to write the result too
     *
     * @return {Promise} A promise that will resolve when the batch has been saved
     */
    prepareBatch(primaryIds, primaryObjects, secondaryIds, secondaryObjects, valences, fileName)
    {
        const self = this;

        const message = {
            type: "prepareBatch",
            primaryIds: primaryIds,
            primarySamples: primaryObjects,
            secondaryIds: secondaryIds,
            secondarySamples: secondaryObjects,
            valences: valences,
            fileName: fileName
        };
        return self.processes[0].writeAndWaitForMatchingOutput(message, {type: "batchPrepared", fileName: fileName});
    }
}

module.exports = EBMatchingTorchProcess;
