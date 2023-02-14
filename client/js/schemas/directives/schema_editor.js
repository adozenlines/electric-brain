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
 * The schema-editor. This is used for viewing a schema created by our system, and selecting which fields should
 * be included for further processing.
 */
angular.module('eb').directive('ebSchemaEditor', function ebSchemaEditor()
{
    return {
        controller($scope)
        {
            if (!$scope.title)
            {
                $scope.title = "Schema";
            }
            
            if (!$scope.showOnlyIncluded)
            {
                $scope.showOnlyIncluded = false;
            }
            
            if (!$scope.mode)
            {
                console.error("ebSchemaEditor was not provided a mode! mode must 9be 'view', 'filter', or 'configure'");
                $scope.mode = "filter";
            }
            
            if ($scope.mode === 'filter')
            {
                if ($scope.showFieldDetails)
                {
                    $scope.fieldListSize = 'col-md-8';
                }
                else
                {
                    $scope.fieldListSize = 'col-md-12';
                }
            }
            else if ($scope.mode === 'configure_neural_network_input')
            {
                $scope.fieldListSize = 'col-md-4';
            }
            else if ($scope.mode === 'configure_neural_network_output')
            {
                $scope.fieldListSize = 'col-md-4';
            }
            else if ($scope.mode === 'results')
            {
                $scope.fieldListSize = 'col-md-4';
            }
            else if ($scope.mode === 'linkage')
            {
                $scope.fieldListSize = 'col-md-12';
            }
            
            function findFirstField(schema)
            {
                let firstField = null;
                schema.walk(function(field)
                {
                    if (!firstField && (!$scope.showOnlyIncluded || field.configuration.included))
                    {
                        firstField = field;
                    }
                });
                return firstField;
            }

            $scope.selectedField = null;

            $scope.$watch('schema', function(newValue)
            {
                if (newValue)
                {
                    if (!$scope.selectedField)
                    {
                        if (newValue.properties && Object.keys(newValue.properties).length > 0)
                        {
                            $scope.selectedField = findFirstField(newValue);
                        }
                        else
                        {
                            $scope.selectedField = null;
                        }
                    }
                    else
                    {
                        // Find the same field ont he new object
                        $scope.selectedField = newValue.find($scope.selectedField.variablePath);
                    }
                }
            });
        },
        templateUrl: "views/schemas/directives/schema_editor.html",
        restrict: "E",
        scope: {
            title: '@',
            schema: '=',
            showFieldDetails: '=',
            showOnlyIncluded: '@',
            mode: '@',
            slotSide: '@'
        },
        transclude: true
    };
});
