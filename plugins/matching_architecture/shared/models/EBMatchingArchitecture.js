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
    EBNeuralNetworkEditorModule = require("../../../../shared/models/EBNeuralNetworkEditorModule"),
    EBNeuralNetworkTemplateGenerator = require("../../../../shared/components/EBNeuralNetworkTemplateGenerator"),
    EBSchema = require("../../../../shared/models/EBSchema");

/**
 * This class represents a neural network architectures. It specifies where the data comes from and how
 * it gets transformed for the neural network. It then specifies the design of that neural network.
 */
class EBMatchingArchitecture extends EBArchitecture
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
        this.classType = "EBMatchingArchitecture";

        Object.keys(rawArchitecture).forEach((key) =>
        {
            if (key === 'primarySchema' || key === 'secondarySchema' || key === 'linkagesSchema')
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
            else if (key === 'primaryDataSource' || key === 'secondaryDataSource')
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

        if (!this.primaryFixedLayers)
        {
            this.primaryFixedLayers = EBNeuralNetworkTemplateGenerator.generateMultiLayerPerceptronTemplate('medium');
        }

        if (!this.secondaryFixedLayers)
        {
            this.secondaryFixedLayers = EBNeuralNetworkTemplateGenerator.generateMultiLayerPerceptronTemplate('medium');
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
            "id": "EBMatchingArchitecture",
            "type": "object",
            "properties": {
                "_id": {},
                "name": {"type": "string"},
                "classType": {"type": "string"},
                "primaryDataSource": EBDataSource.schema(),
                "secondaryDataSource": EBDataSource.schema(),
                "primarySchema": EBSchema.schema(),
                "secondarySchema": EBSchema.schema(),
                "linkagesSchema": EBSchema.schema(),
                "primaryLinkFields": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "leftField": {"type": "string"},
                            "rightField": {"type": "string"}
                        }
                    }
                },
                "secondaryLinkFields": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "leftField": {"type": "string"},
                            "rightField": {"type": "string"}
                        }
                    }
                },
                "primaryFixedLayers": {
                    "type": "array",
                    "items": EBNeuralNetworkEditorModule.schema()
                },
                "secondaryFixedLayers": {
                    "type": "array",
                    "items": EBNeuralNetworkEditorModule.schema()
                }
            }
        };
    }
}

EBClassFactory.registerClass('EBMatchingArchitecture', EBMatchingArchitecture, EBMatchingArchitecture.schema());

module.exports = EBMatchingArchitecture;
