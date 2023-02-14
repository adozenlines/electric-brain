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
 * The collection list is an element that allows you to view the list of tables/collections that are contained within a database
 */
angular.module('eb').directive('ebNavigationBar', function ebNavigationBar($timeout, EBNavigationBarService, EBDataSourceService, EBArchitectureService, EBModelService, $uibModal, $http, EBHomeService)
{
    const controller = function($scope)
    {
        const refreshNavigationBar = function()
        {
            EBDataSourceService.getDataSources({
                limit: 5,
                select: ["_id", "name"]
            }).success(function success(data)
            {
                $scope.dataSources = data.dataSources;
            });

            EBArchitectureService.getArchitectures({
                limit: 5,
                select: ["_id", "name"]
            }).success(function success(data)
            {
                $scope.architectures = data.architectures;
            });

            EBModelService.getModels({
                limit: 5,
                select: ["_id", "name"]
            }).success(function success(data)
            {
                $scope.models = data.models;
            });
        };
        
        $scope.loaderEnabled = false;
        const setLoaderStatus = function(enabled)
        {
            $scope.loaderEnabled = enabled;
        };

        // The initial refresh. Loads everything for the navigation bar.
        refreshNavigationBar();

        EBNavigationBarService._directiveCallbacks.refreshNavigationBar = refreshNavigationBar;
        EBNavigationBarService._directiveCallbacks.setLoaderStatus = setLoaderStatus;
        
        $scope.showAboutUs = function()
        {
            const instance = $uibModal.open({
                templateUrl: 'views/general/dialogs/about_dialog.html',
                controller: 'EBAboutUsDialogController',
                // windowClass: 'loader-button-confirmation',
                backdrop: true,
                resolve: {
                    homeData: EBHomeService.getHomeData()
                }
            });

            return instance.result;
        };
    };

    return {
        templateUrl: "views/general/directives/navigation.html",
        controller,
        restrict: "E",
        scope: {}
    };
});


angular.module('eb').controller('EBAboutUsDialogController', function EBAboutUsDialogController($scope, homeData, $uibModalInstance)
{
    $scope.homeData = homeData;

    $scope.license = homeData.license.replace(/\n/g, '<br>');

    $scope.ok = function()
    {
        $uibModalInstance.close(true);
    };
});
