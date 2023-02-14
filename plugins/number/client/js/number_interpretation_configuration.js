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
 * This directive provides the menu for configuring fields being interpretted as binary data.
 */
angular.module('eb').directive('ebNumberInterpretationConfiguration', function ebNumberInterpretationConfiguration($timeout)
{
    function controller($scope, $element, $attrs)
    {
        $scope.numberConfigurationValues = [
            'discrete',
            'continuous_raw',
            'continuous_normalized'
        ];

        $scope.numberConfigurationTitles = [
            'Discrete',
            'Continuous (Raw)',
            'Continuous (Normalized Z-Scores)'
        ];
        
        $scope.scalingFunctionValues = [
            'linear',
            'quadratic',
            'logarithmic'
        ];

        $scope.scalingFunctionTitles = [
            'Linear',
            'Quadratic',
            'Logarithmic'
        ];

        $scope.$watch('field.configuration.interpretation.mode', function(newValue, oldValue)
        {
            if (newValue === 'discrete')
            {
                if (!$scope.field.configuration.interpretation.discreteValues)
                {
                    $scope.field.configuration.interpretation.discreteValues = [
                        {
                            top: null,
                            bottom: 0,
                            name: "discrete_value_1"
                        },
                        {
                            top: 0,
                            bottom: null,
                            name: "discrete_value_2"
                        }
                    ];
                }
            }
            else if (newValue === 'continuous_raw')
            {
                if (!$scope.field.configuration.interpretation.scalingFunction)
                {
                    $scope.field.configuration.interpretation.scalingFunction = 'linear';
                }
            }
            else if (newValue === 'continuous_normalized')
            {
                // Do nothing
            }
        });


        $scope.addDiscreteValue = function(index)
        {
            const previousDiscreteValue = $scope.field.configuration.interpretation.discreteValues[index - 1];
            const nextDiscreteValue = $scope.field.configuration.interpretation.discreteValues[index];

            // Find a unique name for the discrete value
            let name = null;
            let nameIndex = $scope.field.configuration.interpretation.discreteValues.length + 1;
            while (!name)
            {
                const potentialName = `discrete_value_${nameIndex}`;
                if (_.findWhere($scope.field.configuration.interpretation.discreteValues, {name: potentialName}))
                {
                    nameIndex += 1;
                }
                else
                {
                    name = potentialName;
                }
            }


            const newDiscreteValue = {
                top: previousDiscreteValue.bottom,
                bottom: nextDiscreteValue.top,
                name: name
            };

            $scope.field.configuration.interpretation.discreteValues.splice(index, 0, newDiscreteValue);
        };

        $scope.removeDiscreteValue = function(index)
        {
            const previousDiscreteValue = $scope.field.configuration.interpretation.discreteValues[index - 1];
            const nextDiscreteValue = $scope.field.configuration.interpretation.discreteValues[index + 1];
            const range = previousDiscreteValue.bottom - nextDiscreteValue.top;
            const newPoint = previousDiscreteValue.bottom - (range / 2);
            previousDiscreteValue.bottom = newPoint;
            nextDiscreteValue.top = newPoint;
            $scope.field.configuration.interpretation.discreteValues.splice(index, 1);
        };

        $scope.startEditingTop = function(scope, index)
        {
            scope.editingTop = true;
            const discreteValue = $scope.field.configuration.interpretation.discreteValues[index];
            scope.topEditValue = discreteValue.top;
        };

        $scope.startEditingBottom = function(scope, index)
        {
            scope.editingBottom = true;
            const discreteValue = $scope.field.configuration.interpretation.discreteValues[index];
            scope.bottomEditValue = discreteValue.bottom;
        };

        $scope.discreteValueTopChanged = function(newValue, index)
        {
            if (!isNaN(newValue))
            {
                newValue = Number(newValue);

                const previousDiscreteValue = $scope.field.configuration.interpretation.discreteValues[index - 1];
                const currentDiscreteValue = $scope.field.configuration.interpretation.discreteValues[index];

                if (previousDiscreteValue.top !== null)
                {
                    newValue = Math.min(previousDiscreteValue.top, newValue);
                }

                if (currentDiscreteValue.bottom !== null)
                {
                    newValue = Math.max(newValue, currentDiscreteValue.bottom);
                }

                currentDiscreteValue.top = newValue;
                previousDiscreteValue.bottom = newValue;
            }
        };

        $scope.discreteValueBottomChanged = function(newValue, index)
        {
            if (!isNaN(newValue))
            {
                newValue = Number(newValue);

                const currentDiscreteValue = $scope.field.configuration.interpretation.discreteValues[index];
                const nextDiscreteValue = $scope.field.configuration.interpretation.discreteValues[index + 1];

                if (nextDiscreteValue.bottom !== null)
                {
                    newValue = Math.max(nextDiscreteValue.bottom, newValue);
                }

                if (currentDiscreteValue.top !== null)
                {
                    newValue = Math.min(newValue, currentDiscreteValue.top);
                }

                currentDiscreteValue.bottom = newValue;
                nextDiscreteValue.top = newValue;
            }
        };
    }

    return {
        templateUrl: "/plugins/number/views/number_interpretation_configuration.html",
        controller,
        restrict: "A",
        scope: {
            field: '=',
            mode: '='
        }
    };
});
