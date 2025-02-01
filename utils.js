let searchedLayers = []; // Global scope for searched layers
let gameArea = []; //Store the game area booundaries

function displayResults(json) {
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = ''; // Clear previous results

    // Parse the JSON data
    const places = JSON.parse(json);

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

        mainButton.onclick = function() {
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
        plusButton.onclick = function() {
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
    if (place.hasOwnProperty("geojson")) {
        place = place.geojson; // Input from Nominatim
    } else {
        place = place.geometry; // Input from Overpass
    }
    const geoJsonLayer = L.geoJSON(place, {
        style: {
            color: 'red',
            weight: 2,
            opacity: 0.5
        },
        onEachFeature: function(feature, layer) {
            // Add a click event listener to each feature
            layer.on('click', function(e) {
                map.removeLayer(layer);
                gameArea.pop(place)
            });

            // Add a mouseover event listener to highlight the feature
            layer.on('mouseover', function(e) {
                layer.setStyle({
                    color: 'red', // Highlight color
                    weight: 4,
                    opacity: 1
                });
            });

            // Add a mouseout event listener to reset the style
            layer.on('mouseout', function(e) {
                layer.setStyle({
                    color: 'red', // Original color
                    weight: 2,
                    opacity: 0.5
                });
            });
        }
    }).addTo(map);
    map.fitBounds(geoJsonLayer.getBounds());
    gameArea.push(place);
    clearMap(searchedLayers);
}

// Search location function
async function searchLocation() {
    const input = document.getElementById('searchInput').value;
    if (!input) {
        alert('Please enter a search term');
        return;
    }

    if (/^[0-9]+$/.test(input)) { //Input is an id
        const query = `
        [out:json];
        relation(${input}); 
        (._;>;); 
        out body;
        `;
        const response = await fetch("https://overpass-api.de/api/interpreter", {
            method: "POST",
            body: query,
            headers: {
                "Content-Type": "text/plain",
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch Overpass data: ${response.statusText}`);
        }
        clearMap(searchedLayers);
        const osmData = await response.json();
        const geojson = osmtogeojson(osmData);
        var items = turf.combine(turf.featureCollection(geojson.features));
        //Extract only the polygons from the relation
        items = items.features.filter(
            (feature) => feature.geometry.type === 'MultiPolygon' || feature.geometry.type === 'Polygon'
        )[0];
        console.log(items);
        addLocationToGame(items);

    } else {
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
}


function submit() {
    const itemName = document.getElementById('item-name').value.trim();
    if (!itemName) {
        alert('Please enter a name for the area name.');
        return;
    }

    let combinedPolygon = null;

    // Combine polygons from 'gameArea' into one
    if (gameArea) {
        for (const place of gameArea) {
            console.log(place);
            combinedPolygon = combinedPolygon ? turf.union(combinedPolygon, place) : place;
        }
    }
    if (combinedPolygon) {
        const geoJsonString = JSON.stringify(combinedPolygon);
        localStorage.setItem(itemName, geoJsonString);
        // Redirect to the next page, passing the item name as a query parameter
        window.location.href = `game.html?item=${encodeURIComponent(itemName)}`;
    }
}

function geojsonToTurf(geojson) {
    if (!geojson) return null;

    // 1. If input is a Feature, extract geometry
    let geometry = geojson;
    if (geojson.type === 'Feature') {
        geometry = geojson.geometry;
    } else if (geojson.features && Array.isArray(geojson.features)) {
        //TODO:
        // If input is a FeatureCollection, for instance
        // Just take the geometry of the first feature or union them if needed
        if (geojson.features.length === 0) return null;
        // For a single multipolygon from multiple features, union them.
        // But here we only handle the first feature. If you want to handle unioning, do it externally.
        geometry = geojson.features[0].geometry;
    }

    // 2. Ensure we have a geometry object
    if (!geometry || (!geometry.type && !geometry.geometry)) {
        return null;
    }

    // 3. If still nested, unwrap
    let gType = geometry.type;
    let coords = geometry.coordinates;

    // If geometry is still wrapped
    if (geometry.geometry && geometry.geometry.type) {
        gType = geometry.geometry.type;
        coords = geometry.geometry.coordinates;
    }

    // 4. Convert Polygon or MultiPolygon => MultiPolygon
    //    Return null for everything else
    if (gType === 'Polygon') {
        // Return a MultiPolygon with one set of coords
        return turf.multiPolygon([coords]);
    } else if (gType === 'MultiPolygon') {
        // Already MultiPolygon
        return turf.multiPolygon(coords);
    } else {
        // Try to interpret if it might be convertible
        // If you want to handle geometrycollection, you can do it here.
        return null;
    }
}