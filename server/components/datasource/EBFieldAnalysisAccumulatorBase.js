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
    crypto = require('crypto'),
    fileType = require('file-type'),
    underscore = require('underscore');

/**
 * This class is used to analyze values from a field and determine schema information about that
 * field. At the end, this accumulator produces an EBFieldMetadata object.
 */
class EBFieldAnalysisAccumulatorBase
{
    /**
     * This creates an empty accumulator.
     */
    constructor()
    {
        const self = this;
    }

    /**
     * This method accumulates a value into the field metadata.
     *
     * @param {anything} value The value that should be analyzed
     *                                 
     * @returns {Promise} A Promise when the value has been analyzed.
     */
    accumulateValue(value)
    {
        return Promise.rejected(new Error("Unimplemented"));
    }


    /**
     * This method should return an object containing interpretation-specific statistics on this field.
     */
    getFieldStatistics()
    {
        return Promise.rejected(new Error("Unimplemented"));
    }


    /**
     * This is just a convenience method that returns an integer fingerprint of a given string or buffer.
     * It uses hashing to compute the fingerprint
     * 
     * @param {String|Buffer} value A value to be hashed
     * @returns {Number} A 32 bit number
     */
    static fingerprint32(value)
    {
        const hash = crypto.createHash('sha256');
        hash.update(value);
        // Create the hash, and obtain 32 bits of entropy, and convert it to a
        // nice, tight integer we can use as a fingerprint
        return parseInt(`0x${hash.digest('hex').slice(0, 8)}`);
    }
}

module.exports = EBFieldAnalysisAccumulatorBase;
