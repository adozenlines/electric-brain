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

/**
 * Represents a single field being configured within the neural network
 */
angular.module('eb').directive('ebStringInterpretationConfiguration', function ebStringInterpretationConfiguration($timeout, EBDataSourceService)
{
    function controller($scope, $element, $attrs)
    {
        
    }

    return {
        templateUrl: "/plugins/string/views/directives/string_interpretation_configuration.html",
        controller,
        restrict: "A",
        scope: {
            field: '='
        }
    };
});
