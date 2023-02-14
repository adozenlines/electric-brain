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
angular.module('eb').directive('ebSchemaLinker', function ebSchemaLinker($interval)
{
    return {
        controller($scope)
        {
            var canvas = $.parseHTML(`<canvas style="position: absolute; width: 100%; height: 100%;left: 0;top:0;right:0;bottom: 0;overflow:visible;pointer-events:none; background:none !important;z-index: 1000;"></canvas>`)[0];
            $('#wrapper').prepend(canvas);
            var ctx = canvas.getContext("2d");

            let mouseX = 0;
            let mouseY = 0;
            let currentlyGrabbingSlot = false;

            let startSlot = null;

            let findSnapSlot;
            const possibleSlots = [];
            const leftSlotMap = {};
            const rightSlotMap = {};

            function drawLine(startX, startY, endX, endY)
            {
                ctx.lineWidth = 3;
                ctx.strokeStyle = "#0086d1";
                ctx.lineCap = 'round';

                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            }

            const redrawHandle = function redrawHandle()
            {
                // make sure the width & height is correct
                canvas.width = document.body.clientWidth;
                canvas.height = document.body.clientHeight;

                // clear
                ctx.clearRect(0,0, canvas.width, canvas.height);

                if (currentlyGrabbingSlot)
                {
                    const link = findSnapSlot();
                    if (link)
                    {
                        drawLine(startSlot.x, startSlot.y, link.x, link.y);
                    }
                    else
                    {
                        drawLine(startSlot.x, startSlot.y, mouseX, mouseY);
                    }
                }

                if ($scope.links)
                {
                    $scope.links.forEach(function(link)
                    {
                        const leftSlot = leftSlotMap[link.leftField];
                        const rightSlot = rightSlotMap[link.rightField];

                        if (leftSlot && rightSlot)
                        {
                            // Draw a line between each
                            drawLine(leftSlot.x, leftSlot.y, rightSlot.x, rightSlot.y);
                        }
                    });
                }
            };

            $scope.$on('register-slot', function(event, data)
            {
                possibleSlots.push(data);

                if (data.slotSide === 'left')
                {
                    leftSlotMap[data.field.variablePath] = data;
                }
                else if (data.slotSide === 'right')
                {
                    rightSlotMap[data.field.variablePath] = data;
                }
            });

            findSnapSlot = function()
            {
                // Figures out which of the links is the snap link
                let closestSlot = null;
                let closestDistance = 50;

                possibleSlots.forEach(function(slot)
                {
                    if (slot.slotSide !== startSlot.slotSide && !findLinkForSlot(slot))
                    {
                        const distance = Math.sqrt(((slot.x - mouseX) * (slot.x - mouseX)) + ((slot.y - mouseY) * (slot.y - mouseY)));
                        if (distance < closestDistance)
                        {
                            closestSlot = slot;
                            closestDistance = distance;
                        }
                    }
                });

                return closestSlot;
            };

            $scope.$on('mouse', function(event, data)
            {
                mouseX = data.x;
                mouseY = data.y;
                redrawHandle()
            });


            $scope.$on('$destroy', function()
            {
                $interval.cancel(redrawHandle);
                $(canvas).remove();
            });

            function createLink(leftLink, rightLink)
            {
                if (!$scope.links)
                {
                    $scope.links = [];
                }

                $scope.links.push({
                    leftField: leftLink.field.variablePath,
                    rightField: rightLink.field.variablePath
                });
            }

            function findLinkForSlot(slot)
            {
                if (!$scope.links)
                {
                    return null;
                }

                for (let linkIndex = 0; linkIndex < $scope.links.length; linkIndex += 1)
                {
                    const link = $scope.links[linkIndex];
                    if (slot.slotSide === 'left' && slot.field.variablePath === link.leftField)
                    {
                        return link;
                    }
                    else if (slot.slotSide === 'right' && slot.field.variablePath === link.rightField)
                    {
                        return link;
                    }
                }
                return null;
            }

            $scope.$on('slot-selected', function(event, data)
            {
                let foundSlot = null;
                possibleSlots.forEach(function(slot)
                {
                    if (data.field === slot.field)
                    {
                        foundSlot = slot;
                    }
                });

                if (currentlyGrabbingSlot)
                {
                    if (foundSlot.slotSide !== startSlot.slotSide)
                    {
                        if (!findLinkForSlot(foundSlot))
                        {
                            if (startSlot.slotSide === 'left')
                            {
                                // Create a new link
                                createLink(startSlot, foundSlot);
                            }
                            else if (startSlot.slotSide === 'right')
                            {
                                // Create a new link
                                createLink(foundSlot, startSlot);
                            }
                            startSlot = null;
                            currentlyGrabbingSlot = false;
                        }
                    }
                    else if (foundSlot === startSlot)
                    {
                        // cancel
                        currentlyGrabbingSlot = false;
                    }
                    else
                    {
                        startSlot = foundSlot;
                    }
                }
                else
                {
                    // See if we already have a link somewhere for the found slot
                    let found = false;
                    if ($scope.links)
                    {
                        const link = findLinkForSlot(foundSlot);
                        if (link)
                        {
                            found = true;
                            if (foundSlot.slotSide === 'left' && foundSlot.field.variablePath === link.leftField)
                            {
                                // Find the opposite slots
                                startSlot = rightSlotMap[link.rightField];
                                found = true;
                                currentlyGrabbingSlot = true;
                                $scope.links.splice($scope.links.indexOf(link), 1);
                            }
                            else if (foundSlot.slotSide === 'right' && foundSlot.field.variablePath === link.rightField)
                            {
                                // Find the opposite slots
                                startSlot = leftSlotMap[link.leftField];
                                currentlyGrabbingSlot = true;
                                found = true;
                                $scope.links.splice($scope.links.indexOf(link), 1);
                            }
                        }
                    }

                    if (!found)
                    {
                        startSlot = foundSlot;
                        currentlyGrabbingSlot = true;
                    }
                }
            });
        },
        templateUrl: "views/schemas/directives/schema_linker.html",
        restrict: "E",
        scope: {
            leftSchema: '=',
            rightSchema: '=',
            leftTitle: '@',
            rightTitle: '@',
            links: '='
        },
        transclude: true
    };
});
