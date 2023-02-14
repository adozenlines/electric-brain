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


angular.module('eb').controller('EBDataSourceUploadFileController', function EBDataSourceUploadFileController($scope, $timeout, $state, $stateParams, EBDataSourceService, config, EBLoaderService, EBNavigationBarService)
{
    $scope.sampleSize = 500;
    $scope.allowQuotedCSVFiles = true;
    $scope.upload = function upload()
    {
        return new Promise(function(resolve, reject)
        {
            $scope.uploading = true;
            $scope.bytesTotal = $scope.file.size;
            $scope.bytesUploaded = 0;

            // Create a new tus upload
            const upload = new tus.Upload($scope.file, {
                resume: false,
                endpoint: "/api/uploads",
                retryDelays: [0, 1000, 3000, 5000],
                onError: function(error)
                {
                    $timeout(function()
                    {
                        $scope.uploading = false;
                    });

                    reject(error);
                },
                onProgress: function(bytesUploaded, bytesTotal)
                {
                    $timeout(function()
                    {
                        $scope.bytesTotal = bytesTotal;
                        $scope.bytesUploaded = bytesUploaded;
                    });
                },
                onSuccess: function()
                {
                    $timeout(function()
                    {
                        $scope.uploading = false;
                        $scope.dataSource.name = $scope.file.name;
                        $scope.dataSource.type = 'csv';
                        $scope.dataSource.file = (/.*\/(.*)/g).exec(upload.url)[1];
                        $scope.dataSource.sampleSize = $scope.sampleSize;
                        $scope.dataSource.allowQuotedCSVFiles = $scope.allowQuotedCSVFiles;

                        const promise = EBDataSourceService.createDataSource($scope.dataSource).then((body) =>
                        {
                            $state.go('edit_data_source.select_fields', {id: body.data._id, refreshSchema: true});
                            EBNavigationBarService.refreshNavigationBar();
                            return body;
                        });
                        EBLoaderService.showLoaderWith('menu', promise);
                    }, config.thresholdDelay);

                    resolve();
                }
            });

            // Start the upload
            upload.start();
        });
    };
});
