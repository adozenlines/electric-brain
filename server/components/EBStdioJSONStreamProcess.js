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
    childProcess = require('child_process'),
    chunkingStreams = require('chunking-streams'),
    EventEmitter = require('events'),
    Promise = require('bluebird'),
    stream = require('stream'),
    underscore = require('underscore');

/**
 * This is a shared class used for creating and managing sub-processes that one communicates with
 * via standard input/input.
 *
 * This class emits events in a similar manner to the native NodeJS child_process class. The difference
 * being that errors on any of the individual streams (stdin, stdout, stderr) are just treated as errors
 * on the EBStdioJSONStreamProcess itself
 */
class EBStdioJSONStreamProcess extends EventEmitter
{
    /**
     * Vanilla constructor
     */
    constructor()
    {
        super();
        this.running = true;
    }

    /**
     * This method returns the input stream. You can directly write JSON objects to the input
     * stream and they will get converted and sent to the sub process.
     *
     * @return {Stream} A native NodeJS stream that you can write to.
     */
    get inputStream()
    {
        return this.input;
    }

    /**
     * This method returns the output stream. You can directly read from the output stream,
     * pipe it into another stream. Your choice.
     *
     * @return {Stream} A native NodeJS stream that you can read from.
     */
    get outputStream()
    {
        return this.output;
    }

    /**
     * This method returns the PID of the sub process
     *
     * @return {int} The integer PID
     */
    get pid()
    {
        return this.process.pid;
    }

    /**
     * Write a message to the sub-process. A convenience method for inputStream.write()
     *
     * @param {object} object The object to be sent to the sub-process
     * @return {Promise} Resolves a promise after the message has been written
     */
    write(object)
    {
        if (!this.running)
        {
            return Promise.reject(new Error("Sub-process has crashed."));
        }
        
        return Promise.fromCallback((callback) =>
        {
            this.input.write(object, callback);
        });
    }


    /**
     * Waits for a message from the outputStream that exactly matches the given condition object.
     * E.g. if your condition is {"type": "result"}, then this function will wait for an object
     * from the process that has at least a field "type" with value "result". It will then
     * the call the given callback with that message.
     *
     * Very useful for quickly implementing RPC schemes with the sub-process
     *
     * @param {object} condition The condition object which will be waited for.
     * @return {Promise} Resolves a promise once a message that matches the condition is seen. No further messages will be examined.
     */
    waitForMatchingOutput(condition)
    {
        const self = this;

        if (!this.running)
        {
            return Promise.reject(new Error("Sub-process has crashed."));
        }

        return Promise.fromCallback((callback) =>
        {
            const predicate = underscore.matcher(condition);
            let errorHandler = null;
            const dataHandler = (data) =>
            {
                if (predicate(data))
                {
                    self.removeListener('error', errorHandler);
                    self.removeListener('exit', errorHandler);
                    self.removeListener('close', errorHandler);
                    self.output.removeListener('data', dataHandler);
                    return callback(null, data);
                }
            };

            errorHandler = (error) =>
            {
                self.removeListener('error', errorHandler);
                self.removeListener('exit', errorHandler);
                self.removeListener('close', errorHandler);
                self.output.removeListener('data', dataHandler);
                if (!error)
                {
                    return callback(new Error("Sub-process has crashed."), null);
                }
                return callback(error, null);
            };

            self.output.on('data', dataHandler);
            self.once('error', errorHandler);
            self.once('exit', errorHandler);
            self.once('close', errorHandler);
        });
    }

    /**
     * Write a message to the sub-process, and then waits for a matching output
     * response to be send. A convenience method that combines the write() method
     * with the waitForMatchingOutput method.
     *
     * @param {object} object The object to be sent to the sub-process
     * @param {object} condition The condition object used for waiting. See EBStdioJSONStreamProcess.waitForMatchingOutput
     * @return {Promise} Resolves a promise after the message has been written
     */
    writeAndWaitForMatchingOutput(object, condition)
    {
        const self = this;
        const promise = self.write(object);
        return promise.then(() =>
        {
            return self.waitForMatchingOutput(condition);
        });
    }

    /**
     * Starts up the sub process. This takes the same arguments as the NodeJS native
     * child_process.spawn. See https://nodejs.org/dist/latest/docs/api/child_process.html
     *
     * @param {string} command The command to be run.
     * @param {[string]} args A list of arguments to be passed into the process
     * @param {object} options Options for the sub process. This is exactly the same as child_process.spawn.
     *
     * @return {Promise} Resolves a promise after the sub-process is started with the EBStdioJSONStreamProcess object.
     */
    static spawn(command, args, options)
    {
        return Promise.fromCallback((callback) =>
        {
            const jsonStreamProcess = new EBStdioJSONStreamProcess();

            // Start up the process
            jsonStreamProcess.process = childProcess.spawn(command, args, options);

            jsonStreamProcess.input = new stream.Transform({
                objectMode: true,
                transform: function(chunk, encoding, next)
                {
                    this.push(`${JSON.stringify(chunk)}\n`);
                    return next();
                }
            });

            jsonStreamProcess.input.pipe(jsonStreamProcess.process.stdin);


            jsonStreamProcess.output = new stream.Transform({
                objectMode: true,
                transform: function(chunk, encoding, next)
                {
                    // Take its output and interpret it as a JSON object
                    try
                    {
                        this.push(JSON.parse(chunk.toString()));
                        return next();
                    }
                    catch (err)
                    {
                        console.error(`error`, `Error from sub-process "${command} ${args.join(' ')}". Output is not valid JSON: ${chunk}`);
                        console.error(err);
                        return next();
                    }
                }
            });

            // Create a new chunker on the standard output to chunk it into single lines, each line containing a JSON object.
            const lineChunker = new chunkingStreams.LineCounter({
                numLines: 1,
                flushTail: false
            });

            // Pipe the output through the chunker into the output stream which decodes it as JSON
            jsonStreamProcess.process.stdout.pipe(lineChunker);
            lineChunker.pipe(jsonStreamProcess.output);

            jsonStreamProcess.process.stderr.on('data', (data) =>
            {
                console.error(data.toString());
            });

            jsonStreamProcess.process.stdin.on('error', (err) =>
            {
                jsonStreamProcess.emit('error', err);
            });

            jsonStreamProcess.process.stdout.on('error', (err) =>
            {
                jsonStreamProcess.emit('error', err);
            });

            jsonStreamProcess.process.stderr.on('error', (err) =>
            {
                jsonStreamProcess.emit('error', err);
            });

            jsonStreamProcess.process.on('close', (exitCode) =>
            {
                jsonStreamProcess.running = false;
                jsonStreamProcess.emit('close', exitCode);
            });

            jsonStreamProcess.process.on('disconnect', () =>
            {
                jsonStreamProcess.running = false;
                jsonStreamProcess.emit('disconnect');
            });

            jsonStreamProcess.process.on('error', (error) =>
            {
                jsonStreamProcess.emit('error', error);
            });

            jsonStreamProcess.process.on('exit', () =>
            {
                jsonStreamProcess.running = false;
                jsonStreamProcess.emit('exit');
            });

            // Set listener settings
            jsonStreamProcess.setMaxListeners(100);
            jsonStreamProcess.input.setMaxListeners(100);
            jsonStreamProcess.output.setMaxListeners(100);

            callback(null, jsonStreamProcess);
        });
    }

}

module.exports = EBStdioJSONStreamProcess;
