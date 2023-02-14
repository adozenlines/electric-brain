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

/**
 * This script file is meant to be used as an micro-server by exported neural network bundles
 */

module.exports = exports = {
    EBBundleScript: require("./server/components/EBBundleScript")
};


if (require.main === module)
{
    console.log(`Initializing the Electric Brain Bundled Model`);
    console.log(`Use --port to change the port number of this API server`);
    const bundleScript = new module.exports.EBBundleScript(".");
    bundleScript.startModelProcess().then(() =>
    {
        return bundleScript.startAPIServer();
    }).then(() =>
    {
        // The server is running!
        console.log(`Electric Brain Model API started on port ${bundleScript.config.get('port')}`);
        console.log(`To process data with the model, make a GET or POST request to: http://localhost:${bundleScript.config.get('port')}/`);
    }, (err) =>
    {
        console.error("Electric Brain Model Bundle server failed to start!");
        console.error(err);
        process.exit(1);
    });
}
