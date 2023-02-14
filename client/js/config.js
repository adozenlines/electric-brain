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
 * Define the routes here
 *
 */
angular.module('eb').config(function config($stateProvider, $urlRouterProvider, $ocLazyLoadProvider, $locationProvider, $httpProvider, $sceProvider)
{
    $locationProvider.html5Mode({
        enabled: true,
        requireBase: true
    });
    
    $sceProvider.enabled(false);

    // Set debug to true if you want to see what and when is dynamically loaded
    $ocLazyLoadProvider.config({debug: false});

    $stateProvider.state('dashboard', {
        url: "/",
        templateUrl: "views/dashboard/pages/dashboard.html",
        controller: "EBDashboardController"
    });

    $stateProvider.state('list_data_sources', {
        url: "/data-source",
        templateUrl: "views/data_sources/pages/list_data_sources.html",
        data: {pageTitle: 'View all my data sources'},
        controller: "EBListDataSourcesController"
    });

    $stateProvider.state('new_data_source', {
        url: "/data-source/new",
        templateUrl: "views/data_sources/pages/edit_data_source.html",
        data: {pageTitle: 'New Data Source'},
        redirectTo: 'new_data_source.select_database_type',
        controller: "EBEditDataSourceController"
    });

    $stateProvider.state('new_data_source.select_database_type', {
        templateUrl: "views/data_sources/pages/edit_data_source/select_database_type.html",
        controller: "EBDataSourceSelectDatabaseTypeController",
        params: {}
    });

    $stateProvider.state('new_data_source.upload_file', {
        templateUrl: "views/data_sources/pages/edit_data_source/upload_file.html",
        controller: "EBDataSourceUploadFileController",
        params: {}
    });

    $stateProvider.state('new_data_source.select_table', {
        templateUrl: "views/data_sources/pages/edit_data_source/select_table.html",
        controller: "EBDataSourceSelectTableController",
        params: {}
    });

    $stateProvider.state('new_data_source.select_postgres', {
        templateUrl: "views/data_sources/pages/edit_data_source/select_postgres.html",
        controller: "EBDataSourceSelectPostgresController",
        params: {}
    });
    
    $stateProvider.state('new_data_source.select_fields', {
        templateUrl: "views/data_sources/pages/edit_data_source/select_fields.html",
        controller: "EBDataSourceSelectFieldsController",
        params: {refreshSchema: null}
        
    });


    $stateProvider.state('edit_data_source', {
        url: "/data-source/:id",
        templateUrl: "views/data_sources/pages/edit_data_source.html",
        data: {pageTitle: 'Edit Data Source'},
        redirectTo: 'edit_data_source.select_fields',
        controller: "EBEditDataSourceController"
    });

    $stateProvider.state('edit_data_source.select_database_type', {
        templateUrl: "views/data_sources/pages/edit_data_source/select_database_type.html",
        controller: "EBDataSourceSelectDatabaseTypeController",
        params: {}
    });

    $stateProvider.state('edit_data_source.upload_file', {
        templateUrl: "views/data_sources/pages/edit_data_source/upload_file.html",
        controller: "EBDataSourceUploadFileController",
        params: {}
    });

    $stateProvider.state('edit_data_source.select_table', {
        templateUrl: "views/data_sources/pages/edit_data_source/select_table.html",
        controller: "EBDataSourceSelectTableController",
        params: {}
    });
    
    $stateProvider.state('edit_data_source.select_fields', {
        templateUrl: "views/data_sources/pages/edit_data_source/select_fields.html",
        controller: "EBDataSourceSelectFieldsController",
        params: {refreshSchema: null}
    });

    $stateProvider.state('new_architecture', {
        url: "/architecture/new",
        templateUrl: "views/architectures/pages/new_architecture.html",
        data: {pageTitle: 'Edit Architecture'},
        controller: "EBNewArchitectureController"
    });

    $stateProvider.state('edit_architecture', {
        url: "/architecture/:id",
        templateUrl: "views/architectures/pages/edit_architecture.html",
        data: {pageTitle: 'Edit Architecture'},
        controller: "EBEditArchitectureController"
    });

    $stateProvider.state('list_architectures', {
        url: "/architectures",
        templateUrl: "views/architectures/pages/list_architectures.html",
        data: {pageTitle: 'View all my architectures'},
        controller: "ListArchitecturesController"
    });

    $stateProvider.state('new_model', {
        url: "/model/new",
        templateUrl: "views/models/pages/new_model.html",
        data: {pageTitle: 'New Model'},
        controller: "EBNewModelController"
    });

    $stateProvider.state('view_model', {
        url: "/model/:id",
        templateUrl: "views/models/pages/view_model.html",
        data: {pageTitle: 'View Model'},
        controller: "EBViewModelController"
    });

    $stateProvider.state('list_models', {
        url: "/models",
        templateUrl: "views/models/pages/list_models.html",
        data: {pageTitle: 'View all my models'},
        controller: "ListModelsController"
    });


    $urlRouterProvider.when(/^(.*)\/$/, '/$1');
    $urlRouterProvider.otherwise("/");

    // Configure our middleware for $http requests
    $httpProvider.interceptors.push('authenticationHeaderInjector');
    $httpProvider.interceptors.push('queryStringFlattener');
});


angular.module('eb').run(function($rootScope, $state)
{
    $rootScope.userName = 'Bradley Arsenault';
    $rootScope.$state = $state;

    $rootScope.$on('$stateChangeStart', function(evt, to, params)
    {
        if (to.redirectTo)
        {
            evt.preventDefault();
            $state.go(to.redirectTo, params, {location: 'replace'});
        }
    });

    $("body").mousemove(function(e) {
        $rootScope.$broadcast('mouse', {
            x: e.originalEvent.pageX,
            y: e.originalEvent.pageY
        });
    });
});


angular.module('eb').constant('config', {
    api: {},
    thresholdDelay: 200
});


angular.module('eb').factory('queryStringFlattener', [
    function()
    {
        return {
            // For all outgoing HTTP requests, we attach the access token
            request(config)
            {
                if (config.params)
                {
                    config.params = flat.flatten(config.params);
                }

                return config;
            }
        };
    }
]);


angular.module('eb').factory('authenticationHeaderInjector', [
    function()
    {
        return {
            // For all outgoing HTTP requests, we attach the access token
            request(config)
            {
                // var accessToken = AuthenticationState.accessToken();
                // if (accessToken)
                // {
                //     config.headers['Authorization'] = 'Bearer ' + accessToken;
                // }
                return config;
            }
        };
    }
]);
