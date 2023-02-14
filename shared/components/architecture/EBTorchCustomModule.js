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
    customModuleTemplate = require("../../../build/torch/custom_module"),
    underscore = require('underscore');

/**
 *  This class represents a custom neural network module in torch. You can generate the code for the module
 *  in Lua.
 */
class EBTorchCustomModule
{
    /**
     * This creates a new custom module. You do this by providing the input and output EBTorchNode's
     * that have been arranged into a directed graph.
     *
     * @param {string} name The name of the custom module
     * @param {EBTorchNode} input The input node in the the graph of neural network modules.
     * @param {EBTorchNode} output The output node in the the graph of neural network modules.
     * @param {[string]} dependencies A list of dependencies for this module
     */
    constructor(name, input, output, dependencies)
    {
        const self = this;
        self.name = name;
        self.input = input;
        self.output = output;
        self.dependencies = dependencies || [];
    }


    /**
     * This will get the proposed file name for this module
     */
    get filename()
    {
        return `${this.name.replace(/\\s/g, "")}.lua`;
    }

    /**
     * This will generate the lua code for this module
     *
     * @returns {string} The lua code that can be written directly to a module file
     */
    generateLuaCode()
    {
        const self = this;

        // First fi compute the forward graph
        const indent = '    ';
        let allNodes = [self.output];
        let nodesToProcess = [self.output];
        const _outputs = Symbol('_outputs');
        
        const addInput = function(node, input)
        {
            // if (!input[_outputs])
            // {
            //     input[_outputs] = [];
            // }
            //
            // input[_outputs].push(node);
            
            if (allNodes.indexOf(input) === -1)
            {
                allNodes.push(input);
                nodesToProcess.push(input);
            }
            else
            {
                allNodes.splice(allNodes.indexOf(input), 1);
                allNodes.push(input);

                // nodesToProcess.splice(nodesToProcess.indexOf(input), 1);
                nodesToProcess.push(input);
            }
        };
        
        while (nodesToProcess.length > 0)
        {
            const node = nodesToProcess[0];
            nodesToProcess.splice(0, 1);

            // Add this node to its parents forward nodes
            if (underscore.isArray(node.input))
            {
                node.input.forEach((input) => addInput(node, input));
            }
            else if (node.input)
            {
                addInput(node, node.input);
            }
        }

        allNodes = allNodes.reverse();

        // Build up the output string
        let code = "";

        // Now we start outputting the lua code, node by node
        allNodes.forEach(function(node)
        {
            let inputString = "";
            if (underscore.isArray(node.input))
            {
                inputString = "{";
                inputString += node.input.map((inputNode) => inputNode.name).join(", ");
                inputString += "}";
            }
            else if (node.input)
            {
                inputString = node.input.name;
            }

            code += `${indent}local ${node.name} = ${node.module.generateLuaCode()}(${inputString})\n`;
        });

        code += "\n";
        code += "\n";

        code += `${indent}-- Add in the annotations. We do this afterwards so that the above code is more readable.\n`;
        allNodes.forEach(function(node)
        {
            code += `${indent}${node.name}:annotate({name="${node.name}"})\n`;
        });

        code += "\n";
        code += "\n";

        code += `${indent}local module = nn.gModule({${self.input.name}}, {${self.output.name}})`;

        // Use a dot.js template to fill in the rest
        return customModuleTemplate({
            moduleName: self.name,
            code: code,
            dependencies: self.dependencies
        });
    }
    
}

module.exports = EBTorchCustomModule;
