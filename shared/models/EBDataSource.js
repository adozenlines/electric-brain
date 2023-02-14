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
const EBClassFactory = require("../components/EBClassFactory"),
    EBCustomQuery = require('./EBCustomQuery'),
    EBSchema = require('./EBSchema');


/**
 * This class represents a data source in our system. Data sources are where we get the data from - it
 * may come directly from a specific table of a database of some kind, or could be something else like
 * a publicly available data set from kaggle
 */
class EBDataSource
{
    /**
     * This constructs a full data-source object from the given raw JSON data.
     *
     * The raw JSON data would be all of the data required for a EBDataSource object.
     *
     * @param {object} rawDataSource The raw JSON data describing a data source.
     */
    constructor(rawDataSource)
    {
        const self = this;
        this.type = 'EBDataSource';
        
        Object.keys(rawDataSource).forEach(function(key)
        {
            if (key === 'dataSchema')
            {
                self[key] = new EBSchema(rawDataSource[key]);
            }
            else if (key === 'query')
            {
                self[key] = new EBCustomQuery(rawDataSource[key]);
            }
            else
            {
                self[key] = rawDataSource[key];
            }
        });


        // If there is new sampleSize, set a default value
        if (!self.sampleSize)
        {
            self.sampleSize = 500;
        }
    }

    /**
     * Returns a JSON-Schema schema for this architectures
     *
     * @returns {object} The JSON-Schema that can be used for validating this architectures in its raw form
     */
    static schema()
    {
        return {
            "id": "EBDataSource",
            "type": "object",
            "properties": {
                "_id": {},
                "name": {"type": "string"},
                "type": {"type": "string"},
                "objectsCompleted": {"type": "number"},
                "objectsTotal": {"type": "number"},
                "isSampling": {"type": "boolean"},
                "type": {
                    "type": "string",
                    "enum": ["mongo", "csv"]
                },
                "sampleSize": {
                    "type": "number"
                },
                "allowQuotedCSVFiles": {
                    "type": "boolean"
                },
                "file": {"type": "string"},
                "database": {
                    "type": "object",
                    "properties": {
                        "uri": {"type": "string"},
                        "collection": {"type": "string"}
                    },
                    "required": ["uri"]
                },
                "dataSchema": EBSchema.schema(),
                "query": EBCustomQuery.schema()
            }
        };
    }
}

EBClassFactory.registerClass('EBDataSource', EBDataSource, EBDataSource.schema());

module.exports = EBDataSource;
