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
 * Represents a single field in the schema editor
 */
angular.module('eb').directive('ebSchemaEditorField', function ebSchemaEditorField($timeout, EBDataSourceService, $interval)
{
    function controller($scope, $element, $attrs)
    {
        $scope.toggleFieldSubSchema = function toggleFieldSubSchema(field)
        {
            $scope.selectedField = field;

            if (field.configuration.open)
            {
                field.configuration.open = false;
            }
            else
            {
                field.configuration.open = true;
            }
        };

        $scope.toggleIncludeSchemaField = function toggleIncludeSchemaField(field, $event)
        {
            $event.stopPropagation();

            field.setIncluded(!field.configuration.included);
        };

        $scope.grabLink = function($event)
        {
            $scope.$emit('slot-selected', {
                field: $scope.field
            });
        };

        if ($scope.mode === 'linkage')
        {
            $timeout(function()
            {
                $element.find('.linkage-element').each((index, linkageElement) =>
                {
                    $scope.$emit('register-slot', {
                        slotSide: $scope.slotSide || "n/a",
                        field: $scope.field,
                        x: $(linkageElement).offset().left + 11,
                        y: $(linkageElement).offset().top + 11
                    });
                });
            }, 25);
        }
    }

    return {
        templateUrl: "views/schemas/directives/schema_editor_field.html",
        controller,
        restrict: "A",
        scope: {
            field: '=ebSchemaEditorField',
            selectedField: '=',
            mode: '@',
            slotSide: '@',
            showOnlyIncluded: '='
        }
    };
});
