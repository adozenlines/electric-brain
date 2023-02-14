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
    EBClassFactory = require("../../shared/components/EBClassFactory"),
    EBModel = require("../../shared/models/EBModel"),
    fs = require('fs'),
    models = require('../../shared/models/models'),
    mongodb = require('mongodb'),
    path = require('path'),
    Promise = require('bluebird'),
    temp = require('temp'),
    underscore = require('underscore');

/**
 *  This task samples a data source and determines what the schema is, along with associated metadata.
 */
class EBAssembleNodeBundleTask
{
    /**
     * The constructor for the task object.
     *
     * @param {EBApplicationBase} application This should be a reference to the root EBApplication object.
     */
    constructor(application)
    {
        this.application = application;
        this.socketio = application.socketio;
        this.models = application.db.collection("EBModel");
        this.lastUpdateTime = null;
        this.frontendUpdateTime = 5000;
    }

    /**
     *  This is the entry point for the node bundling task
     *
     *  @param {beaver.Task} task The Beaver task object
     *  @param {object} args The arguments for this task. It should only contain a single argument,
     *                       the MongoID of the EBModel object that needs to be bundled.
     *  @return {Promise} A promise that will resolve when the bundle is finished.
     */
    run(task, args)
    {
        this.task = task;

        const torchGridFS = new mongodb.GridFSBucket(this.application.db, {
            chunkSizeBytes: 1024,
            bucketName: 'EBModel.torch'
        });

        const bundleGridFS = new mongodb.GridFSBucket(this.application.db, {
            chunkSizeBytes: 1024,
            bucketName: 'EBModel.bundle'
        });

        const zipFile = temp.path({suffix: '.zip'});

        return Promise.fromCallback((next) =>
        {
            // First log the start
            this.task.log(this.task, `Starting the task to assemble the bundle for model with _id: ${args._id}`, next);
        }).then(() =>
        {
            // Retrieve the model object that this task refers to
            return this.models.find({_id: args._id}).toArray();
        }).then((objects) =>
        {
            if (objects.length === 0)
            {
                return Promise.rejected(new Error("EBModel not found!"));
            }
            else
            {
                this.model = new EBModel(objects[0]);

                const architecture = EBClassFactory.createObject(this.model.architecture);
                const architecturePlugin = this.application.architectureRegistry.getPluginForArchitecture(architecture);

                return Promise.fromCallback((next) =>
                {
                    // First, create a temporary folder to put all of the model files in
                    temp.mkdir('electric-brain-bundle', (err, temporaryFolder) => {
                        if (err)
                        {
                            return next(err);
                        }

                        this.trainingProcess = architecturePlugin.getTorchProcess(architecture, temporaryFolder);
                        return next(null, temporaryFolder);
                    });
                });
            }
        }).then(() =>
        {
            return Promise.fromCallback((next) =>
            {
                const jsonData = JSON.stringify(this.model, null, 4);
                fs.writeFile(path.join(this.trainingProcess.scriptFolder, 'model.json'), jsonData, next);
            });
        }).then(() =>
        {
            return this.updateModel({
                status: 'in_progress',
                percentageComplete: 5,
                step: "downloading_model_parameters"
            });
        }).then(() =>
        {
            return Promise.fromCallback((next) =>
            {
                torchGridFS.openDownloadStreamByName(`model-${this.model._id}.t7`).pipe(fs.createWriteStream(path.join(this.trainingProcess.scriptFolder, 'model.t7'))).on('error', (error) =>
                {
                    return next(error);
                }).on('finish', () =>
                {
                    return next();
                });
            });
        }).then(() =>
        {
            return this.updateModel({
                status: 'in_progress',
                percentageComplete: 10,
                step: "copying_eb_files"
            });
        }).then(() =>
        {
            return Promise.fromCallback((next) =>
            {
                // List all the folders to copy
                const folders = [
                    path.join(__dirname, '..', '..', 'build'),
                    path.join(__dirname, '..', '..', 'data'),
                    path.join(__dirname, '..', '..', 'extraplugins'),
                    path.join(__dirname, '..', '..', 'lib'),
                    path.join(__dirname, '..', '..', 'LICENSE'),
                    path.join(__dirname, '..', '..', 'licenses'),
                    path.join(__dirname, '..', '..', 'node_modules'),
                    path.join(__dirname, '..', '..', 'package.json'),
                    path.join(__dirname, '..', '..', 'plugins'),
                    path.join(__dirname, '..', '..', 'server'),
                    path.join(__dirname, '..', '..', 'server', 'api_server.js'),
                    path.join(__dirname, '..', '..', 'shared')
                ];
    
                async.eachSeries(folders, (folder, next) =>
                {
                    childProcess.exec(`cp -R ${folder} ${this.trainingProcess.scriptFolder}`, next);
                }, next);
            });
        }).then(() =>
        {
            return this.updateModel({
                status: 'in_progress',
                percentageComplete: 40,
                step: "zipping"
            });
        }).then(() =>
        {
            return Promise.fromCallback((next) =>
            {
                childProcess.exec(`zip -rq ${zipFile} *`, {cwd: this.trainingProcess.scriptFolder}, next);
            });
        }).then(() =>
        {
            return this.updateModel({
                status: 'in_progress',
                percentageComplete: 80,
                step: "uploading"
            });
        }).then(() =>
        {
            return Promise.fromCallback((callback) =>
            {
                const stream = fs.createReadStream(zipFile);
                const fileName = `model-${this.model._id}.zip`;
                stream.pipe(bundleGridFS.openUploadStream(fileName)).on('error', (error) =>
                {
                    return callback(error);
                }).on('finish', () =>
                {
                    // Delete the older model bundles, if there are any
                    bundleGridFS.find({filename: fileName}, {
                        sort: {uploadDate: -1}
                    }).toArray().then((files) =>
                    {
                        const filesToDelete = files.splice(1, files.length - 1);
                        async.eachSeries(filesToDelete, (file, next) => bundleGridFS.delete(file._id, next), callback);
                    }, (err) => callback(err));
                });
            }).then(() =>
            {
                return this.updateModel({
                    status: 'in_progress',
                    percentageComplete: 99,
                    step: "cleaning"
                });
            }).then(() =>
            {
                return Promise.fromCallback((next) =>
                {
                    fs.unlink(zipFile, (err) =>
                    {
                        if (err)
                        {
                            return next(err);
                        }


                        childProcess.exec(`rm -rf ${this.trainingProcess.scriptFolder}`, next);
                    });
                });
            }).then(() =>
            {
                return this.updateModel({
                    status: 'complete',
                    percentageComplete: 100,
                    step: null
                });
            });
        });
    }


    /**
     * This method is used to update progress on the bundling
     *
     * @param {object} bundlingStatus
     *
     * @returns {Promise}
     */
    updateModel(bundlingStatus)
    {
        return Promise.fromCallback((next) =>
        {
            this.model.bundle = bundlingStatus;
            this.models.updateOne({_id: this.model._id}, this.model, (err) =>
            {
                if (err)
                {
                    return next(err);
                }

                // Trigger the frontend to be updated.
                this.socketio.to('general').emit(`model-${this.model._id.toString()}`, {event: 'update', model: this.model});
                return next();
            });
        });
    }
}

module.exports = EBAssembleNodeBundleTask;
