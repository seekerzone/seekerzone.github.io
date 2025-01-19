// Display search results
function displayResults(xml) {
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = ''; // Clear previous results
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, 'application/xml');
    const places = xmlDoc.getElementsByTagName('place');
    
    Array.from(places).forEach(place => {
        const displayName = place.getAttribute('display_name'); 
        const boundingBox = place.getAttribute('boundingbox').split(',');
    
        const resultButton = document.createElement('button');
        resultButton.textContent = displayName;
        resultButton.onclick = function() {
        // Parse the bounding box into lat/lon coordinates
        const [minLat, maxLat, minLon, maxLon] = boundingBox;
        const latLngs = [
            [minLat, minLon],
            [minLat, maxLon],
            [maxLat, maxLon],
            [maxLat, minLon],
            [minLat, minLon]
        ];
    
        // Create a bounding box polygon and zoom the map
        const polyline = L.polyline(latLngs, {color: 'red'}).addTo(map);
        map.fitBounds(polyline.getBounds());
    
        };
        setTimeout(() => {
        polyline.setStyle({
        opacity: 0, // Fade to invisible
        weight: 0,  // Optionally reduce the weight (line thickness)
        dashArray: '5, 5', // Optional, add dashed effect
        });
        
    }, 5000);
    
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