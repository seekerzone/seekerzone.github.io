// Display search results
function displayResults(xml) {
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = ''; // Clear previous results
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, 'application/xml');
    const places = xmlDoc.getElementsByTagName('place');

    if(places.length == 0){
        alert('No results for the search term');
    }
    
    const sortedPlaces = Array.from(places)
    .sort((a, b) => parseFloat(b.getAttribute('importance')) - parseFloat(a.getAttribute('importance')))
    .slice(0, 3); // Limit to the top 3 places
    
    sortedPlaces.forEach(place => {
        const displayName = place.getAttribute('display_name'); 
        const geojsonData = JSON.parse(place.getAttribute('geojson'));
    
        const resultButton = document.createElement('button');
        resultButton.textContent = displayName;
        resultButton.onclick = function() {
            const geoJsonLayer = L.geoJSON(geojsonData, {
                style: {
                    color: 'blue',
                    weight: 2,
                    opacity: 0.5
                }
            }).addTo(map);
    
            // Fit the map to the bounds of the GeoJSON layer
            map.fitBounds(geoJsonLayer.getBounds());
        };
    
        resultsContainer.appendChild(resultButton);
    });
}

function clearMap() {
    for(i in map._layers) {
        if(map._layers[i]._path != undefined) {
            try {
                map.removeLayer(map._layers[i]);
            }
            catch(e) {
                console.log("problem with " + e + map._layers[i]);
            }
        }
    }
}