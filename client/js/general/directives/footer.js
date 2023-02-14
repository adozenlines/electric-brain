
/**
 * The collection list is an element that allows you to view the footer
 */
angular.module('eb').directive('ebFooter', function ebFooter($timeout, EBHomeService)
{
    function controller($scope)
    {
        EBHomeService.getHomeData().then(function(homeData)
        {
            $scope.companyName = homeData.companyName;
        });
    }
    
    return {
        templateUrl: "views/general/footer.html",
        controller,
        restrict: "E",
        scope: {}
    };
});
