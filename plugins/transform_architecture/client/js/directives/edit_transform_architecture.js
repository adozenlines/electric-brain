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
 * EB - controller
 */


angular.module('eb').directive('ebEditTransformArchitecture', function EBEditTransformArchitecture($stateParams, EBArchitectureService, $state, EBNavigationBarService, EBLoaderService)
{
    return {
        controller($scope)
        {
            $scope.currentTab = 0;
            
            if (!$stateParams.id)
            {
                $stateParams.id = 'new';
            }

            $scope.$stateParams = $stateParams;

            $scope.isNew = $stateParams.id === 'new';
            $scope.schemaNeedsRefreshed = false;

            $scope.$watch('architecture', function(newValue)
            {
                if (newValue)
                {
                    if (!$scope.architecture.dataSource)
                    {
                        $scope.currentTab = 1;
                    }

                    // Check to see if we have a valid set of fields. If so, go to
                    // straight to the design architecture screen. Otherwise, go
                    // to the select_fields screen.
                    else if ($scope.architecture.validInputOutputSchemas())
                    {
                        $scope.currentTab = 2;
                    }
                    else
                    {
                        $scope.currentTab = 3;
                    }
                }
            });

            $scope.setSchemaNeedsRefreshed = function setSchemaNeedsRefreshed(value)
            {
                if (!value)
                {
                    value = true;
                }
                $scope.schemaNeedsRefreshed = value;
            };
        },
        templateUrl: "/plugins/transform_architecture/views/edit_transform_architecture.html",
        restrict: "A",
        scope: {
            architecture: "="
        }
    };
});
