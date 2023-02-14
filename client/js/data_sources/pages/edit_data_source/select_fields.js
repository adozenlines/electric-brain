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


angular.module('eb').controller('EBDataSourceSelectFieldsController', function EBDataSourceSelectFieldsController($scope, $timeout, $state, $stateParams, EBDataSourceService, config, EBNavigationBarService, EBLoaderService, EBSocketService)
{
    let firstUpdateResolver;
    let firstUpdateResolved = false;
    const firstUpdatePromise = new Promise(function(resolve, reject)
    {
        firstUpdateResolver = resolve;
    });

    const socketEventHandler = (data) =>
    {
        $timeout(() =>
        {
            if (data.event === 'update')
            {
                // Fetch the latest data-source, and copy our current configuration into it
                const promise = EBDataSourceService.getDataSource($scope.dataSource._id).success((dataSource) =>
                {
                    if ($scope.dataSource.dataSchema)
                    {
                        // Copy the configuration from that schema into this one
                        dataSource.dataSchema.copyConfigurationFrom($scope.dataSource.dataSchema);
                    }
                    
                    // Replace ours with the updated one
                    $scope.dataSource = dataSource;

                    if (!firstUpdateResolved)
                    {
                        firstUpdateResolved = true;
                        firstUpdateResolver();
                    }
                });
                EBLoaderService.showLoaderWith('menu', promise);
            }
        });
    };

    const setupEventHandler = function()
    {
        EBSocketService.socket.on(`data-source-${$scope.dataSource._id}`, socketEventHandler);
    };

    const clearEventHandler = function()
    {
        EBSocketService.socket.removeListener(`data-source-${$scope.dataSource._id}`, socketEventHandler);
    };

    $scope.$on('$destroy', () =>
    {
        clearEventHandler();
    });

    let hasSetupDataSource = false;
    function setupDataSource()
    {
        if (!$scope.dataSource.dataSchema)
        {
            const promise = EBDataSourceService.saveDataSource($scope.dataSource).then(() =>
            {
                EBLoaderService.showLoaderWith('page', firstUpdatePromise);
                EBDataSourceService.sampleDataSource($scope.dataSource).success((body) =>
                {
                    setupEventHandler();
                });
            });
            EBLoaderService.showLoaderWith('page', promise);
        }
        else
        {
            setupEventHandler();
        }
    }

    $scope.$watch('dataSource', function(newValue)
    {
        if (newValue)
        {
            if (!hasSetupDataSource)
            {
                hasSetupDataSource = true;
                setupDataSource();
            }
        }
    });

    $scope.onSaveClicked = function onSaveClicked()
    {
        return EBDataSourceService.saveDataSource($scope.dataSource);
    };

    $scope.onDeleteClicked = function onDeleteClicked()
    {
        return EBDataSourceService.deleteDataSource($scope.dataSource).then((body) =>
        {
            EBNavigationBarService.refreshNavigationBar();
            $state.go('dashboard');
        });
    };


    $scope.onContinue = function onContinue()
    {
        const promise = EBDataSourceService.saveDataSource($scope.dataSource);
        promise.then(() =>
        {
            $state.go('new_architecture');
        });
        return promise;
    };
});
