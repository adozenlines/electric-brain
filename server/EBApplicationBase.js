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
    EBArchitecturePluginRegistry = require("./components/architecture/EBArchitecturePluginRegistry"),
    EBDataSourcePluginDispatch = require("./components/datasource/EBDataSourcePluginDispatch"),
    EBInterpretationRegistry = require("./components/datasource/EBInterpretationRegistry"),
    EBNeuralNetworkComponentDispatch = require("../shared/components/architecture/EBNeuralNetworkComponentDispatch"),
    fs = require("fs"),
    path = require('path');


/**
 *  This is a base class for various types of EBApplicationBase
 */
class EBApplicationBase
{
    /**
     * Constructor for the application
     */
    constructor()
    {
        // Initialize each of the modules that we find in pages
        const polyfills = fs.readdirSync(`${__dirname}/../shared/polyfill`);
        polyfills.forEach((polyfillFilename) =>
        {
            require(`../shared/polyfill/${polyfillFilename}`);
        });

        // Initialize any mods
        const mods = fs.readdirSync(`${__dirname}/mods`);
        mods.forEach((modFilename) =>
        {
            require(`./mods/${modFilename}`).apply();
        });

        // Load any plugins that are found in the various plugin directories
        const pluginDirectories = [
            path.join(__dirname, '..', 'plugins'),
            path.join(__dirname, '..', 'extraplugins')
        ];

        this.plugins = [];
        pluginDirectories.forEach((directory) =>
        {
            const pluginNames = fs.readdirSync(directory);
            pluginNames.forEach((pluginFilename) =>
            {
                if (fs.statSync(path.join(directory, pluginFilename)).isDirectory())
                {
                    this.plugins.push(require(path.join(directory, pluginFilename)));
                }
            });
        });

        // Set up the main data source plugin
        this.dataSourcePluginDispatch = new EBDataSourcePluginDispatch();
        this.neuralNetworkComponentDispatch = new EBNeuralNetworkComponentDispatch();
        this.interpretationRegistry = new EBInterpretationRegistry();
        this.architectureRegistry = new EBArchitecturePluginRegistry();

        this.plugins.forEach((plugin) =>
        {
            const interpretationNames = Object.keys(plugin.interpretations || {});
            interpretationNames.forEach((name) =>
            {
                this.interpretationRegistry.addInterpretation(new plugin.interpretations[name](this.interpretationRegistry));
            });

            const neuralNetworkComponentNames = Object.keys(plugin.neuralNetworkComponents || {});
            neuralNetworkComponentNames.forEach((name) =>
            {
                this.neuralNetworkComponentDispatch.registerPlugin(name, new plugin.neuralNetworkComponents[name](this.neuralNetworkComponentDispatch))
            });

            const architecturePluginNames = Object.keys(plugin.architecturePlugins || {});
            architecturePluginNames.forEach((name) =>
            {
                this.architectureRegistry.registerPlugin(name, new plugin.architecturePlugins[name](this.interpretationRegistry, this.neuralNetworkComponentDispatch));
            });
        });
    }

}


module.exports = EBApplicationBase;
