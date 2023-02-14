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
    EBClassFactory = require("../components/EBClassFactory"),
    EBNumberHistogram = require('./EBNumberHistogram'),
    EBValueHistogram = require("./EBValueHistogram"),
    underscore = require('underscore');


/**
 * This class represents statistical metadata gathered about a field. Examples must be a histogram of the
 * values, etc..
 */
class EBFieldMetadata
{
    /**
     * This constructs a full EBFieldMetadata object from the given raw JSON data.
     *
     * @param {object} rawFieldMetadata The raw JSON data describing the field metadata
     */
    constructor(rawFieldMetadata)
    {
        const self = this;
        
        self.type = 'EBFieldMetadata';

        if (!rawFieldMetadata)
        {
            rawFieldMetadata = {};
        }

        Object.keys(rawFieldMetadata).forEach((key) =>
        {
            self[key] = rawFieldMetadata[key];
        });


        if (!rawFieldMetadata.types)
        {
            self.types = [];
        }

        if (!rawFieldMetadata.examples)
        {
            self.examples = [];
        }

        if (!rawFieldMetadata.interpretationChain)
        {
            self.interpretationChain = null;
        }

        if (!rawFieldMetadata.mainInterpretation)
        {
            self.mainInterpretation = null;
        }
    }


    /**
     * Returns a JSON-Schema schema for EBFieldMetadata
     *
     * @returns {object} The JSON-Schema that can be used for validating this model object
     */
    static schema()
    {
        return {
            "id": "EBFieldMetadata",
            "type": "object",
            "properties": {
                _id: {},
                variableName: {"type": "string"},
                variablePath: {"type": "string"},
                types: {
                    "type": "array",
                    "items": {"type": "string"}
                },
                examples: {"type": "array"},
                interpretationChain: {
                    "type": ["array", "null"],
                    "items": {"type": "string"}
                },
                mainInterpretation: {"type": "string"},
                statistics: {
                    "type": "object",
                    "additionalProperties": true
                }
            }
        };
    }
}

EBClassFactory.registerClass('EBFieldMetadata', EBFieldMetadata, EBFieldMetadata.schema());

module.exports = EBFieldMetadata;
