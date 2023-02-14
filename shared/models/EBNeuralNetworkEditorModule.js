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
    EBTorchModule = require('./../components/architecture/EBTorchModule'),
    EBTensorSchema = require("./EBTensorSchema");

/**
 * This class represents a single NN module, as represented by the neural network editor
 */
class EBNeuralNetworkEditorModule
{
    /**
     * This constructs a EBNeuralNetworkEditorModule from the raw data
     *
     * @param {object} rawModule The raw JSON data describing the neural network module
     */
    constructor(rawModule)
    {
        this.name = rawModule.name;
        this.classType = 'EBNeuralNetworkEditorModule';

        for (let parameter of this.parameters)
        {
            this[parameter.name] = rawModule[parameter.name];
        }

        if (rawModule.locked)
        {
            this.locked = true;
        }
        else
        {
            this.locked = false;
        }
    }


    /**
     * This function returns the parameters for this module
     */
    get parameters()
    {
        return EBNeuralNetworkEditorModule.knownLayers[this.name].parameters;
    }


    /**
     * This function returns the namespace for this module
     */
    get namespace()
    {
        return EBNeuralNetworkEditorModule.knownLayers[this.name].moduleNamespace;
    }


    /**
     * This function creates the EBTorchModule object for this module.
     *
     * @param {EBTensorSchema} inputTensorSchema The tensor schema with the shape of the input to this module,
     * @param {object} substitutionValues Any parameters for substitutions within the network - this allows filling in values within templates
     */
    createModule(inputTensorSchema, substitutionValues)
    {
        const layerInfo = EBNeuralNetworkEditorModule.knownLayers[this.name];
        // See if there is a special creation function, otherwise use the generic one.
        if (layerInfo.createModule)
        {
            return layerInfo.createModule.apply(this, [inputTensorSchema, substitutionValues]);
        }
        // Use generic create module function
        else
        {
            if (!inputTensorSchema.isTensor)
            {
                throw new Error("Only a raw tensor is accepted as input for this module. This EBTensorSchema is describing a table!");
            }

            return new EBTorchModule(`${this.namespace}.${this.name}`, this.parameters.map((param) =>
            {
                return this.getParameterValue(param.name, substitutionValues);
            }));
        }
    }



    /**
     * This function returns the value for the given parameter. Handles substitution and casting
     *
     * @param {string} parameter The name of the parameter
     * @param {object} substitutionValues Any parameters for substitutions within the network - this allows filling in values within templates
     */
    getParameterValue(parameter, substitutionValues)
    {
        if (substitutionValues && substitutionValues[this[parameter]] !== undefined)
        {
            return substitutionValues[this[parameter]];
        }
        else
        {
            return Number(this[parameter]);
        }
    }


    /**
     * This function returns a tensor schema describing the output from this module
     *
     * @param {EBTensorSchema} inputTensorSchema The tensor schema with the shape of the input to this module
     * @param {object} substitutionValues Any parameters for substitutions within the network - this allows filling in values within templates
     */
    getOutputTensorSchema(inputTensorSchema, substitutionValues)
    {
        const layerInfo = EBNeuralNetworkEditorModule.knownLayers[this.name];
        // See if there is a special creation function, otherwise use the generic one.
        if (layerInfo.getOutputTensorSchema)
        {
            return layerInfo.getOutputTensorSchema.apply(this, [inputTensorSchema, substitutionValues]);
        }
        // Use generic create module function
        else
        {
            if (!inputTensorSchema.isTensor)
            {
                throw new Error("Only a raw tensor is accepted as input for this module. This EBTensorSchema is describing a table!");
            }

            // Return the input tensor schema unmodified.
            return inputTensorSchema;
        }
    }


    /**
     * This function creates a neural network chain consisting of all the modules
     *
     * @param {[EBNeuralNetworkEditorModule]} modules A bunch of neural network editor modules
     * @param {EBTensorSchema} inputTensorSchema The tensor schema for the input
     * @param {object} substitutionValues Any parameters for substitutions within the network - this allows filling in values within templates
     * @returns {object} An object with two properties, {module, outputTensorSchema}
     */
    static createModuleChain(modules, inputTensorSchema, substitutionValues)
    {
        modules = modules.map((module) => new EBNeuralNetworkEditorModule(module));

        const torchModules = [];

        let currentTensorSchema = inputTensorSchema;

        for(let module of modules)
        {
            torchModules.push(module.createModule(currentTensorSchema, substitutionValues));
            currentTensorSchema = module.getOutputTensorSchema(currentTensorSchema, substitutionValues);
        }

        return {
            module: new EBTorchModule("nn.Sequential", [], torchModules),
            outputTensorSchema: currentTensorSchema
        };
    }


    /**
     * This function returns a new layer object with the default values
     *
     * @param {String} name The name of the layer to be created.
     */
    static createNewLayer(name)
    {
        const data = {
            name: name
        };

        const layerInfo = EBNeuralNetworkEditorModule.knownLayers[name];

        if (!layerInfo)
        {
            throw new Error(`Unknown layer type ${name}`);
        }

        layerInfo.parameters.forEach((param) =>
        {
            data[param.name] = param.defaultValue;
        });


        return new EBNeuralNetworkEditorModule(data);
    }


    /**
     * Returns a JSON-Schema schema for EBNeuralNetworkEditorModule
     *
     * @returns {object} The JSON-Schema that can be used for validating this model object
     */
    static schema()
    {
        return {
            "id": "EBNeuralNetworkEditorModule",
            "type": "object",
            "properties": {
                name: {"type": "string"},
                locked: {"type": "boolean"}
            },
            "additionalProperties": {"type": ["string", "number"]}
        };
    }
}


EBNeuralNetworkEditorModule.knownLayers = {
    HardTanh: {
        name: 'HardTanh',
        moduleNamespace: 'nn',
        fixed: true,
        sequence: false,
            parameters: [
            {
                name: 'min_value',
                defaultValue: -1
            },
            {
                name: 'max_value',
                defaultValue: 1
            }
        ]
    },
    HardShrink: {
        name: 'HardShrink',
        moduleNamespace: 'nn',
        fixed: true,
        sequence: false,
            parameters: [
            {
                name: 'lambda',
                defaultValue: 0.5
            }
        ]
    },
    SoftShrink: {
        name: 'SoftShrink',
        moduleNamespace: 'nn',
        fixed: true,
        sequence: false,
            parameters: [
            {
                name: 'lambda',
                defaultValue: 0.5
            }
        ]
    },
    SoftMax: {
        name: 'SoftMax',
        moduleNamespace: 'nn',
        fixed: true,
        sequence: false,
            parameters: []
    },
    SoftMin: {
        name: 'SoftMin',
        moduleNamespace: 'nn',
        fixed: true,
        sequence: false,
            parameters: []
    },
    SoftPlus: {
        name: 'SoftPlus',
        moduleNamespace: 'nn',
        fixed: true,
        sequence: false,
            parameters: []
    },
    SoftSign: {
        name: 'SoftSign',
        moduleNamespace: 'nn',
        fixed: true,
        sequence: false,
            parameters: []
    },
    LogSigmoid: {
        name: 'LogSigmoid',
        moduleNamespace: 'nn',
        fixed: true,
        sequence: false,
            parameters: []
    },
    LogSoftMax: {
        name: 'LogSoftMax',
        moduleNamespace: 'nn',
        fixed: true,
        sequence: false,
            parameters: []
    },
    Sigmoid: {
        name: 'Sigmoid',
        moduleNamespace: 'nn',
        fixed: true,
        sequence: false,
            parameters: []
    },
    Tanh: {
        name: 'Tanh',
        moduleNamespace: 'nn',
        fixed: true,
        sequence: false,
            parameters: []
    },
    ReLU: {
        name: 'ReLU',
        moduleNamespace: 'nn',
        fixed: true,
        sequence: false,
            parameters: []
    },
    ReLU6: {
        name: 'ReLU6',
        moduleNamespace: 'nn',
        fixed: true,
        sequence: false,
            parameters: []
    },
    PReLU: {
        name: 'PReLU',
        moduleNamespace: 'nn',
        fixed: true,
        sequence: false,
            parameters: []
    },
    RReLU: {
        name: 'RReLU',
        moduleNamespace: 'nn',
        fixed: true,
        sequence: false,
            parameters: [
            {
                name: 'l',
                defaultValue: (1.0 / 8.0)
            },
            {
                name: 'u',
                defaultValue: (1.0 / 3.0)
            }
        ]
    },
    ELU: {
        name: 'ELU',
        moduleNamespace: 'nn',
        fixed: true,
        sequence: false,
            parameters: [
            {
                name: 'alpha',
                defaultValue: 1.0
            }
        ]
    },
    LeakyReLU: {
        name: 'LeakyReLU',
        moduleNamespace: 'nn',
        fixed: true,
        sequence: false,
            parameters: [
            {
                name: 'negval',
                defaultValue: 1.0 / 100.0
            }
        ]
    },
    SpatialSoftMax: {
        name: 'SpatialSoftMax',
        moduleNamespace: 'nn',
        fixed: true,
        sequence: false,
            parameters: []
    },
    SpatialLogSoftMax: {
        name: 'SpatialLogSoftMax',
        moduleNamespace: 'nn',
        fixed: true,
        sequence: false,
            parameters: []
    },
    AddConstant: {
        name: 'AddConstant',
        moduleNamespace: 'nn',
        fixed: true,
        sequence: false,
            parameters: [
            {
                name: 'constant',
                defaultValue: 1.0
            }
        ]
    },
    MulConstant: {
        name: 'MulConstant',
        moduleNamespace: 'nn',
        fixed: true,
        sequence: false,
            parameters: [
            {
                name: 'constant',
                defaultValue: 1.0
            }
        ]
    },
    Linear: {
        name: 'Linear',
        moduleNamespace: 'nn',
        fixed: true,
        sequence: false,
        parameters: [
            {
                name: 'outputSize',
                defaultValue: 100
            }
        ],
        createModule: function(inputTensorSchema, substitutionValues)
        {
            return new EBTorchModule("nn.Linear", [inputTensorSchema.tensorSize, this.getParameterValue("outputSize", substitutionValues)]);
        },
        getOutputTensorSchema: function(inputTensorSchema, substitutionValues)
        {
            return EBTensorSchema.generateDataTensorSchema(this.getParameterValue("outputSize", substitutionValues), "output");
        }
    },
    SparseLinear: {
        name: 'SparseLinear',
        moduleNamespace: 'nn',
        fixed: true,
        sequence: false,
        parameters: [
            {
                name: 'outputSize',
                defaultValue: 100
            }
        ],
        createModule: function(inputTensorSchema, substitutionValues)
        {
            return new EBTorchModule("nn.SparseLinear", [inputTensorSchema.tensorSize, this.getParameterValue("outputSize", substitutionValues)]);
        },
        getOutputTensorSchema: function(inputTensorSchema, substitutionValues)
        {
            return EBTensorSchema.generateDataTensorSchema(this.getParameterValue("outputSize", substitutionValues), "output");
        }
    },
    Dropout: {
        name: 'Dropout',
        moduleNamespace: 'nn',
        fixed: true,
        sequence: false,
        parameters: [
            {
                name: 'p',
                defaultValue: 0.4
            }
        ]
    },
    SeqBRNN: {
        name: 'SeqBRNN',
        moduleNamespace: 'rnn',
        fixed: false,
        sequence: true,
        parameters: [
            {
                name: 'outputSize',
                defaultValue: 100
            }
        ],
        createModule: function(inputTensorSchema, substitutionValues)
        {
            return new EBTorchModule("nn.SeqBRNN", [inputTensorSchema.tensorSize, this.getParameterValue("outputSize", substitutionValues)]);
        },
        getOutputTensorSchema: function(inputTensorSchema, substitutionValues)
        {
            return EBTensorSchema.generateDataTensorSchema(this.getParameterValue("outputSize", substitutionValues), "output");
        }
    },
    SeqLSTM: {
        name: 'SeqLSTM',
        moduleNamespace: 'rnn',
        fixed: false,
        sequence: true,
        parameters: [
            {
                name: 'outputSize',
                defaultValue: 100
            }
        ],
        createModule: function(inputTensorSchema, substitutionValues)
        {
            return new EBTorchModule("nn.SeqLSTM", [inputTensorSchema.tensorSize, this.getParameterValue("outputSize", substitutionValues)]);
        },
        getOutputTensorSchema: function(inputTensorSchema, substitutionValues)
        {
            return EBTensorSchema.generateDataTensorSchema(this.getParameterValue("outputSize", substitutionValues), "output");
        }
    },
    SeqGRU: {
        name: 'SeqGRU',
        moduleNamespace: 'rnn',
        fixed: false,
        sequence: true,
        parameters: [
            {
                name: 'outputSize',
                defaultValue: 100
            }
        ],
        createModule: function(inputTensorSchema, substitutionValues)
        {
            return new EBTorchModule("nn.SeqGRU", [inputTensorSchema.tensorSize, this.getParameterValue("outputSize", substitutionValues)]);
        },
        getOutputTensorSchema: function(inputTensorSchema, substitutionValues)
        {
            return EBTensorSchema.generateDataTensorSchema(this.getParameterValue("outputSize", substitutionValues), "output");
        }
    }
};

EBClassFactory.registerClass('EBNeuralNetworkEditorModule', EBNeuralNetworkEditorModule, EBNeuralNetworkEditorModule.schema());

module.exports = EBNeuralNetworkEditorModule;


