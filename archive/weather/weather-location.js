"use strict";

(() => {
    window.WeatherLocationController = {
        initMap: () => {
            const berlin = { lat: 52.5200, lng: 13.4050 };
            // map gets initialized before anythin else, this is because google is only defined after this api call
            $(document).ready(
                $.getScript(
                    `https://maps.googleapis.com/maps/api/js?key=AIzaSyDTtE-VtIB17Jv2poYsLUHbuEAixgKa3JM`,
                    () => window.WeatherLocationController.initVariables(berlin))
            );
        },
        initVariables: (initialLocation) => {
            const map = new window.google.maps.Map(document.getElementById('map'), {
                zoom: 5,
                center: initialLocation
            });
            window.WeatherLocationController.init(map, initialLocation);
        },
        init: (map, initialLocation) => {
            const summary = $("#summary");
            const title = $("#title");
            const image = $("#image");
            const temperature = $("#temperature");

            let placeMarker = function(location) {
                if (marker) {
                    marker.setMap(null);
                }
                marker = new window.google.maps.Marker({
                    position: location,
                    map
                });
                return marker;
            };

            let searchWeather = function(location) {
                let [lat, lng] = [location.lat(), location.lng()];
                let proxy = 'https://cors-anywhere.herokuapp.com/';
                let link = `https://api.darksky.net/forecast/b6f3e2c4cc625fea87d99c6f7f629434/${lat},${lng}`;

                $.ajax({
                    url: proxy + link,
                    success: function(p) {
                        summary.html(p.hourly.summary);
                        image.attr("src", `./icons/${p.hourly.icon}.svg`);
                        temperature.html(`${p.currently.temperature.toFixed(0)} F`);
                    }
                });
            };

            let searchCity = function(location) {
                let [lat, lng] = [location.lat(), location.lng()];
                let url = `http://ws.geonames.org/countryCodeJSON?lat=${lat}&lng=${lng}&username=juanjo.neri`;

                $.ajax({
                    url,
                    success: function(p) {
                        title.html(p.countryName);
                    }
                });
            };

            map.addListener('click', function(event) {
                let location = event.latLng;
                placeMarker(location);
                searchWeather(location);
                searchCity(location);
            });

            // When everything is said and done, display an example
            let marker;
            placeMarker(initialLocation);
            let lat = initialLocation.lat;
            let lng = initialLocation.lng;
            initialLocation.lat = () => lat;
            initialLocation.lng = () => lng;
            searchWeather(initialLocation);
            searchCity(initialLocation);


        }
    };
})();
