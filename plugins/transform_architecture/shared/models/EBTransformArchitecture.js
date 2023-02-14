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
    EBArchitecture = require("../../../../shared/models/EBArchitecture"),
    EBClassFactory = require("../../../../shared/components/EBClassFactory"),
    EBCustomTransformation = require("../../../../shared/components/architecture/EBCustomTransformation"),
    EBDataSource = require("../../../../shared/models/EBDataSource"),
    EBSchema = require("../../../../shared/models/EBSchema"),
    underscore = require("underscore");

/**
 * This class represents a neural network architectures. It specifies where the data comes from and how
 * it gets transformed for the neural network. It then specifies the design of that neural network.
 */
class EBTransformArchitecture extends EBArchitecture
{
    /**
     * This constructs a full architecture object from the given raw JSON data.
     *
     * @param {object} rawArchitecture The raw JSON data describing a architecture
     */
    constructor(rawArchitecture)
    {
        super(rawArchitecture);
        this.name = rawArchitecture.name;
        this.classType = "EBTransformArchitecture";

        Object.keys(rawArchitecture).forEach((key) =>
        {
            if (key === 'inputSchema' || key === 'outputSchema')
            {
                if (rawArchitecture[key])
                {
                    this[key] = new EBSchema(rawArchitecture[key]);
                }
                else
                {
                    this[key] = null;
                }
            }
            else if (key === 'dataSource')
            {
                if (rawArchitecture[key])
                {
                    this[key] = new EBDataSource(rawArchitecture[key]);
                }
                else
                {
                    this[key] = null;
                }
            }
            else
            {
                this[key] = rawArchitecture[key];
            }
        });
    }


    /**
     * This method returns whether or not the chosen fields for the input and output schema
     * are valid.
     *
     * @returns {boolean} True if the chosen input/output fields are valid. Otherwise false.
     */
    validInputOutputSchemas()
    {
        const self = this;

        // First, make sure we even have an input and output schema
        if (!self.inputSchema || !self.outputSchema)
        {
            return false;
        }

        // Next, create a map of all the fields in the schemas that are set as included
        const includedInputSchemas = [];
        const includedInputFields = [];
        const includedOutputSchemas = [];
        const includedOutputFields = [];
        self.inputSchema.walk((schema) =>
        {
            if (schema.configuration.included)
            {
                includedInputSchemas.push(schema.variablePath);
                if (schema.isField)
                {
                    includedInputFields.push(schema.variablePath);
                }
            }
        });
        self.outputSchema.walk((schema) =>
        {
            if (schema.configuration.included)
            {
                includedOutputSchemas.push(schema.variablePath);
                if (schema.isField)
                {
                    includedOutputFields.push(schema.variablePath);
                }
            }
        });

        // There must be at least one field for both the input and output
        if (includedInputFields.length === 0 || includedOutputFields.length === 0)
        {
            return false;
        }

        // There must not be any fields in common between the input and output
        if (underscore.intersection(includedInputFields, includedOutputFields).length > 0)
        {
            return false;
        }

        // None of the output fields can be a binary, since this would involve generating
        // data (currently not supported)
        let outputBinaryFound = false;
        self.outputSchema.walk((schema) =>
        {
            if (schema.configuration.included && schema.isBinary)
            {
                outputBinaryFound = true;
            }
        });
        if (outputBinaryFound)
        {
            return false;
        }

        // Any arrays on the output must also exist on the input. The system
        // Isn't going to generate arrays for you (yet!)
        let foundOutputOnlyArray = false;
        self.outputSchema.walk((field) =>
        {
            if (field.isArray && field.configuration.included)
            {
                // Check to see that this array also exists on the input
                if (includedInputSchemas.indexOf(field.variablePath) === -1)
                {
                    foundOutputOnlyArray = true;
                }
            }
        });
        if (foundOutputOnlyArray)
        {
            return false;
        }

        // None of our failing conditions have been hit, then this architectures schemas are indeed valid!
        // Yay!
        return true;
    }

    /**
     * Returns a JSON-Schema schema for this architectures
     *
     * @returns {object} The JSON-Schema that can be used for validating this architectures in its raw form
     */
    static schema()
    {
        return {
            "id": "EBTransformArchitecture",
            "type": "object",
            "properties": {
                "_id": {},
                "name": {"type": "string"},
                "classType": {"type": "string"},
                "dataSource": EBDataSource.schema(),
                "inputSchema": EBSchema.schema(),
                "outputSchema": EBSchema.schema()
            }
        };
    }
}

EBClassFactory.registerClass('EBTransformArchitecture', EBTransformArchitecture, EBTransformArchitecture.schema());

module.exports = EBTransformArchitecture;
