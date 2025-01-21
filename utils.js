
let searchedLayers = []; // Global scope for searched layers
let gameArea = []; //Store the game area booundaries

function displayResults(json) {
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = ''; // Clear previous results

    // Parse the JSON data
    const data = JSON.parse(json);
    const places = data;

    if (places.length === 0) {
        alert('No results for the search term');
        return;
    }

    // Sort places by importance and limit to the top 3
    const sortedPlaces = places
        .sort((a, b) => parseFloat(b.importance) - parseFloat(a.importance))
        .slice(0, 3); // Limit to the top 3 places

    sortedPlaces.forEach(place => {
        const displayName = place.display_name;
        const geojsonData = place.geojson;

        // Create a container for the result item
        const resultContainer = document.createElement('div');
        resultContainer.classList.add('search-result-item');

        // Create the main button (90% width)
        const mainButton = document.createElement('button');
        mainButton.textContent = displayName;
        mainButton.classList.add('main-button');

        mainButton.onclick = function () {
            const geoJsonLayer = L.geoJSON(geojsonData, {
                style: {
                    color: 'blue',
                    weight: 2,
                    opacity: 0.5
                }
            }).addTo(map);

            searchedLayers.push(geoJsonLayer); // Use global searchedLayers array

            // Fit the map to the bounds of the GeoJSON layer
            map.fitBounds(geoJsonLayer.getBounds());
        };

        // Create the "+" button (10% width)
        const plusButton = document.createElement('button');
        plusButton.textContent = 'Add to game';
        plusButton.classList.add('plus-button');
        plusButton.onclick = function () {
            addLocationToGame(place);
        };

        // Append the buttons to the result container
        resultContainer.appendChild(mainButton);
        resultContainer.appendChild(plusButton);

        // Append the result container to the results
        resultsContainer.appendChild(resultContainer);
    });
}

// Function to clear the map
function clearMap(layers) {
    layers.forEach(layer => {
        try {
            map.removeLayer(layer); // Remove each layer from the map
        } catch (e) {
            console.error('Problem removing layer: ', e);
        }
    });

    layers.length = 0; // Clear the array
}

// Function to handle adding a location to the game
function addLocationToGame(place) {
    const geojsonData = place.geojson;
    const geoJsonLayer = L.geoJSON(geojsonData, {
        style: {
            color: 'red',
            weight: 2,
            opacity: 0.5
        },
        onEachFeature: function (feature, layer) {
            // Add a click event listener to each feature
            layer.on('click', function (e) {
                map.removeLayer(layer);
                gameArea.pop(place)
            });
    
            // Add a mouseover event listener to highlight the feature
            layer.on('mouseover', function (e) {
                layer.setStyle({
                    color: 'red', // Highlight color
                    weight: 4,
                    opacity: 1
                });
            });
    
            // Add a mouseout event listener to reset the style
            layer.on('mouseout', function (e) {
                layer.setStyle({
                    color: 'red', // Original color
                    weight: 2,
                    opacity: 0.5
                });
            });
        }
    }).addTo(map);
    map.fitBounds(geoJsonLayer.getBounds());
    gameArea.push(place)
    clearMap(searchedLayers);
}

// Search location function
function searchLocation() {
    const input = document.getElementById('searchInput').value;
    if (!input) {
        alert('Please enter a search term');
        return;
    }

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(input)}&layer=address&limit=5&format=json&polygon_geojson=1&polygon_threshold=0.0005`;

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.text();
        })
        .then(data => {
            clearMap(searchedLayers); // Clear existing layers
            displayResults(data); // Add new layers
        })
        .catch(error => {
            console.error('Error fetching location:', error);
        });
}

function submit(){
    // Initialize an empty GeoJSON object for the union 
    let combinedPolygon = null;

    // Iterate over each game area
    gameArea.forEach(place => {
        const geojsonData = place.geojson; // Get GeoJSON data from place
        
        if (geojsonData.type === "MultiPolygon"){
            currentPolygon = turf.multiPolygon(geojsonData.coordinates);
        }
        if (geojsonData.type === "Polygon"){
            currentPolygon = turf.polygon(geojsonData.coordinates);
        }
        console.log('Combined GeoJSON:', geojsonData);
    }); 

    if (currentPolygon) {
        L.geoJSON(currentPolygon, {
            style: {
                color: 'purple', // Set a custom color for the combined polygon
                weight: 2,
                opacity: 0.7,
                fillOpacity: 0.4
            }
        }).addTo(map);
    }

}