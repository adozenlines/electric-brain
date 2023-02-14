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
    assert = require('assert'),
    EBTorchModule = require("./EBTorchModule"),
    underscore = require('underscore');

/**
 *  This class represents a node in a Torch neural network graph
 */
class EBTorchNode
{
    /**
     * This creates a new torch node.
     *
     * @param {EBTorchModule} module The torch module for this node in the graph
     * @param {EBTorchNode | [EBTorchNode]} input Either a single EBTorchNode or an array of EBTorchNodes, representing the inputs to this node on the network graph
     * @param {string} name The name of the node in the torch graph
     * @param {boolean} debug Whether to enable debug output before and after this node
     */
    constructor(module, input, name, debug)
    {
        const self = this;

        // Some assertions for sanity
        assert(module);
        assert(name);

        // If debug, wrap the module in a debug module
        if (debug)
        {
            self.module = new EBTorchModule("nn.EBWrapDebug", [module, `"${name}"`]);
        }
        else
        {
            self.module = module;
        }
        self.input = input;
        self.name = name;
    }


}

module.exports = EBTorchNode;
