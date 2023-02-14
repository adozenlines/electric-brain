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

const EBClassFactory = require("./EBClassFactory"),
    EBTorchModule = require('./architecture/EBTorchModule'),
    EBNeuralNetworkEditorModule = require("../models/EBNeuralNetworkEditorModule");

/**
 * This static class contains functionality which generates neural networks templates. Not totally sure what to do with this
 * code yet.
 */
class EBNeuralNetworkTemplateGenerator
{
    /**
     *  This static method generates a multi layer perceptron template, useful for outputs which require an MLP
     *
     *  @param {string} networkSize How large of a perceptron to make. Can be 'small', 'medium' and 'large
     */
    static generateMultiLayerPerceptronTemplate(networkSize)
    {
        if (networkSize === 'small')
        {
            return [
                new EBNeuralNetworkEditorModule({
                    name: 'Linear',
                    locked: false,
                    outputSize: 150
                }),
                new EBNeuralNetworkEditorModule({
                    name: 'ELU',
                    locked: false,
                    alpha: 1
                }),
                new EBNeuralNetworkEditorModule({
                    name: 'Linear',
                    locked: true,
                    outputSize: "outputSize"
                })
            ];
        }
        else if (networkSize === 'medium')
        {
            return [
                new EBNeuralNetworkEditorModule({
                    name: 'Linear',
                    locked: false,
                    outputSize: 250
                }),
                new EBNeuralNetworkEditorModule({
                    name: 'ELU',
                    locked: false,
                    alpha: 1
                }),
                new EBNeuralNetworkEditorModule({
                    name: 'Linear',
                    locked: false,
                    outputSize: 250
                }),
                new EBNeuralNetworkEditorModule({
                    name: 'ELU',
                    locked: false,
                    alpha: 1
                }),
                new EBNeuralNetworkEditorModule({
                    name: 'Linear',
                    locked: true,
                    outputSize: "outputSize"
                })
            ];
        }
        else if (networkSize === 'large')
        {
            return [
                new EBNeuralNetworkEditorModule({
                    name: 'Linear',
                    locked: false,
                    outputSize: 500
                }),
                new EBNeuralNetworkEditorModule({
                    name: 'ELU',
                    locked: false,
                    alpha: 1
                }),
                new EBNeuralNetworkEditorModule({
                    name: 'Linear',
                    locked: false,
                    outputSize: 500
                }),
                new EBNeuralNetworkEditorModule({
                    name: 'ELU',
                    locked: false,
                    alpha: 1
                }),
                new EBNeuralNetworkEditorModule({
                    name: 'Linear',
                    locked: true,
                    outputSize: "outputSize"
                })
            ];
        }
    }
    
    
    /**
     *  This static method generates a multi layer LSTM template
     *
     *  @param {string} networkSize How large of an LSTM network to make. Can be 'small', 'medium' and 'large'
     */
    static generateMultiLayerLSTMTemplate(networkSize)
    {
        if (networkSize === 'small')
        {
            return [
                new EBNeuralNetworkEditorModule({
                    name: 'SeqBRNN',
                    locked: false,
                    outputSize: 100
                }),
                new EBNeuralNetworkEditorModule({
                    name: 'SeqBRNN',
                    locked: false,
                    outputSize: 100
                })
            ];
        }
        else if (networkSize === 'medium')
        {
            return [
                new EBNeuralNetworkEditorModule({
                    name: 'SeqBRNN',
                    locked: false,
                    outputSize: 300
                }),
                new EBNeuralNetworkEditorModule({
                    name: 'SeqBRNN',
                    locked: false,
                    outputSize: 300
                })
            ];
        }
        else if (networkSize === 'large')
        {
            return [
                new EBNeuralNetworkEditorModule({
                    name: 'SeqBRNN',
                    locked: false,
                    outputSize: 500
                }),
                new EBNeuralNetworkEditorModule({
                    name: 'SeqBRNN',
                    locked: false,
                    outputSize: 500
                }),
                new EBNeuralNetworkEditorModule({
                    name: 'SeqBRNN',
                    locked: false,
                    outputSize: 500
                })
            ];
        }
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
            },
            "additionalProperties": {"type": "string"}
        };
    }
}

module.exports = EBNeuralNetworkTemplateGenerator;


