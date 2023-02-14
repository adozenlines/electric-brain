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

const Promise = require('bluebird');

/**
 * This class can be used as a base class for all electric brain scripts which receive commands via the standard console in
 * a JSON line-by-line format
 */
class EBStdioScript
{
    /**
     * Constructor for the EBStdioScript
     */
    constructor()
    {
        
    }

    /**
     * Process a single message. This method is meant to be inherited by sub-classes
     *
     * @param {object} message The message received from the surrounding manager process
     * @returns {Promise} A promise that should resolve to the response
     */
    processMessage(message)
    {
        return Promise.rejected(new Error("Unimplemented."));
    }



    /**
     * Main entry point for the script
     */
    run()
    {
        return new Promise((resolve, reject) =>
        {
            // Dependencies.
            const readline = require('readline');

            // Create the line-by-line interface.
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            // Create the event handler for each line
            rl.on('line', (line) =>
            {
                // Decode the JSON object on the line
                try
                {
                    const message = JSON.parse(line);

                    this.processMessage(message).then((response) =>
                    {
                        if (response)
                        {
                            process.stdout.write(`${JSON.stringify(response)}\n`);
                        }
                    }, (err) =>
                    {
                        reject(err);
                    });
                }
                catch (err)
                {
                    // For whatever reason, the manager process sent us invalid
                    // json. The only safe thing to do at this point is exit -
                    // we have no idea whats going on.
                    reject(new Error(`Invalid JSON received in custom transformation script: ${err.toString()}`));
                }
            });
        });
    }
}

module.exports = EBStdioScript;
