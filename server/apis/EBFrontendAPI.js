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
    indexPageTemplate = require("../../build/frontend/index"),
    EBAPIRoot = require('./EBAPIRoot'),
    express = require("express"),
    fs = require('fs'),
    httpStatus = require('http-status-codes'),
    path = require('path'),
    Promise = require('bluebird'),
    recursiveReaddir = require('recursive-readdir'),
    underscore = require('underscore');


class EBFrontendAPI extends EBAPIRoot
{
    /**
     * Creates a new EBFrontendAPI
     *
     * @param {object} application The top level EBApplication object
     */
    constructor(application)
    {
        super(application);
        this.application = application;
        
        // The complete of css files to include into the frontend
        this.cssDependencies = [
            "bower_components/font-awesome/css/font-awesome.min.css",
            "bower_components/bootstrap/dist/css/bootstrap.min.css",
            "bower_components/angular-bootstrap/ui-bootstrap-csp.css",
            "lib/animate/animate.css",
            "bower_components/angular-ui-tree/dist/angular-ui-tree.css",
            "bower_components/angular-ui-select/dist/select.min.css",
            "bower_components/ng-table/dist/ng-table.min.css",
            "bower_components/SpinKit/css/spinkit.css",
            "bower_components/angular-swagger-ui/dist/css/swagger-ui.min.css"
        ];

        // The complete of javascript files to include as dependencies.
        this.jsDependencies = [
            "build/shared.min.js",
            "/socket.io/socket.io.js",
            "bower_components/jquery/dist/jquery.min.js",
            "bower_components/jquery-ui/jquery-ui.min.js",
            "bower_components/bootstrap/dist/js/bootstrap.min.js",
            "bower_components/underscore/underscore.js",
            "bower_components/bluebird/js/browser/bluebird.min.js",
            "bower_components/moment/moment.js",
            "bower_components/highcharts/highcharts.js",
            "bower_components/highcharts/modules/heatmap.js",
            "bower_components/spin.js/spin.js",
            "bower_components/ez-plus/src/jquery.ez-plus.js",
            "lib/flat/flat.js",
            "bower_components/colorjs/color.js",
            "lib/tus/tus.min.js",
            "bower_components/Flot/jquery.flot.js",
            "bower_components/angular/angular.js",
            "bower_components/angular-animate/angular-animate.js",
            "bower_components/oclazyload/dist/ocLazyLoad.min.js",
            "bower_components/angular-ui-router/release/angular-ui-router.min.js",
            "bower_components/angular-bootstrap/ui-bootstrap-tpls.min.js",
            "bower_components/angular-ui-tree/dist/angular-ui-tree.js",
            "bower_components/angular-spinner/angular-spinner.js",
            "bower_components/ace-builds/src-min-noconflict/ace.js",
            "bower_components/angular-ui-ace/ui-ace.js",
            "bower_components/angular-ui-select/dist/select.min.js",
            "bower_components/ng-table/dist/ng-table.min.js",
            "bower_components/highcharts-ng/dist/highcharts-ng.min.js",
            "bower_components/angular-ez-plus/js/angular-ezplus.js",
            "bower_components/angular-swagger-ui/dist/scripts/swagger-ui.min.js",
            "bower_components/angular-flot/angular-flot.js",
            "bower_components/flot-axislabels/jquery.flot.axislabels.js"
        ];
    }

    /**
     * This method finds all JS files that need to be loaded by the frontend.
     *
     * @return {Promise} A promise that resolves to an array containing all the the urls for files
     *                   to be loaded from the frontend
     */
    findFrontendJavascriptFiles()
    {
        const foldersToSearch = [];

        // Start with the main javascript client folder
        foldersToSearch.push({
            folder: path.join(__dirname, '..', '..', 'client', 'js'),
            root: "js"
        });

        // Now search each plugins client directory,
        this.application.plugins.forEach((plugin) =>
        {
            if (fs.existsSync(path.join(plugin.folder, 'client', 'js')))
            {
                foldersToSearch.push({
                    folder: path.join(plugin.folder, 'client', 'js'),
                    root: `/plugins/${plugin.name}/js`
                });
            }
        });

        // For each folder, recursively find all files.
        return Promise.map(foldersToSearch, (searchFolder) =>
        {
            return Promise.fromCallback((next) =>
            {
                recursiveReaddir(searchFolder.folder, [], function(err, files)
                {
                    if (err)
                    {
                        return next(err);
                    }

                    return next(null, files.map((filePath) =>
                    {
                        return filePath.replace(searchFolder.folder, searchFolder.root);
                    }));
                });
            });
        }).then((files) =>
        {
            return underscore.flatten(files);
        })
    }


    /**
     * This method finds all CSS files that need to be loaded by the frontend
     *
     * @return {Promise} A promise that resolves to an array containing all the urls for css files
     *                   to be loaded on the frontend.
     */
    findFrontendCSSFiles()
    {
        const foldersToSearch = [];

        // Start with the main client folder
        foldersToSearch.push({
            folder: path.join(__dirname, '..', '..', 'client', 'css'),
            root: "css"
        });

        // Now search each plugins client directory,
        this.application.plugins.forEach((plugin) =>
        {
            if (fs.existsSync(path.join(plugin.folder, 'client', 'css')))
            {
                foldersToSearch.push({
                    folder: path.join(plugin.folder, 'client', 'css'),
                    root: `/plugins/${plugin.name}/css`
                });
            }
        });

        // For each folder, recursively find all files.
        return Promise.map(foldersToSearch, (searchFolder) =>
        {
            return Promise.fromCallback((next) =>
            {
                recursiveReaddir(searchFolder.folder, ['*.less', '*.png'], function(err, files)
                {
                    if (err)
                    {
                        return next(err);
                    }

                    return next(null, files.map((filePath) =>
                    {
                        return filePath.replace(searchFolder.folder, searchFolder.root);
                    }));
                });
            });
        }).then((files) =>
        {
            return underscore.flatten(files);
        })
    }

    /**
     * This function will render the index.html page
     */
    renderIndex(req, res)
    {
        if (!this.indexPageCode)
        {
            this.indexPageCode = this.findFrontendJavascriptFiles().then((jsFiles) =>
            {
                return this.findFrontendCSSFiles().then((cssFiles) =>
                {
                    return indexPageTemplate({
                        cssDependencies: this.cssDependencies.concat(cssFiles),
                        jsDependencies: this.jsDependencies.concat(jsFiles)
                    })
                });
            })
        }

        this.indexPageCode.then((indexPage) =>
        {
            res.type('text/html');
            res.status(httpStatus.OK);
            res.send(indexPage);
        }, (err) =>
        {
            console.error(err);
            res.type('text/html');
            res.status(httpStatus.INTERNAL_SERVER_ERROR);
            res.send("INTERNAL SERVER ERROR. COULD NOT RENDER INDEX PAGE.");
        });
    }




    /**
     * Registers all of the endpoints with the express application
     *
     * @param {object} expressApplication This is an express application object.
     */
    setupEndpoints(expressApplication)
    {
        // Individually serve each of the folders under client
        const folders = ["client"];
        folders.forEach((folder) =>
        {
            const frontendFolders = fs.readdirSync(path.join(__dirname, '..', '..', folder));
            frontendFolders.forEach((frontendFolderName) =>
            {
                const pathString = `/app/${frontendFolderName}`;
                if(pathString !== "index.html")
                {
                    expressApplication.use(pathString, express.static(path.join(__dirname, '..', '..', folder, frontendFolderName)));
                    expressApplication.use(`/app/${frontendFolderName}/*`, (req, res) =>
                    {
                        res.status(httpStatus.NOT_FOUND);
                        res.send({});
                    });
                }
            });
        });
        
        this.application.plugins.forEach((plugin) =>
        {
            if (fs.existsSync(path.join(plugin.folder, 'client')))
            {
                const frontendFolders = fs.readdirSync(path.join(plugin.folder, 'client'));
                frontendFolders.forEach((frontendFolderName) =>
                {
                    const pathString = `/plugins/${plugin.name}/${frontendFolderName}`;
                    if (pathString !== "index.html")
                    {
                        expressApplication.use(pathString, express.static(path.join(plugin.folder, 'client', frontendFolderName)));
                        expressApplication.use(`/plugins/${plugin.name}/${frontendFolderName}/*`, (req, res) =>
                        {
                            res.status(httpStatus.NOT_FOUND);
                            res.send({});
                        });
                    }
                });
            }
        });

        // Every other path is considered to be the index page of the frontend
        expressApplication.use("/app/*", (req, res) =>
        {
            this.renderIndex(req, res);
        });
        expressApplication.use("/app", (req, res) =>
        {
            this.renderIndex(req, res);
        });
    }
}


module.exports = EBFrontendAPI;

